use crate::{
    AppState, auth,
    error::{ApiError, Result},
};
use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode},
};
use google_cloud_gax::{options::RequestOptionsBuilder, retry_policy::NeverRetry};
use google_cloud_recaptchaenterprise_v1::model::{Assessment, Event};
use serde_json::{Value, json};
use std::{env, net::SocketAddr, path::Path, time::Duration};

pub struct Settings {
    pub project: String,
    pub site_key: String,
    pub min_score: f32,
}
impl Settings {
    pub fn load(
        production: bool,
    ) -> std::result::Result<Option<Self>, Box<dyn std::error::Error + Send + Sync>> {
        let enabled = env::var("RECAPTCHA_ENABLED")
            .unwrap_or_else(|_| production.to_string())
            .parse::<bool>()
            .map_err(|_| "RECAPTCHA_ENABLED must be true or false")?;
        if !enabled {
            if production {
                return Err("Production requires reCAPTCHA".into());
            }
            return Ok(None);
        }
        let required =
            |name: &str| -> std::result::Result<String, Box<dyn std::error::Error + Send + Sync>> {
                let value = env::var(name).unwrap_or_default().trim().to_owned();
                if value.is_empty() {
                    return Err(format!("{name} is required").into());
                }
                Ok(value)
            };
        let project = required("RECAPTCHA_PROJECT_ID")?;
        let site_key = required("PUBLIC_RECAPTCHA_SITE_KEY")?;
        let min_score = env::var("RECAPTCHA_MIN_SCORE")
            .unwrap_or_else(|_| "0.5".into())
            .parse::<f32>()
            .map_err(|_| "Invalid RECAPTCHA_MIN_SCORE")?;
        if !min_score.is_finite() || !(0.0..=1.0).contains(&min_score) {
            return Err("RECAPTCHA_MIN_SCORE must be between 0 and 1".into());
        }
        let credentials = required("GOOGLE_APPLICATION_CREDENTIALS")?;
        if !Path::new(&credentials).is_file() {
            return Err("Google credentials file is required".into());
        }
        Ok(Some(Self {
            project,
            site_key,
            min_score,
        }))
    }
}
pub async fn public_config(State(state): State<AppState>) -> Json<Value> {
    Json(
        json!({"enabled": state.config.recaptcha.is_some(), "siteKey": state.config.recaptcha.as_ref().map(|settings| &settings.site_key)}),
    )
}
fn rejected() -> ApiError {
    ApiError(StatusCode::FORBIDDEN, "recaptcha-rejected")
}
fn unavailable() -> ApiError {
    ApiError(StatusCode::SERVICE_UNAVAILABLE, "recaptcha-unavailable")
}
fn accept(
    assessment: &Assessment,
    settings: &Settings,
    action: &str,
    hostname: &str,
) -> Result<()> {
    let properties = assessment.token_properties.as_ref().ok_or_else(rejected)?;
    let risk = assessment.risk_analysis.as_ref().ok_or_else(rejected)?;
    if !properties.valid
        || properties.action != action
        || properties.hostname != hostname
        || !risk.score.is_finite()
        || !(settings.min_score..=1.0).contains(&risk.score)
    {
        return Err(rejected());
    }
    Ok(())
}
pub async fn verify(
    state: &AppState,
    headers: &HeaderMap,
    peer: SocketAddr,
    action: &str,
) -> Result<()> {
    let Some(settings) = &state.config.recaptcha else {
        return if state.config.production {
            Err(unavailable())
        } else {
            Ok(())
        };
    };
    let token = headers
        .get("x-recaptcha-token")
        .and_then(|value| value.to_str().ok())
        .filter(|value| !value.trim().is_empty())
        .ok_or(ApiError(StatusCode::BAD_REQUEST, "recaptcha-required"))?;
    let client = state.recaptcha.as_ref().ok_or_else(unavailable)?;
    let hostname = url::Url::parse(&state.config.site).map_err(|_| unavailable())?;
    let hostname = hostname.host_str().ok_or_else(unavailable)?;
    let event = Event::new()
        .set_token(token)
        .set_site_key(&settings.site_key)
        .set_expected_action(action)
        .set_user_agent(
            headers
                .get("user-agent")
                .and_then(|value| value.to_str().ok())
                .unwrap_or_default(),
        )
        .set_user_ip_address(auth::client_ip(state, headers, peer).to_string());
    let request = client
        .create_assessment()
        .set_parent(format!("projects/{}", settings.project))
        .set_assessment(Assessment::new().set_event(event))
        .with_retry_policy(NeverRetry)
        .with_attempt_timeout(Duration::from_secs(5))
        .send();
    let assessment = tokio::time::timeout(Duration::from_secs(5), request)
        .await
        .map_err(|_| unavailable())?
        .map_err(|_| {
            tracing::warn!(action, "reCAPTCHA assessment unavailable");
            unavailable()
        })?;
    accept(&assessment, settings, action, hostname)
}
