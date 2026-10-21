use super::{
    Delivery, Outcome,
    credentials::Credentials,
    hash,
    transport::{self, Asset, Prepared},
};
use reqwest::{Client, Method, RequestBuilder, StatusCode, multipart};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::time::{SystemTime, UNIX_EPOCH};

const API: &str = "https://api.tumblr.com/v2";
const SCOPES: [&str; 3] = ["basic", "write", "offline_access"];
type Result<T> = std::result::Result<T, Outcome>;
fn blocked(code: &'static str) -> Outcome {
    Outcome::Blocked(code)
}
fn retry(code: &'static str) -> Outcome {
    Outcome::Retry { seconds: 300, code }
}
fn secret(value: &str) -> bool {
    !value.is_empty() && value.len() <= 4096 && value.bytes().all(|byte| byte.is_ascii_graphic())
}
fn blog_name(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
}
fn blog_uuid(value: &str) -> bool {
    value.strip_prefix("t:").is_some_and(|value| {
        !value.is_empty()
            && value.len() <= 64
            && value
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || [b'-', b'_'].contains(&byte))
    })
}
fn post_id(value: &str) -> bool {
    value
        .parse::<u64>()
        .is_ok_and(|id| id > 0 && id.to_string() == value)
}
fn scopes(value: &str) -> bool {
    SCOPES
        .iter()
        .all(|scope| value.split_whitespace().any(|value| value == *scope))
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Settings {
    enabled: bool,
    username: String,
    blog_name: String,
    blog_uuid: String,
    client_id: String,
    client_secret: String,
    access_token: String,
    refresh_token: String,
    access_token_expires_at: u64,
    scope: String,
    #[serde(default)]
    refresh_pending: bool,
}
impl Settings {
    fn parse(value: &Value) -> Result<Self> {
        let settings: Self = serde_json::from_value(value.clone())
            .map_err(|_| blocked("tumblr-configuration-invalid"))?;
        if !settings.enabled
            || !blog_name(&settings.username)
            || !blog_name(&settings.blog_name)
            || !blog_uuid(&settings.blog_uuid)
            || !secret(&settings.client_id)
            || !secret(&settings.client_secret)
            || !secret(&settings.access_token)
            || !secret(&settings.refresh_token)
            || !scopes(&settings.scope)
        {
            return Err(blocked("tumblr-configuration-invalid"));
        }
        if settings.refresh_pending {
            return Err(blocked("tumblr-reauthorization-required"));
        }
        Ok(settings)
    }
    fn value(&self) -> Result<Value> {
        serde_json::to_value(self).map_err(|_| blocked("tumblr-configuration-invalid"))
    }
}
trait Api {
    async fn read(&self, path: &str, token: &str) -> Result<Value>;
    async fn create(
        &self,
        settings: &Settings,
        payload: &Value,
        images: Vec<Vec<u8>>,
    ) -> Result<Value>;
    async fn refresh(&self, settings: &Settings) -> Result<Value>;
    async fn asset(&self, asset: &Asset) -> Result<Vec<u8>>;
    async fn page(&self, prepared: &Prepared, collection: bool) -> Result<String>;
}
struct Http(Client);
impl Http {
    fn request(&self, method: Method, path: &str, token: &str) -> RequestBuilder {
        self.0
            .request(method, format!("{API}{path}"))
            .header(
                reqwest::header::USER_AGENT,
                "WantWallpapers/1 (+https://wallpapers.want.foundation/)",
            )
            .bearer_auth(token)
    }
}
fn read_failure(outcome: Outcome) -> Outcome {
    match outcome {
        Outcome::Unknown(_) => retry("tumblr-read-unavailable"),
        other => other,
    }
}
fn response(reply: transport::Reply, expected: StatusCode) -> Result<Value> {
    if let Some(outcome) = reply.rejection() {
        return Err(outcome);
    }
    if reply.status != expected
        || reply.body.pointer("/meta/status").and_then(Value::as_u64)
            != Some(expected.as_u16().into())
        || !reply.body["response"].is_object()
    {
        return Err(Outcome::Unknown("tumblr-response-unconfirmed"));
    }
    Ok(reply.body["response"].clone())
}
fn form(payload: &Value, images: Vec<Vec<u8>>) -> Result<multipart::Form> {
    let json = multipart::Part::text(payload.to_string())
        .mime_str("application/json")
        .map_err(|_| blocked("tumblr-media-invalid"))?;
    let mut form = multipart::Form::new().part("json", json);
    for (index, bytes) in images.into_iter().enumerate() {
        let name = format!("photo{}", index + 1);
        let part = multipart::Part::bytes(bytes)
            .file_name(format!("{name}.jpg"))
            .mime_str("image/jpeg")
            .map_err(|_| blocked("tumblr-media-invalid"))?;
        form = form.part(name, part);
    }
    Ok(form)
}
impl Api for Http {
    async fn read(&self, path: &str, token: &str) -> Result<Value> {
        let reply = transport::write(self.request(Method::GET, path, token))
            .await
            .map_err(read_failure)?;
        response(reply, StatusCode::OK).map_err(read_failure)
    }
    async fn create(
        &self,
        settings: &Settings,
        payload: &Value,
        images: Vec<Vec<u8>>,
    ) -> Result<Value> {
        let reply = transport::write(
            self.request(
                Method::POST,
                &format!("/blog/{}/posts", settings.blog_uuid),
                &settings.access_token,
            )
            .multipart(form(payload, images)?),
        )
        .await?;
        response(reply, StatusCode::CREATED)
    }
    async fn refresh(&self, settings: &Settings) -> Result<Value> {
        let reply = transport::write(
            self.0
                .post(format!("{API}/oauth2/token"))
                .header(
                    reqwest::header::USER_AGENT,
                    "WantWallpapers/1 (+https://wallpapers.want.foundation/)",
                )
                .form(&[
                    ("grant_type", "refresh_token"),
                    ("refresh_token", &settings.refresh_token),
                    ("client_id", &settings.client_id),
                    ("client_secret", &settings.client_secret),
                ]),
        )
        .await?;
        if let Some(outcome) = reply.rejection() {
            return Err(outcome);
        }
        if reply.status != StatusCode::OK {
            return Err(Outcome::Unknown("tumblr-response-unconfirmed"));
        }
        Ok(reply.body)
    }
    async fn asset(&self, asset: &Asset) -> Result<Vec<u8>> {
        asset
            .download(&self.0)
            .await
            .map_err(|error| retry(error.0))
    }
    async fn page(&self, prepared: &Prepared, collection: bool) -> Result<String> {
        transport::check_page(&self.0, prepared, collection)
            .await
            .map_err(|error| retry(error.0))
    }
}
fn refreshed(settings: &mut Settings, response: &Value, now: u64) -> Result<()> {
    let invalid = || blocked("tumblr-reauthorization-required");
    let access = response["access_token"]
        .as_str()
        .filter(|value| secret(value))
        .ok_or_else(invalid)?;
    let refresh = response["refresh_token"]
        .as_str()
        .filter(|value| secret(value))
        .ok_or_else(invalid)?;
    let lifetime = response["expires_in"]
        .as_u64()
        .filter(|value| *value > 60 && *value <= 90 * 86400)
        .ok_or_else(invalid)?;
    let scope = response["scope"]
        .as_str()
        .filter(|value| scopes(value))
        .ok_or_else(invalid)?;
    if response["token_type"]
        .as_str()
        .is_none_or(|value| !value.eq_ignore_ascii_case("bearer"))
    {
        return Err(invalid());
    }
    settings.access_token = access.into();
    settings.refresh_token = refresh.into();
    settings.scope = scope.into();
    settings.access_token_expires_at = now.checked_add(lifetime).ok_or_else(invalid)?;
    settings.refresh_pending = false;
    Ok(())
}
async fn authorize(
    api: &impl Api,
    credentials: &mut Credentials,
    settings: &mut Settings,
    now: u64,
) -> Result<()> {
    if settings.access_token_expires_at > now.saturating_add(60) {
        return Ok(());
    }
    settings.refresh_pending = true;
    credentials
        .replace("tumblr", settings.value()?)
        .map_err(|error| blocked(error.0))?;
    let response = match api.refresh(settings).await {
        Ok(response) => response,
        Err(Outcome::Retry { seconds, code }) => {
            settings.refresh_pending = false;
            credentials
                .replace("tumblr", settings.value()?)
                .map_err(|error| blocked(error.0))?;
            return Err(Outcome::Retry { seconds, code });
        }
        Err(_) => return Err(blocked("tumblr-reauthorization-required")),
    };
    refreshed(settings, &response, now)?;
    // Persist both rotated tokens before posting; a lost refresh requires owner reauthorization.
    credentials
        .replace("tumblr", settings.value()?)
        .map_err(|error| blocked(error.0))
}
async fn identity(api: &impl Api, settings: &Settings) -> Result<()> {
    let info = api.read("/user/info", &settings.access_token).await?;
    if info.pointer("/user/name").and_then(Value::as_str) != Some(&settings.username)
        || info
            .pointer("/user/blogs")
            .and_then(Value::as_array)
            .is_none_or(|blogs| {
                !blogs.iter().any(|blog| {
                    blog["uuid"] == settings.blog_uuid
                        && blog["name"] == settings.blog_name
                        && blog["type"] == "public"
                })
            })
    {
        return Err(blocked("tumblr-public-blog-mismatch"));
    }
    Ok(())
}
fn media(prepared: &Prepared) -> Result<Vec<&Asset>> {
    let mut result = Vec::with_capacity(5);
    for design in 1..=5 {
        let items = prepared
            .assets
            .iter()
            .filter(|asset| asset.role == "social" && asset.design == design)
            .collect::<Vec<_>>();
        if items.len() != 1 {
            return Err(blocked("tumblr-media-invalid"));
        }
        result.push(items[0]);
    }
    Ok(result)
}
fn text_valid(value: &str) -> bool {
    !value.trim().is_empty()
        && value.chars().count() <= 4096
        && !value
            .chars()
            .any(|value| value.is_control() && !['\n', '\t'].contains(&value))
}
fn payload(prepared: &Prepared, assets: &[&Asset], links: &[String]) -> Result<Value> {
    if assets.len() != 5
        || links.len() != 6
        || !text_valid(&prepared.title)
        || !text_valid(&prepared.description)
    {
        return Err(blocked("tumblr-content-invalid"));
    }
    let mut content = Vec::new();
    for asset in assets {
        let title = &prepared.manifest.wallpapers[asset.design as usize - 1].title["en"];
        if !text_valid(title) {
            return Err(blocked("tumblr-content-invalid"));
        }
        content.push(json!({"type":"image","alt_text":title,"media":[{"type":"image/jpeg","identifier":format!("photo{}",asset.design),"width":1080,"height":1920}]}));
    }
    content.push(json!({"type":"text","subtype":"heading1","text":prepared.title}));
    content.push(json!({"type":"text","text":prepared.description}));
    for link in links {
        if !link.is_ascii() || link.len() > 2048 {
            return Err(blocked("tumblr-content-invalid"));
        }
        content.push(json!({"type":"text","text":link,"formatting":[{"type":"link","start":0,"end":link.len(),"url":link}]}));
    }
    let mut display = vec![json!({"blocks":[0,1]}), json!({"blocks":[2,3,4]})];
    display.extend((5..content.len()).map(|index| json!({"blocks":[index]})));
    Ok(
        json!({"state":"published","content":content,"layout":[{"type":"rows","display":display}],"source_url":links[0],"send_to_twitter":false}),
    )
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Progress {
    schema_version: u8,
    post_id: String,
    blog_name: String,
    blog_uuid: String,
    source_hashes: Vec<String>,
    request_hash: String,
}
fn progress(
    value: &Value,
    settings: &Settings,
    sources: &[String],
    request_hash: &str,
) -> Result<Progress> {
    let progress: Progress =
        serde_json::from_value(value.clone()).map_err(|_| blocked("tumblr-progress-invalid"))?;
    if progress.schema_version != 1
        || !post_id(&progress.post_id)
        || progress.blog_uuid != settings.blog_uuid
        || progress.blog_name != settings.blog_name
        || progress.source_hashes != sources
        || progress.request_hash != request_hash
    {
        return Err(blocked("tumblr-progress-identity-mismatch"));
    }
    Ok(progress)
}
fn image_media_valid(value: &Value) -> bool {
    let Some(items) = value.as_array() else {
        return false;
    };
    items.iter().all(|item| {
        let url = item["url"]
            .as_str()
            .and_then(|value| url::Url::parse(value).ok());
        url.is_some_and(|url| {
            url.scheme() == "https"
                && url
                    .host_str()
                    .is_some_and(|host| host.ends_with(".media.tumblr.com"))
                && url.username().is_empty()
                && url.password().is_none()
        }) && item["width"]
            .as_u64()
            .zip(item["height"].as_u64())
            .is_some_and(|(w, h)| w > 0 && h > 0 && w <= 4096 && h <= 4096)
    }) && items.iter().any(|item| {
        item.get("cropped").is_none_or(|value| value == false)
            && item["width"]
                .as_u64()
                .zip(item["height"].as_u64())
                .is_some_and(|(w, h)| {
                    w > 0 && h > 0 && w <= 1080 && h <= 1920 && (w * 16).abs_diff(h * 9) <= 16
                })
    })
}
fn confirm(
    post: &Value,
    progress: &Progress,
    request: &Value,
    collection: &str,
) -> Result<Outcome> {
    if post["id"] != progress.post_id
        || post["tumblelog_uuid"] != progress.blog_uuid
        || post["state"] != "published"
        || post["object_type"] != "post"
        || post["type"] != "blocks"
        || post
            .get("parent_post_id")
            .is_some_and(|value| !value.is_null())
        || post
            .get("trail")
            .is_some_and(|value| value.as_array().is_none_or(|value| !value.is_empty()))
    {
        return Err(blocked("tumblr-post-readback-mismatch"));
    }
    let layout = post["layout"]
        .as_array()
        .filter(|value| value.len() == 1)
        .ok_or(blocked("tumblr-post-readback-mismatch"))?;
    let display = layout[0]["display"]
        .as_array()
        .ok_or(blocked("tumblr-post-readback-mismatch"))?;
    let expected_display = request["layout"][0]["display"]
        .as_array()
        .ok_or(blocked("tumblr-content-invalid"))?;
    if layout[0]["type"] != "rows"
        || layout[0].get("truncate_after").is_some()
        || display.len() != expected_display.len()
        || display
            .iter()
            .zip(expected_display)
            .any(|(row, expected)| row["blocks"] != expected["blocks"])
    {
        return Err(blocked("tumblr-post-readback-mismatch"));
    }
    let expected = request["content"]
        .as_array()
        .ok_or(blocked("tumblr-content-invalid"))?;
    let actual = post["content"]
        .as_array()
        .filter(|value| value.len() == expected.len())
        .ok_or(blocked("tumblr-post-readback-mismatch"))?;
    for (index, (actual, expected)) in actual.iter().zip(expected).enumerate() {
        if actual["type"] != expected["type"] {
            return Err(blocked("tumblr-post-readback-mismatch"));
        }
        if index < 5 {
            if actual["alt_text"] != expected["alt_text"] || !image_media_valid(&actual["media"]) {
                return Err(blocked("tumblr-post-readback-mismatch"));
            }
        } else if actual["text"] != expected["text"]
            || expected
                .get("formatting")
                .is_some_and(|value| actual.get("formatting") != Some(value))
        {
            return Err(blocked("tumblr-post-readback-mismatch"));
        }
    }
    Ok(Outcome::Delivered(
        json!({"schemaVersion":1,"kind":"tumblr-photoset","collectionId":collection,"postId":progress.post_id,"blogName":progress.blog_name,"blogUuid":progress.blog_uuid,"sourceHashes":progress.source_hashes,"requestHash":progress.request_hash,"url":format!("https://www.tumblr.com/{}/{}",progress.blog_name,progress.post_id)}),
    ))
}
async fn deliver(
    api: &impl Api,
    delivery: &Delivery,
    prepared: &Prepared,
    settings: &Settings,
) -> Result<Outcome> {
    let assets = media(prepared)?;
    let mut links = vec![api.page(prepared, true).await?];
    for index in 1..=5 {
        let mut wallpaper = prepared.clone();
        wallpaper.index = index;
        links.push(api.page(&wallpaper, false).await?);
    }
    let request = payload(prepared, &assets, &links)?;
    let request_hash = hash(&request).map_err(|error| blocked(error.0))?;
    let source_hashes = assets
        .iter()
        .map(|asset| asset.sha256.clone())
        .collect::<Vec<_>>();
    if delivery
        .progress
        .as_object()
        .is_some_and(|value| value.is_empty())
    {
        let mut images = Vec::with_capacity(5);
        for asset in assets {
            let bytes = api.asset(asset).await?;
            if !transport::social_jpeg(&bytes) || bytes.len() > 5 * 1024 * 1024 {
                return Err(blocked("tumblr-media-invalid"));
            }
            images.push(bytes);
        }
        let post = api.create(settings, &request, images).await?;
        let id = post["id"]
            .as_str()
            .filter(|value| post_id(value))
            .ok_or(Outcome::Unknown("tumblr-create-response-unconfirmed"))?;
        return Ok(Outcome::Progress(json!(Progress {
            schema_version: 1,
            post_id: id.into(),
            blog_name: settings.blog_name.clone(),
            blog_uuid: settings.blog_uuid.clone(),
            source_hashes,
            request_hash
        })));
    }
    let progress = progress(&delivery.progress, settings, &source_hashes, &request_hash)?;
    let post = api
        .read(
            &format!(
                "/blog/{}/posts/{}?post_format=npf",
                settings.blog_uuid, progress.post_id
            ),
            &settings.access_token,
        )
        .await?;
    confirm(&post, &progress, &request, &delivery.collection_id)
}
pub(super) async fn send(
    delivery: &Delivery,
    credentials: &mut Credentials,
    prepared: &Prepared,
) -> Outcome {
    let result = async {
        if delivery.reconcile {
            return Err(Outcome::Unknown("tumblr-reconciliation-required"));
        }
        let mut settings = Settings::parse(
            credentials
                .get("tumblr")
                .ok_or(blocked("destination-not-configured"))?,
        )?;
        let api = Http(transport::client().map_err(|error| blocked(error.0))?);
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| blocked("tumblr-clock-invalid"))?
            .as_secs();
        authorize(&api, credentials, &mut settings, now).await?;
        identity(&api, &settings).await?;
        deliver(&api, delivery, prepared, &settings).await
    }
    .await;
    result.unwrap_or_else(|outcome| outcome)
}

#[cfg(test)]
mod tests;
