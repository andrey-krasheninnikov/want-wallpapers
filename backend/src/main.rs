use std::{collections::HashMap, env, sync::Arc, time::Duration};
use want_wallpapers_server::{AppState, config, moderation, router};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();
    let _ = rustls::crypto::ring::default_provider().install_default();
    let command = env::args().nth(1).unwrap_or_else(|| "serve".into());
    if !["serve", "migrate"].contains(&command.as_str()) {
        return Err("Usage: want-wallpapers-server [serve|migrate]".into());
    }
    let production = config::production_mode()?;
    let pool = config::connect(production).await?;
    if command == "migrate" {
        sqlx::migrate!("./migrations").run(&pool).await?;
        tracing::info!("migrations completed");
        return Ok(());
    }
    let config = Arc::new(config::Config::load()?);
    // Fail closed if a build is missing its script hashes.
    let hashes: HashMap<String, Vec<String>> = serde_json::from_str(
        &tokio::fs::read_to_string(config.static_dir.join("csp-hashes.json")).await?,
    )?;
    let recaptcha = if config.recaptcha.is_some() {
        Some(
            google_cloud_recaptchaenterprise_v1::client::RecaptchaEnterpriseService::builder()
                .build()
                .await
                .map_err(|_| "reCAPTCHA credentials initialization failed")?,
        )
    } else {
        None
    };
    let state = AppState {
        pool: pool.clone(),
        config: config.clone(),
        csp_hashes: Arc::new(hashes),
        recaptcha,
        login_slots: Arc::new(tokio::sync::Semaphore::new(2)),
    };
    let cleanup = tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(86400));
        loop {
            interval.tick().await;
            if moderation::cleanup(&pool).await.is_err() {
                tracing::error!("scheduled cleanup failed");
            }
        }
    });
    let listener = tokio::net::TcpListener::bind(config.bind).await?;
    tracing::info!("server listening");
    axum::serve(
        listener,
        router(state).into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .with_graceful_shutdown(async {
        let mut terminate =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                .expect("signal handler");
        tokio::select! {_=tokio::signal::ctrl_c()=>{},_=terminate.recv()=>{}}
    })
    .await?;
    cleanup.abort();
    Ok(())
}
