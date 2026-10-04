use argon2::{Argon2, PasswordHasher, password_hash::SaltString};
use axum::{
    Router,
    body::Body,
    extract::ConnectInfo,
    http::{Request, StatusCode, header},
};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use sqlx::PgPool;
use std::{collections::HashMap, net::SocketAddr, sync::Arc};
use totp_rs::{Algorithm, TOTP};
use tower::ServiceExt;
use uuid::Uuid;
use want_wallpapers_server::{
    AppState,
    auth::{self, CatalogActor},
    catalog,
    config::Config,
    models::Manifest,
    moderation, router,
};

const PASSWORD: &str = "test-only-password-for-http-checks";
const TOKEN: &str = "test-only-catalog-token-with-32-characters";
const SITE: &str = "http://127.0.0.1:4322";
fn state(pool: PgPool) -> AppState {
    let salt = SaltString::generate(&mut rand::rngs::OsRng);
    let hash = Argon2::default()
        .hash_password(PASSWORD.as_bytes(), &salt)
        .unwrap()
        .to_string();
    AppState {
        pool,
        config: Arc::new(Config {
            site: SITE.into(),
            production: false,
            bind: "127.0.0.1:8080".parse().unwrap(),
            static_dir: "../frontend/dist".into(),
            admin_username: "admin".into(),
            credential_fingerprint: auth::digest(&hash),
            admin_hash: hash,
            totp: TOTP::new(Algorithm::SHA1, 6, 1, 30, vec![42; 20]).unwrap(),
            catalog_token_hash: auth::digest(TOKEN),
            trusted_proxies: vec!["10.0.0.0/24".parse().unwrap()],
        }),
        csp_hashes: Arc::new(HashMap::new()),
        login_slots: Arc::new(tokio::sync::Semaphore::new(2)),
    }
}
async fn request(
    app: &Router,
    method: &str,
    path: &str,
    input: Option<Value>,
    cookie: Option<&str>,
    csrf: Option<&str>,
    token: Option<&str>,
) -> (StatusCode, Value, Option<String>) {
    let mut builder = Request::builder()
        .method(method)
        .uri(path)
        .header("origin", SITE)
        .header("content-type", "application/json");
    if let Some(cookie) = cookie {
        builder = builder.header("cookie", cookie);
    }
    if let Some(csrf) = csrf {
        builder = builder.header("x-csrf-token", csrf);
    }
    if let Some(token) = token {
        builder = builder.header("authorization", format!("Bearer {token}"));
    }
    let mut request = builder
        .body(Body::from(input.map(|v| v.to_string()).unwrap_or_default()))
        .unwrap();
    request.extensions_mut().insert(ConnectInfo(
        "127.0.0.1:31000".parse::<SocketAddr>().unwrap(),
    ));
    let response = app.clone().oneshot(request).await.unwrap();
    let status = response.status();
    let cookie = response
        .headers()
        .get(header::SET_COOKIE)
        .map(|v| v.to_str().unwrap().to_owned());
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
        cookie,
    )
}
async fn visitor(app: &Router) -> (String, String, Uuid) {
    let (status, value, cookie) =
        request(app, "POST", "/api/v1/session", None, None, None, None).await;
    assert_eq!(status, StatusCode::OK);
    let cookie = cookie.unwrap();
    assert!(cookie.contains("HttpOnly") && cookie.contains("SameSite=Strict"));
    (
        cookie.split(';').next().unwrap().into(),
        value["csrf"].as_str().unwrap().into(),
        value["uid"].as_str().unwrap().parse().unwrap(),
    )
}
async fn admin(app: &Router, state: &AppState) -> (String, String) {
    let code = state.config.totp.generate_current().unwrap();
    let (status, _, cookie) = request(
        app,
        "POST",
        "/api/v1/admin/login",
        Some(json!({"username":"admin","password":PASSWORD,"code":code})),
        None,
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let cookie = cookie.unwrap().split(';').next().unwrap().to_owned();
    let (status, value, _) = request(
        app,
        "GET",
        "/api/v1/admin/session",
        None,
        Some(&cookie),
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    (cookie, value["csrf"].as_str().unwrap().into())
}
fn manifest() -> Manifest {
    let snapshot: SnapshotForTest =
        serde_json::from_str(include_str!("../data/catalog.json")).unwrap();
    let mut collection = snapshot.collections[2].clone();
    collection.id = "0004-test-light".into();
    collection.slug = "test-light".into();
    collection.count = 2;
    let wallpapers = snapshot
        .wallpapers
        .iter()
        .take(2)
        .enumerate()
        .map(|(i, w)| {
            let mut w = w.clone();
            w.id = format!("test-light-{}", i + 1);
            w.slug = w.id.clone();
            w.number = i as i64 + 1;
            w.collection = collection.slug.clone();
            w.collection_id = collection.id.clone();
            w.s3_folder = collection.id.clone();
            w.file_stem = collection.slug.clone();
            w
        })
        .collect();
    Manifest {
        collection,
        wallpapers,
    }
}
#[derive(serde::Deserialize)]
struct SnapshotForTest {
    collections: Vec<want_wallpapers_server::models::Collection>,
    wallpapers: Vec<want_wallpapers_server::models::Wallpaper>,
}

#[sqlx::test(migrations = "./migrations")]
async fn imports_are_atomic_idempotent_and_reserve_numeric_folders(pool: PgPool) {
    let visitor = Uuid::new_v4();
    sqlx::query("INSERT INTO visitors(id) VALUES($1)")
        .bind(visitor)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO ratings(wallpaper_id,visitor_id,value) VALUES('contours-of-silence-1',$1,'imba')").bind(visitor).execute(&pool).await.unwrap();
    let input = manifest();
    let (first, second) = tokio::join!(
        catalog::import_manifest(&pool, &input, CatalogActor::Token),
        catalog::import_manifest(&pool, &input, CatalogActor::Token)
    );
    let mut results = vec![first.unwrap(), second.unwrap()];
    results.sort();
    assert_eq!(results, vec!["created", "unchanged"]);
    let before: i64 = sqlx::query_scalar("SELECT version FROM collections WHERE id=$1")
        .bind(&input.collection.id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(
        catalog::import_manifest(&pool, &input, CatalogActor::Token)
            .await
            .unwrap(),
        "unchanged"
    );
    let after: i64 = sqlx::query_scalar("SELECT version FROM collections WHERE id=$1")
        .bind(&input.collection.id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(before, after);
    let mut different = input.clone();
    different.wallpapers[0]
        .title
        .insert("en".into(), "Changed".into());
    assert_eq!(
        catalog::import_manifest(&pool, &different, CatalogActor::Token)
            .await
            .unwrap_err()
            .0,
        StatusCode::CONFLICT
    );
    let mut reused = manifest();
    reused.collection.id = "4-another-name".into();
    reused.collection.slug = "another-name".into();
    for w in &mut reused.wallpapers {
        w.collection_id = reused.collection.id.clone();
        w.s3_folder = reused.collection.id.clone();
        w.collection = reused.collection.slug.clone();
        w.file_stem = w.collection.clone();
        w.id = format!("{}-{}", w.collection, w.number);
        w.slug = w.id.clone();
    }
    assert_eq!(
        catalog::import_manifest(&pool, &reused, CatalogActor::Token)
            .await
            .unwrap_err()
            .0,
        StatusCode::CONFLICT
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM ratings")
            .fetch_one(&pool)
            .await
            .unwrap(),
        1
    );
    let mut partial = manifest();
    partial.collection.id = "0005-partial-light".into();
    partial.collection.slug = "partial-light".into();
    for w in &mut partial.wallpapers {
        w.collection_id = partial.collection.id.clone();
        w.s3_folder = partial.collection.id.clone();
        w.collection = partial.collection.slug.clone();
        w.file_stem = w.collection.clone();
        w.id = format!("{}-{}", w.collection, w.number);
        w.slug = w.id.clone();
    }
    sqlx::query("INSERT INTO collections(id,folder_number,slug,data) VALUES($1,5,$2,$3)")
        .bind(&partial.collection.id)
        .bind(&partial.collection.slug)
        .bind(json!(partial.collection))
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(
        catalog::import_manifest(&pool, &partial, CatalogActor::Token)
            .await
            .unwrap_err()
            .0,
        StatusCode::CONFLICT
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM wallpapers WHERE collection_id=$1")
            .bind(&partial.collection.id)
            .fetch_one(&pool)
            .await
            .unwrap(),
        0
    );
    let export = catalog::export(&pool).await.unwrap();
    assert_eq!(export.wallpapers.len(), 27);
}

#[sqlx::test(migrations = "./migrations")]
async fn public_api_enforces_csrf_ownership_and_atomic_cooldown(pool: PgPool) {
    let state = state(pool.clone());
    let app = router(state);
    let (cookie, csrf, uid) = visitor(&app).await;
    let (other, other_csrf, _) = visitor(&app).await;
    let path = "/api/v1/wallpapers/contours-of-silence-1";
    assert_eq!(
        request(
            &app,
            "PUT",
            &format!("{path}/rating"),
            Some(json!({"value":"imba"})),
            Some(&cookie),
            Some("wrong"),
            None
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        request(
            &app,
            "PUT",
            &format!("{path}/rating"),
            Some(json!({"value":"invalid"})),
            Some(&cookie),
            Some(&csrf),
            None
        )
        .await
        .0,
        StatusCode::UNPROCESSABLE_ENTITY
    );
    for value in ["imba", "plus"] {
        assert_eq!(
            request(
                &app,
                "PUT",
                &format!("{path}/rating"),
                Some(json!({"value":value})),
                Some(&cookie),
                Some(&csrf),
                None
            )
            .await
            .0,
            StatusCode::OK
        );
    }
    let (_, social, _) = request(
        &app,
        "GET",
        &format!("{path}/social"),
        None,
        Some(&cookie),
        None,
        None,
    )
    .await;
    assert_eq!(social["ownUid"], uid.to_string());
    assert_eq!(social["ownRating"], "plus");
    assert_eq!(social["counts"]["plus"], 1);
    assert_eq!(social["counts"]["imba"], 0);
    let comments_path = format!("{path}/comments");
    let (one, two) = tokio::join!(
        request(
            &app,
            "POST",
            &comments_path,
            Some(json!({"text":"A calm horizon"})),
            Some(&cookie),
            Some(&csrf),
            None
        ),
        request(
            &app,
            "POST",
            &comments_path,
            Some(json!({"text":"A calm horizon"})),
            Some(&cookie),
            Some(&csrf),
            None
        )
    );
    assert!(one.0 == StatusCode::OK || two.0 == StatusCode::OK);
    assert!(one.0 == StatusCode::CONFLICT || two.0 == StatusCode::CONFLICT);
    let comment = if one.0 == StatusCode::OK {
        one.1["id"].as_str().unwrap()
    } else {
        two.1["id"].as_str().unwrap()
    };
    let comment_path = format!("{path}/comments/{comment}");
    assert_eq!(
        request(
            &app,
            "DELETE",
            &comment_path,
            None,
            Some(&other),
            Some(&other_csrf),
            None
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        request(
            &app,
            "POST",
            &format!("{comment_path}/report"),
            None,
            Some(&other),
            Some(&other_csrf),
            None
        )
        .await
        .0,
        StatusCode::OK
    );
    assert_eq!(
        request(
            &app,
            "POST",
            &format!("{comment_path}/report"),
            None,
            Some(&other),
            Some(&other_csrf),
            None
        )
        .await
        .0,
        StatusCode::OK
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM reports")
            .fetch_one(&pool)
            .await
            .unwrap(),
        1
    );
    assert_eq!(
        request(
            &app,
            "DELETE",
            &comment_path,
            None,
            Some(&cookie),
            Some(&csrf),
            None
        )
        .await
        .0,
        StatusCode::OK
    );
    let second = request(
        &app,
        "POST",
        &format!("{path}/comments"),
        Some(json!({"text":"Again after deletion"})),
        Some(&cookie),
        Some(&csrf),
        None,
    )
    .await;
    assert_eq!(second.1["error"]["code"], "comment-cooldown");
    assert_eq!(
        request(&app, "GET", "/api/v1/missing", None, None, None, None)
            .await
            .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        request(
            &app,
            "POST",
            "/api/v1/feedback",
            Some(json!({"topic":"x","message":"short","email":""})),
            None,
            None,
            Some(TOKEN)
        )
        .await
        .0,
        StatusCode::UNAUTHORIZED
    );
}

#[sqlx::test(migrations = "./migrations")]
async fn administrator_token_scope_totp_replay_versions_and_retention(pool: PgPool) {
    let state = state(pool.clone());
    let app = router(state.clone());
    let (cookie, csrf) = admin(&app, &state).await;
    assert_eq!(request(&app,"POST","/api/v1/admin/login",Some(json!({"username":"admin","password":PASSWORD,"code":state.config.totp.generate_current().unwrap()})),None,None,None).await.0,StatusCode::UNAUTHORIZED);
    assert_eq!(
        request(
            &app,
            "GET",
            "/api/v1/admin/moderation/feedback",
            None,
            None,
            None,
            Some(TOKEN)
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        request(
            &app,
            "GET",
            "/api/v1/admin/catalog",
            None,
            None,
            None,
            Some(TOKEN)
        )
        .await
        .0,
        StatusCode::OK
    );
    let (_, catalog, _) = request(
        &app,
        "GET",
        "/api/v1/admin/catalog",
        None,
        Some(&cookie),
        None,
        None,
    )
    .await;
    let mut item = catalog["collections"][0]["item"].clone();
    item["title"]["en"] = json!("Updated title");
    let input = json!({"item":item,"version":1});
    assert_eq!(
        request(
            &app,
            "PUT",
            "/api/v1/admin/catalog/collections",
            Some(input.clone()),
            Some(&cookie),
            Some("wrong"),
            None
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        request(
            &app,
            "PUT",
            "/api/v1/admin/catalog/collections",
            Some(input.clone()),
            Some(&cookie),
            Some(&csrf),
            None
        )
        .await
        .0,
        StatusCode::OK
    );
    assert_eq!(
        request(
            &app,
            "PUT",
            "/api/v1/admin/catalog/collections",
            Some(input),
            Some(&cookie),
            Some(&csrf),
            None
        )
        .await
        .0,
        StatusCode::CONFLICT
    );
    let (visitor, visitor_csrf, _) = visitor(&app).await;
    let (_,feedback,_)=request(&app,"POST","/api/v1/feedback",Some(json!({"topic":"Colours","message":"Please add warm colours","email":"visitor@example.test"})),Some(&visitor),Some(&visitor_csrf),None).await;
    let id = feedback["id"].as_str().unwrap();
    let path = format!("/api/v1/admin/moderation/feedback/{id}");
    assert_eq!(
        request(
            &app,
            "PATCH",
            &path,
            Some(json!({"version":1,"status":"closed"})),
            Some(&cookie),
            Some(&csrf),
            None
        )
        .await
        .0,
        StatusCode::OK
    );
    sqlx::query("UPDATE feedback SET closed_at=now()-interval '2 years' WHERE id=$1")
        .bind(id.parse::<Uuid>().unwrap())
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(
        request(
            &app,
            "PATCH",
            &path,
            Some(json!({"version":2,"status":"open"})),
            Some(&cookie),
            Some(&csrf),
            None
        )
        .await
        .0,
        StatusCode::OK
    );
    moderation::cleanup(&pool).await.unwrap();
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM feedback")
            .fetch_one(&pool)
            .await
            .unwrap(),
        1
    );
    sqlx::query("UPDATE feedback SET status='closed',closed_at=now()-interval '2 years'")
        .execute(&pool)
        .await
        .unwrap();
    moderation::cleanup(&pool).await.unwrap();
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM feedback")
            .fetch_one(&pool)
            .await
            .unwrap(),
        0
    );
    let (_, session, _) = request(
        &app,
        "GET",
        "/api/v1/admin/session",
        None,
        Some(&cookie),
        None,
        None,
    )
    .await;
    assert!(!session["csrf"].as_str().unwrap().is_empty());
    sqlx::query("UPDATE sessions SET last_seen=now()-interval '31 minutes' WHERE role='admin'")
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(
        request(
            &app,
            "GET",
            "/api/v1/admin/session",
            None,
            Some(&cookie),
            None,
            None
        )
        .await
        .0,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        request(
            &app,
            "GET",
            "/api/v1/admin/catalog",
            None,
            Some(&cookie),
            None,
            Some("wrong")
        )
        .await
        .0,
        StatusCode::UNAUTHORIZED
    );
}

#[sqlx::test(migrations = "./migrations")]
async fn archive_preserves_social_data_and_abuse_limits_cannot_trust_client_forwarding(
    pool: PgPool,
) {
    let state = state(pool.clone());
    let app = router(state.clone());
    let (cookie, csrf, _) = visitor(&app).await;
    request(
        &app,
        "PUT",
        "/api/v1/wallpapers/contours-of-silence-1/rating",
        Some(json!({"value":"imba"})),
        Some(&cookie),
        Some(&csrf),
        None,
    )
    .await;
    for (version, archived) in [(1, true), (2, false)] {
        assert_eq!(
            request(
                &app,
                "PATCH",
                "/api/v1/admin/catalog/wallpapers/contours-of-silence-1/archive",
                Some(json!({"version":version,"archived":archived})),
                None,
                None,
                Some(TOKEN)
            )
            .await
            .0,
            StatusCode::OK
        );
        let snapshot = catalog::export(&pool).await.unwrap();
        assert_eq!(snapshot.wallpapers.len(), if archived { 24 } else { 25 });
        assert_eq!(
            snapshot.collections[0].count,
            if archived { 14 } else { 15 }
        );
    }
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM ratings")
            .fetch_one(&pool)
            .await
            .unwrap(),
        1
    );
    let mut headers = axum::http::HeaderMap::new();
    headers.insert("x-forwarded-for", "192.0.2.1, 10.0.0.2".parse().unwrap());
    assert_eq!(
        auth::client_ip(&state, &headers, "127.0.0.1:123".parse().unwrap()),
        "127.0.0.1".parse::<std::net::IpAddr>().unwrap()
    );
    assert_eq!(
        auth::client_ip(&state, &headers, "10.0.0.3:123".parse().unwrap()),
        "192.0.2.1".parse::<std::net::IpAddr>().unwrap()
    );
    for _ in 0..5 {
        auth::limit(&state, "attempt", 5, 900).await.unwrap();
    }
    assert_eq!(
        auth::limit(&state, "attempt", 5, 900).await.unwrap_err().0,
        StatusCode::TOO_MANY_REQUESTS
    );
    let mut request = Request::builder()
        .method("POST")
        .uri("/api/v1/session")
        .header("origin", "https://other.example")
        .body(Body::empty())
        .unwrap();
    request.extensions_mut().insert(ConnectInfo(
        "127.0.0.1:31000".parse::<SocketAddr>().unwrap(),
    ));
    assert_eq!(
        app.oneshot(request).await.unwrap().status(),
        StatusCode::FORBIDDEN
    );
}

#[test]
fn boundary_validation_rejects_unknown_fields_locales_and_cdn_paths() {
    let valid = manifest();
    valid.validate().unwrap();
    let mut invalid = valid.clone();
    invalid.wallpapers[0].s3_folder = "../private".into();
    assert!(invalid.validate().is_err());
    let mut invalid = valid.clone();
    invalid.collection.title.remove("ru");
    assert!(invalid.validate().is_err());
    let mut invalid = valid.clone();
    invalid.wallpapers[1].number = invalid.wallpapers[0].number;
    assert!(invalid.validate().is_err());
    let mut value = json!(valid);
    value["collection"]["extra"] = json!(true);
    assert!(serde_json::from_value::<Manifest>(value).is_err());
}

#[sqlx::test(migrations = "./migrations")]
async fn collection_capacity_and_private_route_boundaries(pool: PgPool) {
    let app = router(state(pool.clone()));
    let mut wallpaper = catalog::export(&pool).await.unwrap().wallpapers[0].clone();
    sqlx::query("UPDATE collections SET data=jsonb_set(data,'{count}','1000') WHERE id=$1")
        .bind(&wallpaper.collection_id)
        .execute(&pool)
        .await
        .unwrap();
    wallpaper.number = 1001;
    wallpaper.id = format!("{}-1001", wallpaper.collection);
    wallpaper.slug = wallpaper.id.clone();
    assert_eq!(
        request(
            &app,
            "PUT",
            "/api/v1/admin/catalog/wallpapers",
            Some(json!({"item":wallpaper,"version":null})),
            None,
            None,
            Some(TOKEN)
        )
        .await
        .0,
        StatusCode::UNPROCESSABLE_ENTITY
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM wallpapers")
            .fetch_one(&pool)
            .await
            .unwrap(),
        25
    );
    for path in ["/api", "/api/unknown", "/health", "/health/unknown"] {
        let (status, body, _) = request(&app, "GET", path, None, None, None, None).await;
        assert_eq!(status, StatusCode::NOT_FOUND);
        assert_eq!(body["error"]["code"], "not-found");
    }
    let response = app
        .oneshot(
            Request::builder()
                .uri("/admin")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.headers()["cache-control"], "no-store");
    assert!(
        response.headers()["x-robots-tag"]
            .to_str()
            .unwrap()
            .contains("noindex")
    );
}
