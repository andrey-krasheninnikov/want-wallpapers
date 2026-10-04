use crate::AppState;
use axum::{
    extract::{Request, State},
    http::{HeaderValue, StatusCode, header},
    middleware::Next,
    response::{IntoResponse, Response},
};
use serde_json::json;

pub async fn headers(State(state): State<AppState>, request: Request, next: Next) -> Response {
    let path = request.uri().path().to_owned();
    let api = path == "/api"
        || path.starts_with("/api/")
        || path == "/health"
        || path.starts_with("/health/");
    let admin = path == "/admin" || path.starts_with("/admin/");
    // Unknown API paths must never fall through to a static HTML page.
    let mut response = next.run(request).await;
    let json_response = response
        .headers()
        .get(header::CONTENT_TYPE)
        .is_some_and(|v| {
            v.to_str()
                .unwrap_or_default()
                .starts_with("application/json")
        });
    if api && !json_response {
        let status = if response.status().is_success() {
            StatusCode::NOT_FOUND
        } else {
            response.status()
        };
        response=(status,axum::Json(json!({"error":{"code":match status {StatusCode::BAD_REQUEST|StatusCode::UNPROCESSABLE_ENTITY=>"invalid-input",StatusCode::PAYLOAD_TOO_LARGE=>"payload-too-large",StatusCode::METHOD_NOT_ALLOWED=>"method-not-allowed",StatusCode::REQUEST_TIMEOUT=>"timeout",_=>"not-found"}}}))).into_response();
    }
    let mut scripts = String::from("'self'");
    let route = if response.status() == StatusCode::NOT_FOUND {
        "/404/"
    } else {
        path.as_str()
    };
    if let Some(hashes) = state.csp_hashes.get(route) {
        for hash in hashes {
            scripts.push_str(&format!(" '{hash}'"));
        }
    }
    let analytics = if admin {
        ""
    } else {
        " https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com"
    };
    let connect = if admin {
        "'self'"
    } else {
        "'self' https://ipwho.is https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://firebaseinstallations.googleapis.com"
    };
    let captcha = !admin || path == "/admin/login/";
    let captcha_scripts = if captcha {
        " https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/"
    } else {
        ""
    };
    let captcha_connect = if captcha {
        " https://www.google.com/recaptcha/"
    } else {
        ""
    };
    let frames = if captcha {
        "https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/"
    } else {
        "'none'"
    };
    let csp = format!(
        "default-src 'self'; script-src {scripts}{analytics}{captcha_scripts}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://want-foundation.s3.twcstorage.ru{analytics}; font-src 'self'; connect-src {connect}{captcha_connect}; frame-src {frames}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
    );
    let headers = response.headers_mut();
    if let Ok(value) = HeaderValue::from_str(&csp) {
        headers.insert("content-security-policy", value);
    }
    headers.insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    headers.insert("x-frame-options", HeaderValue::from_static("DENY"));
    headers.insert(
        "referrer-policy",
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
    headers.insert(
        "permissions-policy",
        HeaderValue::from_static("camera=(), microphone=(), geolocation=()"),
    );
    if state.config.production {
        headers.insert(
            "strict-transport-security",
            HeaderValue::from_static("max-age=31536000"),
        );
    }
    let cache = if api || admin {
        "no-store"
    } else if path.starts_with("/_astro/") {
        "public, max-age=31536000, immutable"
    } else if path.starts_with("/previews/") {
        "public, max-age=604800"
    } else {
        "public, max-age=0, must-revalidate"
    };
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static(cache));
    if admin {
        headers.insert(
            "x-robots-tag",
            HeaderValue::from_static("noindex, nofollow, noarchive"),
        );
    }
    if path.starts_with("/downloads/")
        && let Some(name) = path.rsplit('/').next().filter(|name| {
            name.bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'.' || b == b'_')
        })
        && let Ok(value) = HeaderValue::from_str(&format!("attachment; filename=\"{name}\""))
    {
        headers.insert(header::CONTENT_DISPOSITION, value);
    }
    if api {
        headers.remove(header::ETAG);
    }
    response
}
