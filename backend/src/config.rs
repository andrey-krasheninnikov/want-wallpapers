use crate::auth::digest;
use ipnet::IpNet;
use sqlx::{
    ConnectOptions, PgPool,
    postgres::{PgConnectOptions, PgPoolOptions, PgSslMode},
};
use std::{env, fs, net::SocketAddr, path::PathBuf, str::FromStr, time::Duration};
use totp_rs::{Algorithm, Secret, TOTP};

type SetupResult<T> = Result<T, Box<dyn std::error::Error + Send + Sync>>;
pub struct Config {
    pub site: String,
    pub production: bool,
    pub bind: SocketAddr,
    pub static_dir: PathBuf,
    pub admin_username: String,
    pub admin_hash: String,
    pub totp: TOTP,
    pub credential_fingerprint: String,
    pub catalog_token_hash: String,
    pub trusted_proxies: Vec<IpNet>,
}
fn setting(name: &str, default: &str) -> String {
    env::var(name).unwrap_or_else(|_| default.to_owned())
}
pub fn secret(name: &str) -> SetupResult<String> {
    let value = match env::var(format!("{name}_FILE")) {
        Ok(path) => fs::read_to_string(path)?,
        Err(_) => env::var(name).map_err(|_| format!("{name}_FILE is required"))?,
    };
    let value = value.trim().to_owned();
    if value.is_empty() {
        return Err(format!("{name} must not be empty").into());
    }
    Ok(value)
}
pub fn production_mode() -> SetupResult<bool> {
    match setting("APP_ENV", "production").as_str() {
        "production" => Ok(true),
        "development" => Ok(false),
        _ => Err("APP_ENV must be production or development".into()),
    }
}
impl Config {
    pub fn load() -> SetupResult<Self> {
        let production = production_mode()?;
        let site = setting("SITE_URL", "https://wallpapers.want.foundation")
            .trim_end_matches('/')
            .to_owned();
        let site_url = url::Url::parse(&site)?;
        if site_url.path() != "/"
            || site_url.query().is_some()
            || site_url.fragment().is_some()
            || !site_url.username().is_empty()
            || site_url.password().is_some()
            || (production && site_url.scheme() != "https")
        {
            return Err("SITE_URL must be a bare HTTPS origin in production".into());
        }
        let admin_hash = secret("ADMIN_PASSWORD_HASH")?;
        let parsed_hash = argon2::PasswordHash::new(&admin_hash)
            .map_err(|_| "Invalid administrator password hash")?;
        if parsed_hash.algorithm.as_str() != "argon2id" {
            return Err("Administrator password must use Argon2id".into());
        }
        if parsed_hash.params.get_decimal("m").unwrap_or(0) < 19456
            || parsed_hash.params.get_decimal("t").unwrap_or(0) < 2
        {
            return Err("Argon2id hash requires memory >=19456 KiB and iterations >=2".into());
        }
        let totp_secret = secret("ADMIN_TOTP_SECRET")?;
        let totp = TOTP::new(
            Algorithm::SHA1,
            6,
            1,
            30,
            Secret::Encoded(totp_secret.clone())
                .to_bytes()
                .map_err(|_| "Invalid TOTP secret")?,
        )
        .map_err(|_| "Invalid TOTP settings")?;
        let catalog_token = secret("CATALOG_API_TOKEN")?;
        if catalog_token.len() < 32 {
            return Err("Catalog token must contain at least 32 characters".into());
        }
        Ok(Self {
            site,
            production,
            bind: setting("BIND_ADDR", "0.0.0.0:8080").parse()?,
            static_dir: setting("STATIC_DIR", "frontend/dist").into(),
            admin_username: setting("ADMIN_USERNAME", "admin"),
            credential_fingerprint: digest(&format!(
                "{admin_hash}\0{totp_secret}\0{}",
                setting("ADMIN_USERNAME", "admin")
            )),
            admin_hash,
            totp,
            catalog_token_hash: digest(&catalog_token),
            trusted_proxies: setting("TRUSTED_PROXY_CIDRS", "")
                .split(',')
                .filter(|s| !s.is_empty())
                .map(str::parse)
                .collect::<std::result::Result<_, _>>()?,
        })
    }
}
pub async fn connect(production: bool) -> SetupResult<PgPool> {
    let database_url = secret("DATABASE_URL")?;
    let options = PgConnectOptions::from_str(&database_url).map_err(|_| "Invalid database URL")?;
    if production && !matches!(options.get_ssl_mode(), PgSslMode::VerifyFull) {
        return Err("Production database requires sslmode=verify-full".into());
    }
    let options = options
        .application_name("want-wallpapers")
        .options([("statement_timeout", "10000"), ("lock_timeout", "5000")])
        .disable_statement_logging();
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(Duration::from_secs(5))
        .connect_with(options)
        .await
        .map_err(|_| "Database connection failed")?;
    let version: String = sqlx::query_scalar("SHOW server_version_num")
        .fetch_one(&pool)
        .await?;
    if !(180000..190000).contains(&version.parse::<u32>()?) {
        return Err("PostgreSQL 18 is required".into());
    }
    Ok(pool)
}
