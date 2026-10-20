use super::{
    Batch, DESTINATIONS, Error, Result, credentials::Credentials, hexadecimal, store::Store,
};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::{
    ConnectOptions, Row,
    postgres::{PgConnectOptions, PgPoolOptions, PgSslMode},
};
use std::{
    fs::{self, File},
    io::Read,
    os::unix::fs::MetadataExt,
    path::{Path, PathBuf},
    str::FromStr,
    time::{Duration, Instant},
};

const OUTBOX: &str = "/run/publications";
const CREDENTIALS: &str = "/run/distribution";
const LIMIT: u64 = 8 * 1024 * 1024;

async fn connect() -> Result<Store> {
    let bytes =
        super::credentials::private_bytes(Path::new("/run/secrets/distribution_database_url"))?;
    let value = std::str::from_utf8(&bytes)
        .map_err(|_| Error("invalid-distribution-database"))?
        .trim();
    let options =
        PgConnectOptions::from_str(value).map_err(|_| Error("invalid-distribution-database"))?;
    if options.get_username() != "wallpapers-distributor"
        || options.get_database() != Some("wallpapers")
        || !matches!(options.get_ssl_mode(), PgSslMode::VerifyFull)
    {
        return Err(Error("isolated-distribution-database-required"));
    }
    let options = options
        .application_name("want-wallpapers-distribution")
        .options([("statement_timeout", "10000"), ("lock_timeout", "2000")])
        .disable_statement_logging();
    let pool = PgPoolOptions::new()
        .max_connections(2)
        .acquire_timeout(Duration::from_secs(5))
        .connect_with(options)
        .await
        .map_err(|_| Error("distribution-database-unavailable"))?;
    let version: String = sqlx::query_scalar("SHOW server_version_num")
        .fetch_one(&pool)
        .await
        .map_err(|_| Error("distribution-database-unavailable"))?;
    if !version
        .parse::<u32>()
        .is_ok_and(|value| (180000..190000).contains(&value))
    {
        return Err(Error("postgresql-18-required"));
    }
    sqlx::query(include_str!(
        "../../../deploy/verify-distribution-grants.sql"
    ))
    .execute(&pool)
    .await
    .map_err(|_| Error("distribution-role-not-isolated"))?;
    Ok(Store(pool))
}
fn read_batch(path: &Path) -> Result<(Batch, String)> {
    let metadata = fs::symlink_metadata(path).map_err(|_| Error("publication-file-unavailable"))?;
    if !metadata.is_file()
        || metadata.uid() != 0
        || metadata.gid() != 10002
        || metadata.mode() & 0o027 != 0
        || metadata.len() > LIMIT
        || fs::canonicalize(path).map_err(|_| Error("publication-file-unavailable"))? != path
    {
        return Err(Error("trusted-publication-file-required"));
    }
    let mut bytes = Vec::new();
    File::open(path)
        .map_err(|_| Error("publication-file-unavailable"))?
        .take(LIMIT + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| Error("publication-file-unavailable"))?;
    if bytes.len() as u64 > LIMIT {
        return Err(Error("publication-file-too-large"));
    }
    let batch: Batch =
        serde_json::from_slice(&bytes).map_err(|_| Error("invalid-publication-file"))?;
    batch.validate()?;
    Ok((batch, hex::encode(Sha256::digest(bytes))))
}
async fn ingest(store: &Store, credentials: &Credentials) -> Result<()> {
    let root = Path::new(OUTBOX);
    let metadata =
        fs::symlink_metadata(root).map_err(|_| Error("publication-outbox-unavailable"))?;
    if !metadata.is_dir()
        || metadata.uid() != 0
        || metadata.gid() != 10002
        || metadata.mode() & 0o027 != 0
        || fs::canonicalize(root).map_err(|_| Error("publication-outbox-unavailable"))? != root
    {
        return Err(Error("trusted-publication-outbox-required"));
    }
    let known = store.known_batches().await?;
    let mut pending: Vec<(u64, PathBuf)> = Vec::new();
    let mut count = 0;
    for entry in fs::read_dir(root).map_err(|_| Error("publication-outbox-unavailable"))? {
        let path = entry
            .map_err(|_| Error("publication-file-unavailable"))?
            .path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        let id = path
            .file_stem()
            .and_then(|value| value.to_str())
            .ok_or(Error("invalid-publication-file"))?;
        if !hexadecimal(id, 32) {
            return Err(Error("invalid-publication-file"));
        }
        count += 1;
        if count > 10000 {
            return Err(Error("publication-outbox-limit"));
        }
        let (batch, hash) = read_batch(&path)?;
        if batch.receipt.request_id != id {
            return Err(Error("publication-file-identity-mismatch"));
        }
        if let Some(expected) = known.get(id) {
            if *expected != hash {
                return Err(Error("publication-receipt-conflict"));
            }
        } else {
            pending.push((batch.verified_at, path));
        }
    }
    pending.sort();
    for (_, path) in pending {
        let (batch, hash) = read_batch(&path)?;
        batch
            .ingest(store, &credentials.configured(), &hash)
            .await?;
    }
    Ok(())
}
pub async fn command(arguments: &[String]) -> Result<Value> {
    let store = connect().await?;
    if arguments == ["status"] {
        let rows = sqlx::query("SELECT collection_id,destination,item,state,generation,payload_hash,next_attempt_at::text,error_code FROM public.distribution_deliveries ORDER BY collection_id DESC,destination,item LIMIT 500").fetch_all(&store.0).await.map_err(|_| Error("distribution-database"))?;
        let deliveries = Value::Array(rows.iter().map(|row| json!({"collectionId":row.get::<String,_>("collection_id"),"destination":row.get::<String,_>("destination"),"item":row.get::<String,_>("item"),"state":row.get::<String,_>("state"),"attempts":row.get::<i64,_>("generation"),"payloadHash":row.get::<String,_>("payload_hash"),"nextAttemptAt":row.get::<String,_>("next_attempt_at"),"errorCode":row.get::<Option<String>,_>("error_code")})).collect());
        let conflicts: Vec<Value> = sqlx::query_scalar("SELECT jsonb_build_object('requestId',request_id,'conflicts',jsonb_build_array(conflict)) FROM public.distribution_batches CROSS JOIN LATERAL jsonb_array_elements(publication_conflicts) AS expanded(conflict) ORDER BY ingested_at DESC,conflict->>'collectionId' LIMIT 100")
            .fetch_all(&store.0).await.map_err(|_| Error("distribution-database"))?;
        return Ok(json!({"deliveries":deliveries,"publicationConflicts":conflicts}));
    }
    let mut lock = store
        .0
        .acquire()
        .await
        .map_err(|_| Error("distribution-database"))?;
    let acquired: bool = sqlx::query_scalar("SELECT pg_try_advisory_lock(1463897164,126)")
        .fetch_one(&mut *lock)
        .await
        .map_err(|_| Error("distribution-database"))?;
    if !acquired {
        return Err(Error("distribution-busy"));
    }
    let result = async {
        let mut credentials = Credentials::load(Path::new(CREDENTIALS));
        store.recover().await?;
        match arguments {
            [operation, collection, destination] if operation == "select" => {
                if !super::collection_id(collection)
                    || !credentials.configured().contains(destination)
                {
                    return Err(Error("configured-destination-required"));
                }
                Ok(json!({"selected":store.select(collection,destination).await?}))
            }
            [
                operation,
                collection,
                destination,
                item,
                expected,
                decision,
                file,
            ] if operation == "resolve" => {
                if !super::collection_id(collection)
                    || !DESTINATIONS.iter().any(|(name, _)| name == destination)
                    || !hexadecimal(expected, 64)
                    || item.is_empty()
                    || item.len() > 40
                    || !item.bytes().all(|value| {
                        value.is_ascii_lowercase() || value.is_ascii_digit() || value == b'-'
                    })
                {
                    return Err(Error("invalid-resolution-intent"));
                }
                let receipt = if decision == "delivered" {
                    let path = Path::new(file);
                    if path.parent() != Some(Path::new(CREDENTIALS)) {
                        return Err(Error("private-resolution-file-required"));
                    }
                    Some(
                        serde_json::from_slice::<Value>(&super::credentials::private_bytes(path)?)
                            .map_err(|_| Error("invalid-resolution-receipt"))?,
                    )
                } else if decision == "absent" && file == "--confirmed-absent" {
                    None
                } else {
                    return Err(Error("confirmed-resolution-required"));
                };
                store
                    .resolve(collection, destination, item, expected, receipt.as_ref())
                    .await?;
                Ok(json!({"resolved":true}))
            }
            [operation] if operation == "--once" => {
                ingest(&store, &credentials).await?;
                let deadline = Instant::now() + Duration::from_secs(210);
                let mut processed = 0;
                while processed < 20
                    && deadline.saturating_duration_since(Instant::now()) > Duration::from_secs(65)
                {
                    let Some(delivery) = store.claim().await? else {
                        break;
                    };
                    let outcome = super::transport::send(&delivery, &mut credentials, &store).await;
                    store.finish(&delivery, outcome).await?;
                    processed += 1;
                }
                let memory = fs::read_to_string("/sys/fs/cgroup/memory.peak")
                    .ok()
                    .and_then(|value| value.trim().parse::<u64>().ok());
                Ok(json!({"processed":processed,"memoryPeakBytes":memory}))
            }
            _ => Err(Error("invalid-distribution-command")),
        }
    }
    .await;
    let unlock = sqlx::query("SELECT pg_advisory_unlock(1463897164,126)")
        .execute(&mut *lock)
        .await;
    if unlock.is_err() && result.is_ok() {
        return Err(Error("distribution-unlock-failed"));
    }
    result
}
