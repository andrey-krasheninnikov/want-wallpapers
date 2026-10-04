use crate::{
    AppState, auth,
    error::{ApiError, Result},
    models::text,
};
use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;
use uuid::Uuid;

async fn available(state: &AppState, id: &str) -> Result<()> {
    let exists: bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM wallpapers w JOIN collections c ON c.id=w.collection_id WHERE w.id=$1 AND NOT w.archived AND NOT c.archived)").bind(id).fetch_one(&state.pool).await?;
    if !exists {
        return Err(ApiError::missing());
    }
    Ok(())
}
async fn visitor(
    state: &AppState,
    headers: &HeaderMap,
    action: &str,
    max: i32,
    seconds: i32,
) -> Result<Uuid> {
    let session = auth::mutation(state, headers, "visitor").await?;
    let visitor = session.visitor.ok_or_else(ApiError::unauthorized)?;
    auth::limit(state, &format!("{action}:{visitor}"), max, seconds).await?;
    Ok(visitor)
}
pub async fn read(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<Value>> {
    available(&state, &id).await?;
    let visitor = auth::session(&state, &headers, "visitor")
        .await
        .ok()
        .and_then(|s| s.visitor);
    let mut counts = json!({"cringe":0,"minus":0,"plus":0,"imba":0});
    for row in sqlx::query(
        "SELECT value,count(*) AS count FROM ratings WHERE wallpaper_id=$1 GROUP BY value",
    )
    .bind(&id)
    .fetch_all(&state.pool)
    .await?
    {
        counts[row.get::<String, _>("value")] = json!(row.get::<i64, _>("count"));
    }
    let own: Option<String> =
        sqlx::query_scalar("SELECT value FROM ratings WHERE wallpaper_id=$1 AND visitor_id=$2")
            .bind(&id)
            .bind(visitor)
            .fetch_optional(&state.pool)
            .await?;
    let comments=sqlx::query("SELECT id,visitor_id,text,(extract(epoch FROM created_at)*1000)::bigint AS timestamp FROM comments WHERE wallpaper_id=$1 AND NOT hidden ORDER BY created_at DESC,id DESC LIMIT 50").bind(&id).fetch_all(&state.pool).await?;
    Ok(Json(
        json!({"counts":counts,"ownUid":visitor,"ownRating":own.unwrap_or_default(),"comments":comments.into_iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"uid":r.get::<Uuid,_>("visitor_id"),"text":r.get::<String,_>("text"),"createdAt":r.get::<i64,_>("timestamp")})).collect::<Vec<_>>()}),
    ))
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Rating {
    value: String,
}
pub async fn rate(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    Json(input): Json<Rating>,
) -> Result<Json<Value>> {
    let visitor = visitor(&state, &headers, "rating", 60, 60).await?;
    available(&state, &id).await?;
    if !["cringe", "minus", "plus", "imba"].contains(&input.value.as_str()) {
        return Err(ApiError::invalid());
    }
    sqlx::query("INSERT INTO ratings(wallpaper_id,visitor_id,value) VALUES($1,$2,$3) ON CONFLICT(wallpaper_id,visitor_id) DO UPDATE SET value=excluded.value").bind(&id).bind(visitor).bind(input.value).execute(&state.pool).await?;
    Ok(Json(json!({"ok":true})))
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Comment {
    text: String,
}
pub async fn comment(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    Json(input): Json<Comment>,
) -> Result<Json<Value>> {
    let visitor = visitor(&state, &headers, "comment", 10, 3600).await?;
    available(&state, &id).await?;
    let text = text(&input.text, 2, 1000)?;
    let mut transaction = state.pool.begin().await?;
    let allowed: Option<Uuid>=sqlx::query_scalar("INSERT INTO comment_authors(wallpaper_id,visitor_id) VALUES($1,$2) ON CONFLICT(wallpaper_id,visitor_id) DO UPDATE SET last_at=now() WHERE comment_authors.last_at <= now()-interval '24 hours' RETURNING visitor_id").bind(&id).bind(visitor).fetch_optional(&mut *transaction).await?;
    if allowed.is_none() {
        return Err(ApiError(
            axum::http::StatusCode::CONFLICT,
            "comment-cooldown",
        ));
    }
    let comment = Uuid::new_v4();
    sqlx::query("INSERT INTO comments(id,wallpaper_id,visitor_id,text) VALUES($1,$2,$3,$4)")
        .bind(comment)
        .bind(&id)
        .bind(visitor)
        .bind(text)
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await?;
    Ok(Json(json!({"id":comment})))
}
pub async fn delete_comment(
    State(state): State<AppState>,
    Path((id, comment)): Path<(String, Uuid)>,
    headers: HeaderMap,
) -> Result<Json<Value>> {
    let visitor = visitor(&state, &headers, "comment-delete", 30, 60).await?;
    let result =
        sqlx::query("DELETE FROM comments WHERE id=$1 AND wallpaper_id=$2 AND visitor_id=$3")
            .bind(comment)
            .bind(&id)
            .bind(visitor)
            .execute(&state.pool)
            .await?;
    if result.rows_affected() != 1 {
        return Err(ApiError::missing());
    }
    Ok(Json(json!({"ok":true})))
}
pub async fn report(
    State(state): State<AppState>,
    Path((id, comment)): Path<(String, Uuid)>,
    headers: HeaderMap,
) -> Result<Json<Value>> {
    let visitor = visitor(&state, &headers, "report", 20, 3600).await?;
    available(&state, &id).await?;
    let exists: bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM comments WHERE id=$1 AND wallpaper_id=$2 AND visitor_id<>$3 AND NOT hidden)").bind(comment).bind(&id).bind(visitor).fetch_one(&state.pool).await?;
    if !exists {
        return Err(ApiError::missing());
    }
    sqlx::query("INSERT INTO reports(id,comment_id,visitor_id) VALUES($1,$2,$3) ON CONFLICT(comment_id,visitor_id) DO NOTHING").bind(Uuid::new_v4()).bind(comment).bind(visitor).execute(&state.pool).await?;
    Ok(Json(json!({"ok":true})))
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Feedback {
    topic: String,
    message: String,
    email: String,
}
pub async fn feedback(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<Feedback>,
) -> Result<Json<Value>> {
    let visitor = visitor(&state, &headers, "feedback", 5, 3600).await?;
    let topic = text(&input.topic, 1, 100)?;
    let message = text(&input.message, 5, 2000)?;
    let email = text(&input.email, 0, 254)?;
    if !email.is_empty() && (!email.contains('@') || email.chars().any(char::is_whitespace)) {
        return Err(ApiError::invalid());
    }
    let id = Uuid::new_v4();
    sqlx::query("INSERT INTO feedback(id,visitor_id,topic,message,email) VALUES($1,$2,$3,$4,$5)")
        .bind(id)
        .bind(visitor)
        .bind(topic)
        .bind(message)
        .bind(email)
        .execute(&state.pool)
        .await?;
    Ok(Json(json!({"id":id})))
}
