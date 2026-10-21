use super::{
    Delivery, Outcome,
    credentials::Credentials,
    hash,
    transport::{self, Asset, Prepared},
};
use base64::{Engine, engine::general_purpose::STANDARD};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::time::{SystemTime, UNIX_EPOCH};

const API: &str = "https://api.pinterest.com/v5";
const SCOPES: [&str; 5] = [
    "boards:read",
    "boards:write",
    "pins:read",
    "pins:write",
    "user_accounts:read",
];
type Result<T> = std::result::Result<T, Outcome>;
fn blocked(code: &'static str) -> Outcome {
    Outcome::Blocked(code)
}
fn retry(code: &'static str) -> Outcome {
    Outcome::Retry { seconds: 300, code }
}
fn identifier(value: &str) -> bool {
    !value.is_empty() && value.len() <= 30 && value.bytes().all(|byte| byte.is_ascii_digit())
}
fn secret(value: &str) -> bool {
    !value.is_empty() && value.len() <= 4096 && value.bytes().all(|byte| byte.is_ascii_graphic())
}
fn scopes(value: &str) -> bool {
    SCOPES
        .iter()
        .all(|scope| value.split_whitespace().any(|value| value == *scope))
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
enum Disclosure {
    #[serde(rename = "AI_MODIFIED")]
    Modified,
    #[serde(rename = "SYNTHETIC_PERFORMER")]
    SyntheticPerformer,
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Settings {
    enabled: bool,
    access_tier: String,
    username: String,
    board_id: String,
    client_id: String,
    client_secret: String,
    access_token: String,
    refresh_token: String,
    access_token_expires_at: u64,
    scope: String,
    #[serde(default)]
    refresh_pending: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    ai_disclosures: Option<Vec<Disclosure>>,
}
impl Settings {
    fn parse(value: &Value) -> Result<Self> {
        let settings: Self = serde_json::from_value(value.clone())
            .map_err(|_| blocked("pinterest-configuration-invalid"))?;
        if !settings.enabled
            || !identifier(&settings.board_id)
            || !identifier(&settings.client_id)
            || settings.username.is_empty()
            || settings.username.len() > 64
            || !settings
                .username
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
            || !secret(&settings.client_secret)
            || !secret(&settings.access_token)
            || !secret(&settings.refresh_token)
            || !settings.access_token.starts_with("pina")
            || !settings.refresh_token.starts_with("pinr")
            || !scopes(&settings.scope)
            || settings
                .ai_disclosures
                .as_ref()
                .is_some_and(|items| items.len() > 2)
        {
            return Err(blocked("pinterest-configuration-invalid"));
        }
        if settings.access_tier != "standard" {
            return Err(blocked("pinterest-standard-access-required"));
        }
        if settings.refresh_pending {
            return Err(blocked("pinterest-reauthorization-required"));
        }
        Ok(settings)
    }
    fn value(&self) -> Result<Value> {
        serde_json::to_value(self).map_err(|_| blocked("pinterest-configuration-invalid"))
    }
}
trait Api {
    async fn read(&self, path: &str, token: &str) -> Result<Value>;
    async fn create(&self, token: &str, payload: &Value) -> Result<Value>;
    async fn refresh(&self, settings: &Settings) -> Result<Value>;
    async fn asset(&self, asset: &Asset) -> Result<Vec<u8>>;
    async fn page(&self, prepared: &Prepared) -> Result<String>;
}
struct Http(Client);
fn read_failure(outcome: Outcome) -> Outcome {
    match outcome {
        Outcome::Unknown(_) => retry("pinterest-read-unavailable"),
        other => other,
    }
}
impl Api for Http {
    async fn read(&self, path: &str, token: &str) -> Result<Value> {
        let reply = transport::write(self.0.get(format!("{API}{path}")).bearer_auth(token))
            .await
            .map_err(read_failure)?;
        if let Some(outcome) = reply.rejection() {
            return Err(read_failure(outcome));
        }
        Ok(reply.body)
    }
    async fn create(&self, token: &str, payload: &Value) -> Result<Value> {
        let reply = transport::write(
            self.0
                .post(format!("{API}/pins"))
                .bearer_auth(token)
                .json(payload),
        )
        .await?;
        if let Some(outcome) = reply.rejection() {
            return Err(outcome);
        }
        Ok(reply.body)
    }
    async fn refresh(&self, settings: &Settings) -> Result<Value> {
        let reply = transport::write(
            self.0
                .post(format!("{API}/oauth/token"))
                .basic_auth(&settings.client_id, Some(&settings.client_secret))
                .form(&[
                    ("grant_type", "refresh_token"),
                    ("refresh_token", &settings.refresh_token),
                ]),
        )
        .await?;
        if let Some(outcome) = reply.rejection() {
            return Err(outcome);
        }
        Ok(reply.body)
    }
    async fn asset(&self, asset: &Asset) -> Result<Vec<u8>> {
        asset
            .download(&self.0)
            .await
            .map_err(|error| retry(error.0))
    }
    async fn page(&self, prepared: &Prepared) -> Result<String> {
        transport::check_page(&self.0, prepared, false)
            .await
            .map_err(|error| retry(error.0))
    }
}
fn refreshed(settings: &mut Settings, response: &Value, now: u64) -> Result<()> {
    let access = response["access_token"]
        .as_str()
        .filter(|value| secret(value) && value.starts_with("pina"))
        .ok_or(blocked("pinterest-reauthorization-required"))?;
    let refresh = response["refresh_token"]
        .as_str()
        .filter(|value| secret(value) && value.starts_with("pinr"))
        .ok_or(blocked("pinterest-reauthorization-required"))?;
    let lifetime = response["expires_in"]
        .as_u64()
        .filter(|value| *value > 60 && *value <= 90 * 86400)
        .ok_or(blocked("pinterest-reauthorization-required"))?;
    let scope = response["scope"]
        .as_str()
        .filter(|value| scopes(value))
        .ok_or(blocked("pinterest-reauthorization-required"))?;
    if response["token_type"]
        .as_str()
        .is_none_or(|value| !value.eq_ignore_ascii_case("bearer"))
    {
        return Err(blocked("pinterest-reauthorization-required"));
    }
    settings.access_token = access.into();
    settings.refresh_token = refresh.into();
    settings.scope = scope.into();
    settings.access_token_expires_at = now
        .checked_add(lifetime)
        .ok_or(blocked("pinterest-clock-invalid"))?;
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
        .replace("pinterest", settings.value()?)
        .map_err(|error| blocked(error.0))?;
    let response = match api.refresh(settings).await {
        Ok(response) => response,
        Err(Outcome::Retry { seconds, code }) => {
            settings.refresh_pending = false;
            credentials
                .replace("pinterest", settings.value()?)
                .map_err(|error| blocked(error.0))?;
            return Err(Outcome::Retry { seconds, code });
        }
        Err(_) => return Err(blocked("pinterest-reauthorization-required")),
    };
    refreshed(settings, &response, now)?;
    // Save rotated tokens before any public write; a lost refresh requires owner reauthorization.
    credentials
        .replace("pinterest", settings.value()?)
        .map_err(|error| blocked(error.0))
}
async fn identities(api: &impl Api, settings: &Settings) -> Result<()> {
    let account = api.read("/user_account", &settings.access_token).await?;
    if account["username"]
        .as_str()
        .is_none_or(|value| !value.eq_ignore_ascii_case(&settings.username))
    {
        return Err(blocked("pinterest-account-mismatch"));
    }
    let board = api
        .read(
            &format!("/boards/{}", settings.board_id),
            &settings.access_token,
        )
        .await?;
    if board["id"] != settings.board_id
        || board["privacy"] != "PUBLIC"
        || board.get("is_ads_only").is_some_and(|value| value != false)
        || board
            .pointer("/owner/username")
            .and_then(Value::as_str)
            .is_none_or(|value| !value.eq_ignore_ascii_case(&settings.username))
    {
        return Err(blocked("pinterest-public-board-required"));
    }
    Ok(())
}
fn media(prepared: &Prepared) -> Result<&Asset> {
    let items = prepared
        .assets
        .iter()
        .filter(|asset| asset.role == "social" && asset.design as usize == prepared.index)
        .collect::<Vec<_>>();
    if items.len() != 1 {
        return Err(blocked("pinterest-media-invalid"));
    }
    Ok(items[0])
}
fn payload(prepared: &Prepared, settings: &Settings, bytes: &[u8], link: &str) -> Result<Value> {
    let alt = &prepared
        .manifest
        .wallpapers
        .get(prepared.index - 1)
        .ok_or(blocked("invalid-delivery-item"))?
        .title["en"];
    if prepared.title.chars().count() > 100
        || prepared.description.chars().count() > 800
        || alt.chars().count() > 500
        || !transport::social_jpeg(bytes)
        || bytes.len() > 5 * 1024 * 1024
    {
        return Err(blocked("pinterest-content-invalid"));
    }
    let mut payload = json!({"title":prepared.title,"description":prepared.description,"alt_text":alt,"link":link,"board_id":settings.board_id,
        "media_source":{"source_type":"image_base64","content_type":"image/jpeg","data":STANDARD.encode(bytes)}});
    if let Some(disclosures) = &settings.ai_disclosures {
        payload["ai_disclosures"] = json!({"values":disclosures});
    }
    Ok(payload)
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Progress {
    schema_version: u8,
    pin_id: String,
    board_id: String,
    username: String,
    source_hash: String,
    request_hash: String,
}
fn progress(
    value: &Value,
    settings: &Settings,
    asset: &Asset,
    request_hash: &str,
) -> Result<Progress> {
    let progress: Progress =
        serde_json::from_value(value.clone()).map_err(|_| blocked("pinterest-progress-invalid"))?;
    if progress.schema_version != 1
        || !identifier(&progress.pin_id)
        || progress.board_id != settings.board_id
        || !progress.username.eq_ignore_ascii_case(&settings.username)
        || progress.source_hash != asset.sha256
        || progress.request_hash != request_hash
    {
        return Err(blocked("pinterest-progress-identity-mismatch"));
    }
    Ok(progress)
}
fn confirm(
    pin: &Value,
    progress: &Progress,
    request: &Value,
    collection: &str,
    item: &str,
) -> Result<Outcome> {
    if pin["id"] != progress.pin_id
        || pin["board_id"] != progress.board_id
        || pin["link"] != request["link"]
        || pin["title"] != request["title"]
        || pin["description"] != request["description"]
        || pin["is_owner"] != true
        || pin.pointer("/media/media_type").and_then(Value::as_str) != Some("image")
        || pin
            .pointer("/board_owner/username")
            .and_then(Value::as_str)
            .is_none_or(|value| !value.eq_ignore_ascii_case(&progress.username))
        || request
            .get("ai_disclosures")
            .is_some_and(|value| pin.get("ai_disclosures") != Some(value))
    {
        return Err(blocked("pinterest-pin-readback-mismatch"));
    }
    Ok(Outcome::Delivered(
        json!({"schemaVersion":1,"kind":"pinterest-pin","collectionId":collection,"item":item,"pinId":progress.pin_id,"boardId":progress.board_id,"username":progress.username,"canonicalUrl":request["link"],"sourceHash":progress.source_hash,"requestHash":progress.request_hash,"url":format!("https://www.pinterest.com/pin/{}/",progress.pin_id)}),
    ))
}
async fn deliver(
    api: &impl Api,
    delivery: &Delivery,
    prepared: &Prepared,
    settings: &Settings,
) -> Result<Outcome> {
    let asset = media(prepared)?;
    let link = api.page(prepared).await?;
    let bytes = api.asset(asset).await?;
    let request = payload(prepared, settings, &bytes, &link)?;
    let request_hash = hash(&request).map_err(|error| blocked(error.0))?;
    if delivery
        .progress
        .as_object()
        .is_some_and(|value| value.is_empty())
    {
        let pin = api.create(&settings.access_token, &request).await?;
        let id = pin["id"]
            .as_str()
            .filter(|value| identifier(value))
            .ok_or(Outcome::Unknown("pinterest-create-response-unconfirmed"))?;
        return Ok(Outcome::Progress(json!(Progress {
            schema_version: 1,
            pin_id: id.into(),
            board_id: settings.board_id.clone(),
            username: settings.username.clone(),
            source_hash: asset.sha256.clone(),
            request_hash
        })));
    }
    let progress = progress(&delivery.progress, settings, asset, &request_hash)?;
    let pin = api
        .read(
            &format!("/pins/{}", progress.pin_id),
            &settings.access_token,
        )
        .await?;
    confirm(
        &pin,
        &progress,
        &request,
        &delivery.collection_id,
        &delivery.item,
    )
}
pub(super) async fn send(
    delivery: &Delivery,
    credentials: &mut Credentials,
    prepared: &Prepared,
) -> Outcome {
    let result = async {
        if delivery.reconcile {
            return Err(Outcome::Unknown("pinterest-reconciliation-required"));
        }
        let mut settings = Settings::parse(
            credentials
                .get("pinterest")
                .ok_or(blocked("destination-not-configured"))?,
        )?;
        let api = Http(transport::client().map_err(|error| blocked(error.0))?);
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| blocked("pinterest-clock-invalid"))?
            .as_secs();
        authorize(&api, credentials, &mut settings, now).await?;
        identities(&api, &settings).await?;
        deliver(&api, delivery, prepared, &settings).await
    }
    .await;
    result.unwrap_or_else(|outcome| outcome)
}

#[cfg(test)]
mod tests;
