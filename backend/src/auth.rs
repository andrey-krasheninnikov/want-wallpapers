use crate::{
    AppState,
    error::{ApiError, Result},
    models::text,
};
use argon2::{Argon2, PasswordHash, PasswordVerifier};
use axum::{
    Json,
    extract::{ConnectInfo, State},
    http::{HeaderMap, HeaderValue, header},
    response::{IntoResponse, Response},
};
use rand::{RngCore, rngs::OsRng};
use serde::Deserialize;
use serde_json::json;
use sha2::{Digest, Sha256};
use sqlx::Row;
use std::{
    net::{IpAddr, SocketAddr},
    time::{SystemTime, UNIX_EPOCH},
};
use subtle::ConstantTimeEq;
use uuid::Uuid;

pub fn digest(value: &str) -> String {
    hex::encode(Sha256::digest(value.as_bytes()))
}
fn random_token() -> String {
    let mut bytes = [0; 32];
    OsRng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}
fn equal(a: &str, b: &str) -> bool {
    bool::from(a.as_bytes().ct_eq(b.as_bytes()))
}
pub fn origin(state: &AppState, headers: &HeaderMap) -> Result<()> {
    if headers.get(header::ORIGIN).and_then(|v| v.to_str().ok()) != Some(&state.config.site) {
        return Err(ApiError::forbidden());
    }
    Ok(())
}
fn cookie(state: &AppState, headers: &HeaderMap, role: &str) -> Option<String> {
    let name = format!(
        "{}want-{role}=",
        if state.config.production {
            "__Host-"
        } else {
            ""
        }
    );
    headers
        .get(header::COOKIE)?
        .to_str()
        .ok()?
        .split(';')
        .find_map(|item| {
            item.trim()
                .strip_prefix(&name)
                .filter(|token| token.len() == 64 && token.bytes().all(|b| b.is_ascii_hexdigit()))
                .map(str::to_owned)
        })
}
pub fn client_ip(state: &AppState, headers: &HeaderMap, peer: SocketAddr) -> IpAddr {
    let trusted = |ip| {
        state
            .config
            .trusted_proxies
            .iter()
            .any(|net| net.contains(&ip))
    };
    if !trusted(peer.ip()) {
        return peer.ip();
    }
    if let Some(chain) = headers
        .get("x-forwarded-for")
        .and_then(|value| value.to_str().ok())
    {
        for item in chain.split(',').rev() {
            let Ok(ip) = item.trim().parse::<IpAddr>() else {
                return peer.ip();
            };
            if !trusted(ip) {
                return ip;
            }
        }
    }
    peer.ip()
}
pub async fn limit(state: &AppState, key: &str, max: i32, seconds: i32) -> Result<()> {
    let attempts: i32 = sqlx::query_scalar("INSERT INTO rate_limits(key, attempts, resets_at) VALUES($1, 1, now() + make_interval(secs => $2)) ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN rate_limits.resets_at <= now() THEN 1 ELSE rate_limits.attempts + 1 END, resets_at = CASE WHEN rate_limits.resets_at <= now() THEN excluded.resets_at ELSE rate_limits.resets_at END RETURNING attempts")
        .bind(digest(key)).bind(seconds as f64).fetch_one(&state.pool).await?;
    if attempts > max {
        return Err(ApiError(
            axum::http::StatusCode::TOO_MANY_REQUESTS,
            "rate-limited",
        ));
    }
    Ok(())
}
#[derive(Clone)]
pub struct Session {
    pub visitor: Option<Uuid>,
    pub csrf: String,
    pub hash: String,
}
pub async fn session(state: &AppState, headers: &HeaderMap, role: &str) -> Result<Session> {
    let hash = digest(&cookie(state, headers, role).ok_or_else(ApiError::unauthorized)?);
    let row = sqlx::query("UPDATE sessions SET last_seen = now() WHERE token_hash = $1 AND role = $2 AND expires_at > now() AND ($2 <> 'admin' OR (last_seen > now() - interval '30 minutes' AND credential_fingerprint = $3)) RETURNING visitor_id, csrf")
        .bind(&hash).bind(role).bind(&state.config.credential_fingerprint).fetch_optional(&state.pool).await?.ok_or_else(ApiError::unauthorized)?;
    Ok(Session {
        visitor: row.get("visitor_id"),
        csrf: row.get("csrf"),
        hash,
    })
}
pub async fn mutation(state: &AppState, headers: &HeaderMap, role: &str) -> Result<Session> {
    origin(state, headers)?;
    let session = session(state, headers, role).await?;
    if !equal(
        headers
            .get("x-csrf-token")
            .and_then(|v| v.to_str().ok())
            .unwrap_or_default(),
        &session.csrf,
    ) {
        return Err(ApiError::forbidden());
    }
    Ok(session)
}
#[derive(Clone, Copy)]
pub enum CatalogActor {
    Admin,
    Token,
}
impl CatalogActor {
    pub fn name(self) -> &'static str {
        match self {
            Self::Admin => "admin",
            Self::Token => "catalog-token",
        }
    }
}
pub async fn catalog_access(
    state: &AppState,
    headers: &HeaderMap,
    write: bool,
) -> Result<CatalogActor> {
    if let Some(value) = headers.get(header::AUTHORIZATION) {
        let token = value
            .to_str()
            .ok()
            .and_then(|v| v.strip_prefix("Bearer "))
            .ok_or_else(ApiError::unauthorized)?;
        if !equal(&digest(token), &state.config.catalog_token_hash) {
            return Err(ApiError::unauthorized());
        }
        return Ok(CatalogActor::Token);
    }
    if write {
        mutation(state, headers, "admin").await?;
    } else {
        session(state, headers, "admin").await?;
    }
    Ok(CatalogActor::Admin)
}
pub async fn admin_access(state: &AppState, headers: &HeaderMap, write: bool) -> Result<()> {
    if headers.contains_key(header::AUTHORIZATION) {
        return Err(ApiError::forbidden());
    }
    if write {
        mutation(state, headers, "admin").await?;
    } else {
        session(state, headers, "admin").await?;
    }
    Ok(())
}
async fn issue(state: &AppState, role: &str, visitor: Option<Uuid>) -> Result<Response> {
    let token = random_token();
    let csrf = random_token();
    let seconds = if role == "admin" { 28_800 } else { 31_536_000 };
    sqlx::query("INSERT INTO sessions(token_hash, role, visitor_id, csrf, credential_fingerprint, expires_at) VALUES($1,$2,$3,$4,$5,now() + make_interval(secs => $6))")
        .bind(digest(&token)).bind(role).bind(visitor).bind(&csrf).bind(&state.config.credential_fingerprint).bind(seconds as f64).execute(&state.pool).await?;
    let mut response = Json(json!({"csrf":csrf,"uid":visitor})).into_response();
    let cookie = format!(
        "{}want-{role}={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={seconds}{}",
        if state.config.production {
            "__Host-"
        } else {
            ""
        },
        if state.config.production {
            "; Secure"
        } else {
            ""
        }
    );
    response.headers_mut().insert(
        header::SET_COOKIE,
        HeaderValue::from_str(&cookie).map_err(|_| ApiError::invalid())?,
    );
    Ok(response)
}
pub async fn visitor_session(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
) -> Result<Response> {
    origin(&state, &headers)?;
    if let Ok(current) = session(&state, &headers, "visitor").await {
        return Ok(Json(json!({"csrf":current.csrf,"uid":current.visitor})).into_response());
    }
    limit(
        &state,
        &format!("visitor:{}", client_ip(&state, &headers, peer)),
        100,
        3600,
    )
    .await?;
    let visitor = Uuid::new_v4();
    sqlx::query("INSERT INTO visitors(id) VALUES($1)")
        .bind(visitor)
        .execute(&state.pool)
        .await?;
    issue(&state, "visitor", Some(visitor)).await
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Login {
    username: String,
    password: String,
    code: String,
}
pub async fn login(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(input): Json<Login>,
) -> Result<Response> {
    origin(&state, &headers)?;
    limit(
        &state,
        &format!("login:{}", client_ip(&state, &headers, peer)),
        5,
        900,
    )
    .await?;
    limit(&state, "login:account", 50, 900).await?;
    text(&input.username, 1, 100)?;
    text(&input.password, 1, 1024)?;
    if input.code.len() != 6 || !input.code.bytes().all(|c| c.is_ascii_digit()) {
        return Err(ApiError::unauthorized());
    }
    let _permit = state
        .login_slots
        .clone()
        .try_acquire_owned()
        .map_err(|_| ApiError(axum::http::StatusCode::TOO_MANY_REQUESTS, "rate-limited"))?;
    let password = input.password;
    let hash = state.config.admin_hash.clone();
    let valid_password = tokio::task::spawn_blocking(move || {
        PasswordHash::new(&hash).is_ok_and(|hash| {
            Argon2::default()
                .verify_password(password.as_bytes(), &hash)
                .is_ok()
        })
    })
    .await
    .map_err(|_| ApiError::unauthorized())?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| ApiError::unauthorized())?
        .as_secs();
    let step = (now / 30).saturating_sub(1)..=(now / 30 + 1);
    let accepted = step
        .into_iter()
        .find(|step| equal(&state.config.totp.generate(step * 30), &input.code));
    if !valid_password
        || !equal(&input.username, &state.config.admin_username)
        || accepted.is_none()
    {
        return Err(ApiError::unauthorized());
    }
    let mut transaction = state.pool.begin().await?;
    let accepted: Option<i64> = sqlx::query_scalar("INSERT INTO admin_totp(credential_fingerprint,last_step) VALUES($1,$2) ON CONFLICT(credential_fingerprint) DO UPDATE SET last_step = excluded.last_step WHERE admin_totp.last_step < excluded.last_step RETURNING last_step")
        .bind(&state.config.credential_fingerprint).bind(accepted.unwrap_or_default() as i64).fetch_optional(&mut *transaction).await?;
    if accepted.is_none() {
        return Err(ApiError::unauthorized());
    }
    if let Some(old) = cookie(&state, &headers, "admin") {
        sqlx::query("DELETE FROM sessions WHERE token_hash=$1 AND role='admin'")
            .bind(digest(&old))
            .execute(&mut *transaction)
            .await?;
    }
    sqlx::query("INSERT INTO audit_log(action,target,actor) VALUES('login','session','admin')")
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await?;
    issue(&state, "admin", None).await
}
pub async fn admin_session(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>> {
    admin_access(&state, &headers, false).await?;
    let current = session(&state, &headers, "admin").await?;
    Ok(Json(
        json!({"csrf":current.csrf,"username":state.config.admin_username}),
    ))
}
pub async fn logout(State(state): State<AppState>, headers: HeaderMap) -> Result<Response> {
    let current = mutation(&state, &headers, "admin").await?;
    sqlx::query("DELETE FROM sessions WHERE token_hash=$1")
        .bind(current.hash)
        .execute(&state.pool)
        .await?;
    let mut response = Json(json!({"ok":true})).into_response();
    response.headers_mut().insert(
        header::SET_COOKIE,
        HeaderValue::from_static(if state.config.production {
            "__Host-want-admin=; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=0"
        } else {
            "want-admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"
        }),
    );
    Ok(response)
}
