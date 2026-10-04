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
    Json, Router, middleware,
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
        .with_state(state.clone());
    let fallback = ServeDir::new(&state.config.static_dir)
        .not_found_service(ServeFile::new(state.config.static_dir.join("404.html")));
    api.fallback_service(fallback)
        .layer(axum::extract::DefaultBodyLimit::max(2 * 1024 * 1024))
        .layer(TimeoutLayer::with_status_code(
            axum::http::StatusCode::REQUEST_TIMEOUT,
            Duration::from_secs(15),
        ))
        .layer(middleware::from_fn_with_state(state, security::headers))
}
async fn ready(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> error::Result<Json<serde_json::Value>> {
    sqlx::query("SELECT 1").execute(&state.pool).await?;
    Ok(Json(json!({"status":"ok"})))
}
