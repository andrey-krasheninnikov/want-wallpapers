use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;

#[derive(Debug)]
pub struct ApiError(pub StatusCode, pub &'static str);
pub type Result<T> = std::result::Result<T, ApiError>;
impl ApiError {
    pub fn invalid() -> Self {
        Self(StatusCode::UNPROCESSABLE_ENTITY, "invalid-input")
    }
    pub fn conflict() -> Self {
        Self(StatusCode::CONFLICT, "conflict")
    }
    pub fn unauthorized() -> Self {
        Self(StatusCode::UNAUTHORIZED, "unauthorized")
    }
    pub fn forbidden() -> Self {
        Self(StatusCode::FORBIDDEN, "forbidden")
    }
    pub fn missing() -> Self {
        Self(StatusCode::NOT_FOUND, "not-found")
    }
}
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.0, Json(json!({"error": {"code": self.1}}))).into_response()
    }
}
impl From<sqlx::Error> for ApiError {
    fn from(error: sqlx::Error) -> Self {
        if let sqlx::Error::Database(ref database) = error
            && (database.is_unique_violation()
                || database.is_foreign_key_violation()
                || database.is_check_violation())
        {
            return Self::conflict();
        }
        tracing::error!("database operation failed");
        Self(StatusCode::SERVICE_UNAVAILABLE, "unavailable")
    }
}
