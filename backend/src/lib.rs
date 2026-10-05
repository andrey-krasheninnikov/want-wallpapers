pub mod auth;
pub mod catalog;
pub mod config;
pub mod error;
pub mod models;
pub mod moderation;
pub mod recaptcha;
mod security;
pub mod social;

use axum::{
    Json, Router,
    body::Body,
    extract::{Request, State},
    http::{StatusCode, header},
    middleware,
    response::{IntoResponse, Response},
    routing::{delete, get, patch, post, put},
};
use serde_json::json;
use sqlx::PgPool;
use std::{collections::HashMap, sync::Arc, time::Duration};
use tower_http::{
    services::{ServeDir, ServeFile},
    timeout::TimeoutLayer,
};

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Arc<config::Config>,
    pub csp_hashes: Arc<HashMap<String, Vec<String>>>,
    pub recaptcha: Option<google_cloud_recaptchaenterprise_v1::client::RecaptchaEnterpriseService>,
    pub login_slots: Arc<tokio::sync::Semaphore>,
}
pub fn router(state: AppState) -> Router {
    let api = Router::new()
        .route(
            "/health/live",
            get(|| async { Json(json!({"status":"ok"})) }),
        )
        .route("/health/ready", get(ready))
        .route("/api/v1/recaptcha/config", get(recaptcha::public_config))
        .route("/api/v1/catalog", get(catalog::snapshot))
        .route("/api/v1/session", post(auth::visitor_session))
        .route("/api/v1/wallpapers/{id}/social", get(social::read))
        .route("/api/v1/wallpapers/{id}/rating", put(social::rate))
        .route("/api/v1/wallpapers/{id}/comments", post(social::comment))
        .route(
            "/api/v1/wallpapers/{id}/comments/{comment}",
            delete(social::delete_comment),
        )
        .route(
            "/api/v1/wallpapers/{id}/comments/{comment}/report",
            post(social::report),
        )
        .route("/api/v1/feedback", post(social::feedback))
        .route("/api/v1/admin/login", post(auth::login))
        .route("/api/v1/admin/session", get(auth::admin_session))
        .route("/api/v1/admin/logout", post(auth::logout))
        .route("/api/v1/admin/catalog", get(catalog::listing))
        .route("/api/v1/admin/catalog/import", post(catalog::import))
        .route(
            "/api/v1/admin/catalog/collections",
            put(catalog::save_collection),
        )
        .route(
            "/api/v1/admin/catalog/wallpapers",
            put(catalog::save_wallpaper),
        )
        .route(
            "/api/v1/admin/catalog/{kind}/{id}/archive",
            patch(catalog::archive),
        )
        .route("/api/v1/admin/moderation/{kind}", get(moderation::list))
        .route(
            "/api/v1/admin/moderation/{kind}/{id}",
            patch(moderation::update),
        )
        .route("/404/", get(not_found))
        .route("/ru/404/", get(not_found))
        .route("/zh-cn/404/", get(not_found))
        .route("/pt-br/404/", get(not_found))
        .with_state(state.clone());
    let not_found_service = Router::new().fallback(not_found).with_state(state.clone());
    let fallback = ServeDir::new(&state.config.static_dir).fallback(not_found_service);
    api.fallback_service(fallback)
        .layer(axum::extract::DefaultBodyLimit::max(2 * 1024 * 1024))
        .layer(TimeoutLayer::with_status_code(
            axum::http::StatusCode::REQUEST_TIMEOUT,
            Duration::from_secs(15),
        ))
        .layer(middleware::from_fn_with_state(state, security::headers))
}
fn not_found_route(path: &str) -> &'static str {
    match path.split('/').nth(1) {
        Some("ru") => "/ru/404/",
        Some("zh-cn") => "/zh-cn/404/",
        Some("pt-br") => "/pt-br/404/",
        _ => "/404/",
    }
}
async fn not_found(State(state): State<AppState>, mut request: Request) -> Response {
    if security::is_api_path(request.uri().path()) {
        return error::ApiError::missing().into_response();
    }
    let route = not_found_route(request.uri().path());
    let file = if route == "/404/" {
        "404.html".to_owned()
    } else {
        format!("{}index.html", route.trim_start_matches('/'))
    };
    // Error documents return a complete representation for GET, including reloads.
    for header in [
        header::RANGE,
        header::IF_RANGE,
        header::IF_MATCH,
        header::IF_NONE_MATCH,
        header::IF_MODIFIED_SINCE,
        header::IF_UNMODIFIED_SINCE,
    ] {
        request.headers_mut().remove(header);
    }
    match ServeFile::new(state.config.static_dir.join(file))
        .try_call(request)
        .await
    {
        Ok(response) if response.status().is_success() => {
            let mut response = response.map(Body::new);
            *response.status_mut() = StatusCode::NOT_FOUND;
            response
        }
        _ => {
            tracing::error!("not-found document could not be served");
            error::ApiError(StatusCode::INTERNAL_SERVER_ERROR, "unavailable").into_response()
        }
    }
}
async fn ready(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> error::Result<Json<serde_json::Value>> {
    sqlx::query("SELECT 1").execute(&state.pool).await?;
    Ok(Json(json!({"status":"ok"})))
}
