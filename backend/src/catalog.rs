use crate::{
    AppState, auth,
    error::{ApiError, Result},
    models::{Collection, Manifest, Snapshot, Wallpaper},
};
use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::{PgPool, Postgres, Row, Transaction};

// Catalogue writes are infrequent. One transaction lock keeps imports and editors consistent.
async fn lock(transaction: &mut Transaction<'_, Postgres>) -> Result<()> {
    sqlx::query("SELECT pg_advisory_xact_lock(18204001)")
        .execute(&mut **transaction)
        .await?;
    Ok(())
}
async fn audit(
    transaction: &mut Transaction<'_, Postgres>,
    action: &str,
    target: &str,
    actor: auth::CatalogActor,
) -> Result<()> {
    sqlx::query("INSERT INTO audit_log(action,target,actor) VALUES($1,$2,$3)")
        .bind(action)
        .bind(target)
        .bind(actor.name())
        .execute(&mut **transaction)
        .await?;
    Ok(())
}
pub async fn export(pool: &PgPool) -> Result<Snapshot> {
    let mut transaction = pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *transaction)
        .await?;
    let collections = sqlx::query("SELECT c.data, (SELECT count(*) FROM wallpapers w WHERE w.collection_id=c.id AND NOT w.archived) AS count FROM collections c WHERE NOT c.archived ORDER BY c.id").fetch_all(&mut *transaction).await?;
    let wallpapers: Vec<Value> = sqlx::query_scalar("SELECT w.data FROM wallpapers w JOIN collections c ON c.id=w.collection_id WHERE NOT w.archived AND NOT c.archived ORDER BY w.collection_id,w.number").fetch_all(&mut *transaction).await?;
    let snapshot = Snapshot {
        collections: collections
            .iter()
            .map(|row| {
                let mut c: Collection =
                    serde_json::from_value(row.get("data")).map_err(|_| ApiError::invalid())?;
                c.count = row.get("count");
                Ok(c)
            })
            .collect::<Result<_>>()?,
        wallpapers: wallpapers
            .into_iter()
            .map(|value| serde_json::from_value(value).map_err(|_| ApiError::invalid()))
            .collect::<Result<_>>()?,
    };
    transaction.commit().await?;
    Ok(snapshot)
}
pub async fn snapshot(State(state): State<AppState>) -> Result<Json<Snapshot>> {
    Ok(Json(export(&state.pool).await?))
}
pub async fn listing(State(state): State<AppState>, headers: HeaderMap) -> Result<Json<Value>> {
    auth::catalog_access(&state, &headers, false).await?;
    let mut transaction = state.pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *transaction)
        .await?;
    let collections = sqlx::query("SELECT data,version,archived FROM collections ORDER BY id")
        .fetch_all(&mut *transaction)
        .await?;
    let wallpapers =
        sqlx::query("SELECT data,version,archived FROM wallpapers ORDER BY collection_id,number")
            .fetch_all(&mut *transaction)
            .await?;
    let wrap = |row: sqlx::postgres::PgRow| json!({"item":row.get::<Value,_>("data"),"version":row.get::<i64,_>("version"),"archived":row.get::<bool,_>("archived")});
    let result = json!({"collections":collections.into_iter().map(wrap).collect::<Vec<_>>(),"wallpapers":wallpapers.into_iter().map(wrap).collect::<Vec<_>>(),"taxonomy":serde_json::from_str::<Value>(include_str!("../data/taxonomy.json")).map_err(|_| ApiError::invalid())?});
    transaction.commit().await?;
    Ok(Json(result))
}
pub async fn import_manifest(
    pool: &PgPool,
    manifest: &Manifest,
    actor: auth::CatalogActor,
) -> Result<&'static str> {
    manifest.validate()?;
    let mut transaction = pool.begin().await?;
    lock(&mut transaction).await?;
    let related_collections = sqlx::query(
        "SELECT data,archived FROM collections WHERE id=$1 OR slug=$2 OR folder_number=$3",
    )
    .bind(&manifest.collection.id)
    .bind(&manifest.collection.slug)
    .bind(manifest.collection.folder_number()?)
    .fetch_all(&mut *transaction)
    .await?;
    let related_wallpapers = sqlx::query("SELECT data,archived FROM wallpapers WHERE collection_id=$1 OR data->>'collection'=$2 OR id=ANY($3)")
        .bind(&manifest.collection.id).bind(&manifest.collection.slug).bind(manifest.wallpapers.iter().map(|w| w.id.clone()).collect::<Vec<_>>()).fetch_all(&mut *transaction).await?;
    if !related_collections.is_empty() || !related_wallpapers.is_empty() {
        let same_collection = related_collections.len() == 1
            && !related_collections[0].get::<bool, _>("archived")
            && related_collections[0].get::<Value, _>("data") == json!(manifest.collection);
        let same_wallpapers = related_wallpapers.len() == manifest.wallpapers.len()
            && related_wallpapers.iter().all(|row| {
                !row.get::<bool, _>("archived")
                    && manifest
                        .wallpapers
                        .iter()
                        .any(|w| json!(w) == row.get::<Value, _>("data"))
            });
        if same_collection && same_wallpapers {
            transaction.commit().await?;
            return Ok("unchanged");
        }
        return Err(ApiError::conflict());
    }
    sqlx::query("INSERT INTO collections(id,folder_number,slug,data) VALUES($1,$2,$3,$4)")
        .bind(&manifest.collection.id)
        .bind(manifest.collection.folder_number()?)
        .bind(&manifest.collection.slug)
        .bind(json!(manifest.collection))
        .execute(&mut *transaction)
        .await?;
    for w in &manifest.wallpapers {
        sqlx::query("INSERT INTO wallpapers(id,collection_id,number,data) VALUES($1,$2,$3,$4)")
            .bind(&w.id)
            .bind(&w.collection_id)
            .bind(w.number)
            .bind(json!(w))
            .execute(&mut *transaction)
            .await?;
    }
    audit(
        &mut transaction,
        "catalog-import",
        &manifest.collection.id,
        actor,
    )
    .await?;
    transaction.commit().await?;
    Ok("created")
}
pub async fn import(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(manifest): Json<Manifest>,
) -> Result<Json<Value>> {
    let actor = auth::catalog_access(&state, &headers, true).await?;
    Ok(Json(
        json!({"result":import_manifest(&state.pool,&manifest,actor).await?}),
    ))
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CollectionWrite {
    item: Collection,
    version: Option<i64>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WallpaperWrite {
    item: Wallpaper,
    version: Option<i64>,
}
pub async fn save_collection(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<CollectionWrite>,
) -> Result<Json<Value>> {
    let actor = auth::catalog_access(&state, &headers, true).await?;
    let c = input.item;
    let number = c.folder_number()?;
    let mut transaction = state.pool.begin().await?;
    lock(&mut transaction).await?;
    let previous: Option<Value> = sqlx::query_scalar("SELECT data FROM collections WHERE id=$1")
        .bind(&c.id)
        .fetch_optional(&mut *transaction)
        .await?;
    let version: i64 = if let Some(previous) = previous {
        if previous["slug"] != c.slug || previous["count"] != c.count {
            return Err(ApiError::invalid());
        }
        sqlx::query_scalar("UPDATE collections SET data=$2,version=version+1 WHERE id=$1 AND version=$3 RETURNING version").bind(&c.id).bind(json!(c)).bind(input.version).fetch_optional(&mut *transaction).await?.ok_or_else(ApiError::conflict)?
    } else {
        if input.version.is_some() || c.count != 0 {
            return Err(ApiError::conflict());
        }
        sqlx::query_scalar("INSERT INTO collections(id,folder_number,slug,data) VALUES($1,$2,$3,$4) RETURNING version").bind(&c.id).bind(number).bind(&c.slug).bind(json!(c)).fetch_one(&mut *transaction).await?
    };
    audit(&mut transaction, "collection-save", &c.id, actor).await?;
    transaction.commit().await?;
    Ok(Json(json!({"version":version})))
}
pub async fn save_wallpaper(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<WallpaperWrite>,
) -> Result<Json<Value>> {
    let actor = auth::catalog_access(&state, &headers, true).await?;
    let w = input.item;
    let mut transaction = state.pool.begin().await?;
    lock(&mut transaction).await?;
    let collection: Value =
        sqlx::query_scalar("SELECT data FROM collections WHERE id=$1 AND NOT archived")
            .bind(&w.collection_id)
            .fetch_optional(&mut *transaction)
            .await?
            .ok_or_else(ApiError::missing)?;
    let collection: Collection =
        serde_json::from_value(collection).map_err(|_| ApiError::invalid())?;
    w.validate(&collection)?;
    let previous: Option<Value> = sqlx::query_scalar("SELECT data FROM wallpapers WHERE id=$1")
        .bind(&w.id)
        .fetch_optional(&mut *transaction)
        .await?;
    let version: i64 = if let Some(previous) = previous {
        if previous["collectionId"] != w.collection_id || previous["number"] != w.number {
            return Err(ApiError::invalid());
        }
        sqlx::query_scalar("UPDATE wallpapers SET data=$2,version=version+1 WHERE id=$1 AND version=$3 RETURNING version").bind(&w.id).bind(json!(w)).bind(input.version).fetch_optional(&mut *transaction).await?.ok_or_else(ApiError::conflict)?
    } else {
        if input.version.is_some() {
            return Err(ApiError::conflict());
        }
        if collection.count >= 1000 {
            return Err(ApiError::invalid());
        }
        let version=sqlx::query_scalar("INSERT INTO wallpapers(id,collection_id,number,data) VALUES($1,$2,$3,$4) RETURNING version").bind(&w.id).bind(&w.collection_id).bind(w.number).bind(json!(w)).fetch_one(&mut *transaction).await?;
        sqlx::query("UPDATE collections SET data=jsonb_set(data,'{count}',to_jsonb((data->>'count')::bigint+1)),version=version+1 WHERE id=$1").bind(&w.collection_id).execute(&mut *transaction).await?;
        version
    };
    audit(&mut transaction, "wallpaper-save", &w.id, actor).await?;
    transaction.commit().await?;
    Ok(Json(json!({"version":version})))
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Archive {
    archived: bool,
    version: i64,
}
pub async fn archive(
    State(state): State<AppState>,
    Path((kind, id)): Path<(String, String)>,
    headers: HeaderMap,
    Json(input): Json<Archive>,
) -> Result<Json<Value>> {
    let actor = auth::catalog_access(&state, &headers, true).await?;
    let mut transaction = state.pool.begin().await?;
    lock(&mut transaction).await?;
    let query = match kind.as_str() {
        "collections" => {
            "UPDATE collections SET archived=$2,version=version+1 WHERE id=$1 AND version=$3 RETURNING version"
        }
        "wallpapers" => {
            "UPDATE wallpapers SET archived=$2,version=version+1 WHERE id=$1 AND version=$3 RETURNING version"
        }
        _ => return Err(ApiError::missing()),
    };
    let version: i64 = sqlx::query_scalar(query)
        .bind(&id)
        .bind(input.archived)
        .bind(input.version)
        .fetch_optional(&mut *transaction)
        .await?
        .ok_or_else(ApiError::conflict)?;
    audit(
        &mut transaction,
        if input.archived { "archive" } else { "restore" },
        &id,
        actor,
    )
    .await?;
    transaction.commit().await?;
    Ok(Json(json!({"version":version})))
}
