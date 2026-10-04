use crate::{
    AppState, auth,
    error::{ApiError, Result},
};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::HeaderMap,
};
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Page {
    offset: Option<i64>,
    limit: Option<i64>,
    status: Option<String>,
}
pub async fn list(
    State(state): State<AppState>,
    Path(kind): Path<String>,
    Query(page): Query<Page>,
    headers: HeaderMap,
) -> Result<Json<Value>> {
    auth::admin_access(&state, &headers, false).await?;
    let limit = page.limit.unwrap_or(25);
    let offset = page.offset.unwrap_or(0);
    if !(1..=100).contains(&limit) || !(0..=1_000_000).contains(&offset) {
        return Err(ApiError::invalid());
    }
    let status = page.status.unwrap_or_default();
    let query = match kind.as_str() {
        "comments" => {
            if !["", "visible", "hidden"].contains(&status.as_str()) {
                return Err(ApiError::invalid());
            }
            "SELECT jsonb_build_object('id',id,'wallpaperId',wallpaper_id,'text',text,'hidden',hidden,'version',version,'createdAt',created_at) FROM comments WHERE $3='' OR hidden=($3='hidden') ORDER BY created_at DESC,id DESC LIMIT $1 OFFSET $2"
        }
        "reports" => {
            if !["", "open", "resolved", "dismissed"].contains(&status.as_str()) {
                return Err(ApiError::invalid());
            }
            "SELECT jsonb_build_object('id',r.id,'commentId',r.comment_id,'wallpaperId',c.wallpaper_id,'text',c.text,'hidden',c.hidden,'commentVersion',c.version,'status',r.status,'version',r.version,'createdAt',r.created_at) FROM reports r JOIN comments c ON c.id=r.comment_id WHERE $3='' OR r.status=$3 ORDER BY r.created_at DESC,r.id DESC LIMIT $1 OFFSET $2"
        }
        "feedback" => {
            if !["", "open", "closed"].contains(&status.as_str()) {
                return Err(ApiError::invalid());
            }
            "SELECT jsonb_build_object('id',id,'topic',topic,'message',message,'email',email,'status',status,'version',version,'createdAt',created_at,'closedAt',closed_at) FROM feedback WHERE $3='' OR status=$3 ORDER BY created_at DESC,id DESC LIMIT $1 OFFSET $2"
        }
        _ => return Err(ApiError::missing()),
    };
    let items: Vec<Value> = sqlx::query_scalar(query)
        .bind(limit + 1)
        .bind(offset)
        .bind(status)
        .fetch_all(&state.pool)
        .await?;
    Ok(Json(
        json!({"hasMore":items.len() as i64>limit,"items":items.into_iter().take(limit as usize).collect::<Vec<_>>()}),
    ))
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Change {
    version: i64,
    status: Option<String>,
    hidden: Option<bool>,
}
pub async fn update(
    State(state): State<AppState>,
    Path((kind, id)): Path<(String, Uuid)>,
    headers: HeaderMap,
    Json(change): Json<Change>,
) -> Result<Json<Value>> {
    auth::admin_access(&state, &headers, true).await?;
    let mut transaction = state.pool.begin().await?;
    let version: Option<i64> = match kind.as_str() {
        "comments" => {
            if change.status.is_some() {
                return Err(ApiError::invalid());
            }
            let hidden = change.hidden.ok_or_else(ApiError::invalid)?;
            sqlx::query_scalar("UPDATE comments SET hidden=$2,version=version+1 WHERE id=$1 AND version=$3 RETURNING version").bind(id).bind(hidden).bind(change.version).fetch_optional(&mut *transaction).await?
        }
        "reports" => {
            if change.hidden.is_some() {
                return Err(ApiError::invalid());
            }
            let status = change.status.ok_or_else(ApiError::invalid)?;
            if !["open", "resolved", "dismissed"].contains(&status.as_str()) {
                return Err(ApiError::invalid());
            }
            sqlx::query_scalar("UPDATE reports SET status=$2,version=version+1 WHERE id=$1 AND version=$3 RETURNING version").bind(id).bind(status).bind(change.version).fetch_optional(&mut *transaction).await?
        }
        "feedback" => {
            if change.hidden.is_some() {
                return Err(ApiError::invalid());
            }
            let status = change.status.ok_or_else(ApiError::invalid)?;
            if !["open", "closed"].contains(&status.as_str()) {
                return Err(ApiError::invalid());
            }
            sqlx::query_scalar("UPDATE feedback SET status=$2,version=version+1,closed_at=CASE WHEN $2='closed' THEN coalesce(closed_at,now()) ELSE NULL END WHERE id=$1 AND version=$3 RETURNING version").bind(id).bind(status).bind(change.version).fetch_optional(&mut *transaction).await?
        }
        _ => return Err(ApiError::missing()),
    };
    let version = version.ok_or_else(ApiError::conflict)?;
    sqlx::query("INSERT INTO audit_log(action,target,actor) VALUES($1,$2,'admin')")
        .bind(format!("{kind}-moderate"))
        .bind(id.to_string())
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await?;
    Ok(Json(json!({"version":version})))
}
pub async fn cleanup(pool: &sqlx::PgPool) -> Result<()> {
    let mut transaction = pool.begin().await?;
    sqlx::query(
        "DELETE FROM feedback WHERE status='closed' AND closed_at <= now()-interval '1 year'",
    )
    .execute(&mut *transaction)
    .await?;
    sqlx::query("DELETE FROM sessions WHERE expires_at<=now() OR (role='admin' AND last_seen<=now()-interval '30 minutes')").execute(&mut *transaction).await?;
    sqlx::query("DELETE FROM rate_limits WHERE resets_at<=now()")
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await?;
    Ok(())
}
