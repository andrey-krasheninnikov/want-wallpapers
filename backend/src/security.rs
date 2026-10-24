use crate::AppState;
use axum::{
    extract::{Request, State},
    http::{HeaderValue, StatusCode, header},
    middleware::Next,
    response::{IntoResponse, Response},
};
use serde_json::json;

pub(crate) fn is_api_path(path: &str) -> bool {
    path == "/api" || path.starts_with("/api/") || path == "/health" || path.starts_with("/health/")
}

pub async fn headers(State(state): State<AppState>, request: Request, next: Next) -> Response {
    let path = request.uri().path().to_owned();
    let api = is_api_path(&path);
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
    let html = response
        .headers()
        .get(header::CONTENT_TYPE)
        .is_some_and(|value| value.to_str().unwrap_or_default().starts_with("text/html"));
    let dynamic = response
        .extensions()
        .get::<crate::discovery::DynamicHashes>();
    let hashes = dynamic.map(|value| &value.0).unwrap_or(&state.csp_hashes);
    let csp = content_security_policy(&path, response.status(), html, hashes);
    let dynamic = dynamic.is_some();
    let llms = path == "/llms.txt" && response.status().is_success();
    let no_store = response
        .headers()
        .get(header::CACHE_CONTROL)
        .is_some_and(|value| value == "no-store");
    let headers = response.headers_mut();
    if llms {
        headers.insert(
            header::CONTENT_TYPE,
            HeaderValue::from_static("text/plain; charset=utf-8"),
        );
    }
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
    let cache = if api || admin || dynamic || no_store {
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

fn advertising_path(path: &str) -> bool {
    let path = path
        .strip_suffix("index.html")
        .unwrap_or(path)
        .trim_end_matches('/');
    let path = ["/ru", "/zh-cn", "/pt-br", "/ja", "/ar"]
        .iter()
        .find_map(|prefix| {
            path.strip_prefix(prefix)
                .filter(|rest| rest.is_empty() || rest.starts_with('/'))
        })
        .unwrap_or(path);
    let parts: Vec<_> = path.trim_start_matches('/').split('/').collect();
    match parts.as_slice() {
        [""] => true,
        [
            "collections" | "search" | "feedback" | "privacy" | "terms" | "cookies" | "license"
            | "contact",
        ] => true,
        ["collections" | "wallpapers", slug] => {
            !slug.is_empty()
                && slug.split('-').all(|part| {
                    !part.is_empty()
                        && part
                            .bytes()
                            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
                })
        }
        _ => false,
    }
}

fn content_security_policy(
    path: &str,
    status: StatusCode,
    html: bool,
    hashes: &std::collections::HashMap<String, Vec<String>>,
) -> String {
    let admin = path == "/admin" || path.starts_with("/admin/");
    let mut scripts = String::from("'self'");
    let route = if status == StatusCode::NOT_FOUND {
        crate::not_found_route(path)
    } else {
        path
    };
    if let Some(hashes) = hashes.get(route) {
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
        "'self' https://ipwho.is https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://firebase.googleapis.com https://firebaseinstallations.googleapis.com"
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
    let advertising = (status.is_success() && html || status == StatusCode::NOT_MODIFIED)
        && hashes.contains_key(route)
        && advertising_path(path);
    let provider_scripts = if advertising {
        " https://massivesalad.com https://phoroglopsu.com"
    } else {
        ""
    };
    let ad_frames = if advertising {
        " https://massivesalad.com"
    } else {
        ""
    };
    format!(
        "default-src 'self'; script-src {scripts}{analytics}{captcha_scripts}{provider_scripts}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://want-foundation.s3.twcstorage.ru{analytics}; media-src https://want-foundation.s3.twcstorage.ru; font-src 'self'; connect-src {connect}{captcha_connect}; frame-src {frames}{ad_frames}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn analytics_configuration_is_allowed_only_on_public_pages() {
        for path in ["/", "/ru/", "/ar/wallpapers/contours-of-silence-1/"] {
            let csp = content_security_policy(path, StatusCode::OK, true, &HashMap::new());
            let connect = csp
                .split("; ")
                .find(|value| value.starts_with("connect-src "))
                .unwrap();
            assert!(connect.contains("https://firebase.googleapis.com "));
            assert!(
                !csp.split("; ")
                    .find(|value| value.starts_with("script-src "))
                    .unwrap()
                    .contains("firebase.googleapis.com")
            );
        }
        for path in ["/admin", "/admin/", "/admin/login/"] {
            let csp = content_security_policy(path, StatusCode::OK, true, &HashMap::new());
            assert!(!csp.contains("firebase.googleapis.com"));
        }
    }

    #[test]
    fn advertising_csp_is_limited_to_known_successful_public_documents() {
        for prefix in ["", "/ru", "/zh-cn", "/pt-br", "/ja", "/ar"] {
            for route in [
                "/",
                "/collections/",
                "/collections/contours-of-silence/",
                "/wallpapers/contours-of-silence-1/",
                "/search/",
                "/feedback/",
                "/privacy/",
                "/terms/",
                "/cookies/",
                "/license/",
                "/contact/",
            ] {
                let route = format!("{prefix}{route}");
                for path in [
                    route.clone(),
                    format!("{route}index.html"),
                    route.trim_end_matches('/').to_owned(),
                ] {
                    let hashes = HashMap::from([(path.clone(), vec!["sha256-test".into()])]);
                    for status in [StatusCode::OK, StatusCode::NOT_MODIFIED] {
                        let csp = content_security_policy(
                            &path,
                            status,
                            status == StatusCode::OK,
                            &hashes,
                        );
                        assert!(
                            !csp.contains("'unsafe-eval'") && !csp.contains("script-src-elem"),
                            "{path}"
                        );
                        assert!(
                            csp.contains("https://massivesalad.com")
                                && csp.contains("https://phoroglopsu.com")
                        );
                        assert!(
                            csp.contains("frame-ancestors 'none'")
                                && csp.contains("object-src 'none'")
                        );
                        assert!(!csp.contains("https:;") && !csp.contains("script-src *"));
                    }
                    for (status, html) in [
                        (StatusCode::NOT_FOUND, true),
                        (StatusCode::INTERNAL_SERVER_ERROR, true),
                        (StatusCode::OK, false),
                        (StatusCode::TEMPORARY_REDIRECT, true),
                    ] {
                        assert!(
                            !content_security_policy(&path, status, html, &hashes)
                                .contains("massivesalad")
                        );
                    }
                    assert!(
                        !content_security_policy(&path, StatusCode::OK, true, &HashMap::new())
                            .contains("massivesalad")
                    );
                }
            }
            for route in [
                "/404/",
                "/404.html",
                "/ui-kit/",
                "/admin/",
                "/admin/login/",
                "/api/v1/catalog",
                "/health/ready",
                "/_astro/app.js",
                "/downloads/example.png",
                "/wallpapers/not/a/page/",
                "/unknown/",
            ] {
                let path = format!("{prefix}{route}");
                let hashes = HashMap::from([(path.clone(), vec![])]);
                let csp = content_security_policy(&path, StatusCode::OK, true, &hashes);
                assert!(
                    !csp.contains("massivesalad")
                        && !csp.contains("phoroglopsu")
                        && !csp.contains("unsafe-eval")
                        && !csp.contains("script-src-elem"),
                    "{path}"
                );
            }
        }
    }
}
