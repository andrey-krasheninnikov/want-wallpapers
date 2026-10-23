use super::{
    Delivery, Outcome,
    credentials::Credentials,
    hash,
    transport::{self, Asset, Prepared},
};
use base64::{Engine, engine::general_purpose::STANDARD};
use hmac::{Hmac, Mac};
use quick_xml::{Reader, events::Event};
use reqwest::{Client, RequestBuilder, multipart};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha1::Sha1;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

const REST: &str = "https://api.flickr.com/services/rest/";
const UPLOAD: &str = "https://up.flickr.com/services/upload/";
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
fn identifier(value: &str) -> bool {
    value
        .parse::<u64>()
        .is_ok_and(|id| id > 0 && id.to_string() == value)
}
fn user_id(value: &str) -> bool {
    value.split_once("@N").is_some_and(|(number, suffix)| {
        identifier(number) && suffix.len() == 2 && suffix.bytes().all(|byte| byte.is_ascii_digit())
    })
}
fn number(value: &Value) -> Option<u64> {
    value.as_u64().or_else(|| value.as_str()?.parse().ok())
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Settings {
    enabled: bool,
    commercial_api_approved: bool,
    user_id: String,
    api_key: String,
    api_secret: String,
    access_token: String,
    token_secret: String,
}
impl Settings {
    fn parse(value: &Value) -> Result<Self> {
        let settings: Self = serde_json::from_value(value.clone())
            .map_err(|_| blocked("flickr-configuration-invalid"))?;
        if !settings.enabled
            || !user_id(&settings.user_id)
            || !secret(&settings.api_key)
            || !secret(&settings.api_secret)
            || !secret(&settings.access_token)
            || !secret(&settings.token_secret)
        {
            return Err(blocked("flickr-configuration-invalid"));
        }
        if !settings.commercial_api_approved {
            return Err(blocked("flickr-commercial-api-approval-required"));
        }
        Ok(settings)
    }
}
fn encode(value: &str) -> String {
    let mut output = String::new();
    const HEX: &[u8; 16] = b"0123456789ABCDEF";
    for byte in value.bytes() {
        if byte.is_ascii_alphanumeric() || [b'-', b'.', b'_', b'~'].contains(&byte) {
            output.push(byte as char);
        } else {
            output.push('%');
            output.push(HEX[(byte >> 4) as usize] as char);
            output.push(HEX[(byte & 15) as usize] as char);
        }
    }
    output
}
fn signature(
    method: &str,
    url: &str,
    parameters: &[(String, String)],
    consumer_secret: &str,
    token_secret: &str,
) -> Result<String> {
    let mut encoded = parameters
        .iter()
        .map(|(key, value)| (encode(key), encode(value)))
        .collect::<Vec<_>>();
    encoded.sort();
    let normalized = encoded
        .iter()
        .map(|(key, value)| format!("{key}={value}"))
        .collect::<Vec<_>>()
        .join("&");
    let base = format!("{method}&{}&{}", encode(url), encode(&normalized));
    let key = format!("{}&{}", encode(consumer_secret), encode(token_secret));
    let mut mac = Hmac::<Sha1>::new_from_slice(key.as_bytes())
        .map_err(|_| blocked("flickr-signature-invalid"))?;
    mac.update(base.as_bytes());
    Ok(STANDARD.encode(mac.finalize().into_bytes()))
}
fn authorization(
    settings: &Settings,
    url: &str,
    parameters: &[(String, String)],
) -> Result<String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| blocked("flickr-clock-invalid"))?
        .as_secs()
        .to_string();
    let mut oauth = vec![
        ("oauth_consumer_key".to_owned(), settings.api_key.clone()),
        ("oauth_token".into(), settings.access_token.clone()),
        ("oauth_signature_method".into(), "HMAC-SHA1".into()),
        ("oauth_version".into(), "1.0".into()),
        ("oauth_timestamp".into(), timestamp),
        ("oauth_nonce".into(), Uuid::new_v4().simple().to_string()),
    ];
    let mut all = parameters.to_vec();
    all.extend(oauth.clone());
    let signature = signature(
        "POST",
        url,
        &all,
        &settings.api_secret,
        &settings.token_secret,
    )?;
    oauth.push(("oauth_signature".into(), signature));
    Ok(format!(
        "OAuth {}",
        oauth
            .iter()
            .map(|(key, value)| format!("{}=\"{}\"", encode(key), encode(value)))
            .collect::<Vec<_>>()
            .join(", ")
    ))
}
trait Api {
    async fn call(
        &self,
        settings: &Settings,
        method: &str,
        parameters: &[(&str, &str)],
        write: bool,
    ) -> Result<Value>;
    async fn upload(&self, settings: &Settings, metadata: &Value, image: Vec<u8>)
    -> Result<String>;
    async fn asset(&self, asset: &Asset) -> Result<Vec<u8>>;
    async fn page(&self, prepared: &Prepared) -> Result<String>;
}
struct Http(Client);
fn read_failure(outcome: Outcome) -> Outcome {
    match outcome {
        Outcome::Unknown(_) => retry("flickr-read-unavailable"),
        other => other,
    }
}
fn failure(code: u64, upload: bool) -> Outcome {
    match code {
        95..=100 => blocked("flickr-reauthorization-required"),
        3 if upload => Outcome::Unknown("flickr-upload-unconfirmed"),
        6 if upload => blocked("flickr-upload-quota-reached"),
        14 if upload => retry("flickr-upload-unavailable"),
        105 | 106 => Outcome::Unknown("flickr-write-unconfirmed"),
        _ => blocked("flickr-confirmed-rejection"),
    }
}
fn rpc(reply: transport::Reply) -> Result<Value> {
    if let Some(outcome) = reply.rejection() {
        return Err(outcome);
    }
    match reply.body["stat"].as_str() {
        Some("ok") => Ok(reply.body),
        Some("fail") => Err(number(&reply.body["code"])
            .map(|code| failure(code, false))
            .unwrap_or(Outcome::Unknown("flickr-response-unconfirmed"))),
        _ => Err(Outcome::Unknown("flickr-response-unconfirmed")),
    }
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct UploadResponse {
    #[serde(rename = "@stat")]
    stat: String,
    photoid: Option<String>,
    err: Option<UploadError>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct UploadError {
    #[serde(rename = "@code")]
    code: u64,
    #[serde(rename = "@msg")]
    _message: Option<String>,
}
fn upload_response(bytes: &[u8]) -> Result<String> {
    let invalid = || Outcome::Unknown("flickr-upload-unconfirmed");
    let xml = std::str::from_utf8(bytes).map_err(|_| invalid())?;
    let mut reader = Reader::from_str(xml);
    let mut depth = 0_u8;
    let mut roots = 0;
    loop {
        match reader.read_event().map_err(|_| invalid())? {
            Event::Start(element) => {
                if depth == 0 {
                    roots += 1;
                    if element.name().as_ref() != "rsp" || roots != 1 {
                        return Err(invalid());
                    }
                }
                depth = depth
                    .checked_add(1)
                    .filter(|value| *value <= 3)
                    .ok_or_else(invalid)?;
            }
            Event::End(_) => depth = depth.checked_sub(1).ok_or_else(invalid)?,
            Event::Empty(_) if depth == 0 => return Err(invalid()),
            Event::DocType(_) => return Err(invalid()),
            Event::Text(text)
                if depth == 0 && !text.as_ref().bytes().all(|byte| byte.is_ascii_whitespace()) =>
            {
                return Err(invalid());
            }
            Event::Eof => {
                if depth != 0 || roots != 1 {
                    return Err(invalid());
                }
                break;
            }
            _ => {}
        }
    }
    let response: UploadResponse = quick_xml::de::from_str(xml).map_err(|_| invalid())?;
    match (response.stat.as_str(), response.photoid, response.err) {
        ("ok", Some(id), None) if identifier(&id) => Ok(id),
        ("fail", None, Some(error)) => Err(failure(error.code, true)),
        _ => Err(invalid()),
    }
}
fn upload_parameters(metadata: &Value) -> Vec<(String, String)> {
    let mut parameters = vec![
        (
            "title".into(),
            metadata["title"].as_str().unwrap_or_default().into(),
        ),
        (
            "description".into(),
            metadata["description"].as_str().unwrap_or_default().into(),
        ),
    ];
    for (key, value) in [
        ("is_public", "0"),
        ("is_friend", "0"),
        ("is_family", "0"),
        ("safety_level", "1"),
        ("content_type", "3"),
        ("hidden", "1"),
    ] {
        parameters.push((key.into(), value.into()));
    }
    parameters
}
impl Http {
    fn request(
        &self,
        settings: &Settings,
        url: &str,
        parameters: &[(String, String)],
    ) -> Result<RequestBuilder> {
        Ok(self
            .0
            .post(url)
            .header(
                reqwest::header::AUTHORIZATION,
                authorization(settings, url, parameters)?,
            )
            .header(
                reqwest::header::USER_AGENT,
                "WantWallpapers/1 (+https://wallpapers.want.foundation/)",
            ))
    }
}
impl Api for Http {
    async fn call(
        &self,
        settings: &Settings,
        method: &str,
        parameters: &[(&str, &str)],
        write: bool,
    ) -> Result<Value> {
        let mut form = parameters
            .iter()
            .map(|(key, value)| (key.to_string(), value.to_string()))
            .collect::<Vec<_>>();
        form.extend([
            ("method".into(), method.into()),
            ("format".into(), "json".into()),
            ("nojsoncallback".into(), "1".into()),
        ]);
        let result = async {
            rpc(transport::write(self.request(settings, REST, &form)?.form(&form)).await?)
        }
        .await;
        if write {
            result
        } else {
            result.map_err(read_failure)
        }
    }
    async fn upload(
        &self,
        settings: &Settings,
        metadata: &Value,
        image: Vec<u8>,
    ) -> Result<String> {
        let parameters = upload_parameters(metadata);
        // Flickr signs every non-file upload parameter, including multipart metadata.
        let request = self.request(settings, UPLOAD, &parameters)?;
        let mut form = multipart::Form::new();
        for (key, value) in parameters {
            form = form.text(key, value);
        }
        form = form.part(
            "photo",
            multipart::Part::bytes(image)
                .file_name("preview.jpg")
                .mime_str("image/jpeg")
                .map_err(|_| blocked("flickr-media-invalid"))?,
        );
        let response = request
            .multipart(form)
            .send()
            .await
            .map_err(|_| Outcome::Unknown("flickr-upload-unconfirmed"))?;
        let status = response.status();
        let retry_after = response
            .headers()
            .get(reqwest::header::RETRY_AFTER)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| transport::retry_after(value, SystemTime::now()));
        if let Some(outcome) = (transport::Reply {
            status,
            body: Value::Null,
            retry_after,
        })
        .rejection()
        {
            return Err(outcome);
        }
        let bytes = transport::bytes(response, 65536)
            .await
            .map_err(|_| Outcome::Unknown("flickr-upload-unconfirmed"))?;
        upload_response(&bytes)
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
async fn identity(api: &impl Api, settings: &Settings) -> Result<()> {
    let token = api
        .call(settings, "flickr.auth.oauth.checkToken", &[], false)
        .await?;
    if token.pointer("/oauth/user/nsid").and_then(Value::as_str) != Some(&settings.user_id)
        || token
            .pointer("/oauth/token/_content")
            .and_then(Value::as_str)
            != Some(&settings.access_token)
        || token
            .pointer("/oauth/perms/_content")
            .and_then(Value::as_str)
            != Some("write")
    {
        return Err(blocked("flickr-upload-authorization-mismatch"));
    }
    Ok(())
}
async fn quota(api: &impl Api, settings: &Settings, bytes: usize) -> Result<()> {
    let status = api
        .call(settings, "flickr.people.getUploadStatus", &[], false)
        .await?;
    let user = &status["user"];
    if user["id"] != settings.user_id {
        return Err(blocked("flickr-account-mismatch"));
    }
    if number(&user["ispro"]) != Some(1) {
        return Err(blocked("flickr-commercial-account-required"));
    }
    let filesize =
        number(&user["filesize"]["maxbytes"]).ok_or(blocked("flickr-quota-unconfirmed"))?;
    let unlimited = number(&user["bandwidth"]["unlimited"]) == Some(1);
    let remaining = number(&user["bandwidth"]["remainingbytes"]);
    if filesize < bytes as u64 || (!unlimited && remaining.is_none_or(|value| value < bytes as u64))
    {
        return Err(blocked("flickr-upload-quota-reached"));
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
        return Err(blocked("flickr-media-invalid"));
    }
    Ok(items[0])
}
fn escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
fn metadata(prepared: &Prepared, link: &str) -> Result<Value> {
    if prepared.title.chars().count() > 255
        || prepared
            .description
            .chars()
            .any(|value| value.is_control() && !['\n', '\t'].contains(&value))
    {
        return Err(blocked("flickr-content-invalid"));
    }
    let description = format!(
        "{}\n\n<a href=\"{}\">{}</a>",
        escape(&prepared.description),
        escape(link),
        escape(link)
    );
    Ok(
        json!({"title":prepared.title,"description":description,"contentType":3,"safetyLevel":1,"license":0,"public":true,"canonicalUrl":link}),
    )
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Progress {
    schema_version: u8,
    photo_id: String,
    user_id: String,
    source_hash: String,
    request_hash: String,
    phase: String,
}
fn progress(
    value: &Value,
    settings: &Settings,
    asset: &Asset,
    request_hash: &str,
) -> Result<Progress> {
    let progress: Progress =
        serde_json::from_value(value.clone()).map_err(|_| blocked("flickr-progress-invalid"))?;
    if progress.schema_version != 1
        || !identifier(&progress.photo_id)
        || progress.user_id != settings.user_id
        || progress.source_hash != asset.sha256
        || progress.request_hash != request_hash
        || !["uploaded", "publish"].contains(&progress.phase.as_str())
    {
        return Err(blocked("flickr-progress-identity-mismatch"));
    }
    Ok(progress)
}
fn photo_matches(photo: &Value, progress: &Progress, metadata: &Value) -> bool {
    photo["id"] == progress.photo_id
        && photo.pointer("/owner/nsid").and_then(Value::as_str) == Some(&progress.user_id)
        && photo.pointer("/title/_content") == metadata.get("title")
        && photo.pointer("/description/_content") == metadata.get("description")
        && photo
            .get("content_type")
            .is_none_or(|value| number(value) == Some(3))
        && photo
            .get("safety_level")
            .is_none_or(|value| number(value) == Some(1))
        && number(&photo["visibility"]["isfriend"]) == Some(0)
        && number(&photo["visibility"]["isfamily"]) == Some(0)
}
async fn deliver(
    api: &impl Api,
    delivery: &Delivery,
    prepared: &Prepared,
    settings: &Settings,
) -> Result<Outcome> {
    let asset = media(prepared)?;
    let link = api.page(prepared).await?;
    let metadata = metadata(prepared, &link)?;
    let request_hash = hash(&metadata).map_err(|error| blocked(error.0))?;
    if delivery
        .progress
        .as_object()
        .is_some_and(|value| value.is_empty())
    {
        let bytes = api.asset(asset).await?;
        if bytes.len() > 5 * 1024 * 1024 || !transport::social_jpeg(&bytes) {
            return Err(blocked("flickr-media-invalid"));
        }
        quota(api, settings, bytes.len()).await?;
        let id = api.upload(settings, &metadata, bytes).await?;
        if !identifier(&id) {
            return Err(Outcome::Unknown("flickr-upload-unconfirmed"));
        }
        return Ok(Outcome::Progress(json!(Progress {
            schema_version: 1,
            photo_id: id,
            user_id: settings.user_id.clone(),
            source_hash: asset.sha256.clone(),
            request_hash,
            phase: "uploaded".into()
        })));
    }
    let mut progress = progress(&delivery.progress, settings, asset, &request_hash)?;
    let response = api
        .call(
            settings,
            "flickr.photos.getInfo",
            &[("photo_id", &progress.photo_id)],
            false,
        )
        .await?;
    let photo = &response["photo"];
    if !photo_matches(photo, &progress, &metadata) {
        return Err(blocked("flickr-photo-readback-mismatch"));
    }
    let public = number(&photo["visibility"]["ispublic"])
        .ok_or(blocked("flickr-photo-readback-mismatch"))?;
    if progress.phase == "uploaded" {
        if public != 0 {
            return Err(blocked("flickr-private-staging-required"));
        }
        if number(&photo["license"]) != Some(0) {
            api.call(
                settings,
                "flickr.photos.licenses.setLicense",
                &[("photo_id", &progress.photo_id), ("license_id", "0")],
                true,
            )
            .await?;
        } else {
            progress.phase = "publish".into();
        }
        return Ok(Outcome::Progress(json!(progress)));
    }
    if number(&photo["license"]) != Some(0) {
        return Err(blocked("flickr-license-readback-mismatch"));
    }
    if public == 0 {
        quota(api, settings, 0).await?;
        api.call(
            settings,
            "flickr.photos.setPerms",
            &[
                ("photo_id", &progress.photo_id),
                ("is_public", "1"),
                ("is_friend", "0"),
                ("is_family", "0"),
            ],
            true,
        )
        .await?;
        return Ok(Outcome::Progress(json!(progress)));
    }
    if public != 1 {
        return Err(blocked("flickr-photo-readback-mismatch"));
    }
    Ok(Outcome::Delivered(
        json!({"schemaVersion":1,"kind":"flickr-photo","collectionId":delivery.collection_id,"item":delivery.item,"photoId":progress.photo_id,"userId":progress.user_id,"sourceHash":progress.source_hash,"requestHash":progress.request_hash,"canonicalUrl":link,"url":format!("https://www.flickr.com/photos/{}/{}/",progress.user_id,progress.photo_id)}),
    ))
}
pub(super) async fn send(
    delivery: &Delivery,
    credentials: &mut Credentials,
    prepared: &Prepared,
) -> Outcome {
    let result = async {
        if delivery.reconcile {
            return Err(Outcome::Unknown("flickr-reconciliation-required"));
        }
        let settings = Settings::parse(
            credentials
                .get("flickr")
                .ok_or(blocked("destination-not-configured"))?,
        )?;
        let api = Http(transport::client().map_err(|error| blocked(error.0))?);
        identity(&api, &settings).await?;
        deliver(&api, delivery, prepared, &settings).await
    }
    .await;
    result.unwrap_or_else(|outcome| outcome)
}
#[cfg(test)]
mod tests;
