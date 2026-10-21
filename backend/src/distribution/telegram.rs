use super::{
    Delivery, Outcome,
    credentials::Credentials,
    store::Store,
    transport::{self, Asset, Prepared},
};
use reqwest::{Client, multipart};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{collections::BTreeSet, io::Cursor};

const BOT: &str = "want_wallpapers_bot";
const CHANNEL: &str = "want_wallpapers";
const SET: &str = "want_wallpapers_collections_by_want_wallpapers_bot";
const TITLE: &str = "Want Wallpapers Collections";
type Result<T> = std::result::Result<T, Outcome>;
fn blocked(code: &'static str) -> Outcome {
    Outcome::Blocked(code)
}
fn retry(code: &'static str) -> Outcome {
    Outcome::Retry { seconds: 300, code }
}
fn id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 256
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || [b'-', b'_'].contains(&byte))
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Settings {
    enabled: bool,
    token: String,
    owner_user_id: u64,
    channel_id: i64,
}
impl Settings {
    fn parse(value: &Value) -> Result<Self> {
        let settings: Self = serde_json::from_value(value.clone())
            .map_err(|_| blocked("telegram-configuration-invalid"))?;
        let valid_token = settings.token.split_once(':').is_some_and(|(number, key)| {
            number.parse::<u64>().is_ok_and(|value| value > 0) && id(key) && key.len() >= 20
        });
        if !settings.enabled
            || !valid_token
            || settings.owner_user_id == 0
            || settings.owner_user_id > (1u64 << 52)
            || settings.channel_id >= 0
        {
            return Err(blocked("telegram-configuration-invalid"));
        }
        Ok(settings)
    }
}
struct Upload {
    field: String,
    bytes: Vec<u8>,
    filename: String,
    mime: &'static str,
}
trait Api {
    async fn call(
        &self,
        method: &'static str,
        parameters: Value,
        files: Vec<Upload>,
    ) -> Result<Value>;
    async fn asset(&self, asset: &Asset) -> Result<Vec<u8>>;
    async fn page(&self, prepared: &Prepared, collection: bool) -> Result<String>;
}
struct Http<'a> {
    client: Client,
    settings: &'a Settings,
}
impl Api for Http<'_> {
    async fn call(
        &self,
        method: &'static str,
        parameters: Value,
        files: Vec<Upload>,
    ) -> Result<Value> {
        // Request errors contain the token-bearing URL and must never leave this boundary.
        let request = self.client.post(format!(
            "https://api.telegram.org/bot{}/{method}",
            self.settings.token
        ));
        let request = if files.is_empty() {
            request.json(&parameters)
        } else {
            let mut form = multipart::Form::new();
            for (key, value) in parameters
                .as_object()
                .ok_or(blocked("telegram-request-invalid"))?
            {
                let text = value
                    .as_str()
                    .map(str::to_owned)
                    .unwrap_or_else(|| value.to_string());
                form = form.text(key.clone(), text);
            }
            for file in files {
                let part = multipart::Part::bytes(file.bytes)
                    .file_name(file.filename)
                    .mime_str(file.mime)
                    .map_err(|_| blocked("telegram-media-invalid"))?;
                form = form.part(file.field, part);
            }
            request.multipart(form)
        };
        let reply = transport::write(request)
            .await
            .map_err(|outcome| safe_failure(method, outcome))?;
        response(method, reply)
    }

    async fn asset(&self, asset: &Asset) -> Result<Vec<u8>> {
        asset
            .download(&self.client)
            .await
            .map_err(|error| retry(error.0))
    }
    async fn page(&self, prepared: &Prepared, collection: bool) -> Result<String> {
        transport::check_page(&self.client, prepared, collection)
            .await
            .map_err(|error| retry(error.0))
    }
}
fn safe_failure(method: &str, outcome: Outcome) -> Outcome {
    match outcome {
        Outcome::Unknown(_) if method.starts_with("get") => retry("telegram-read-unavailable"),
        other => other,
    }
}
fn response(method: &str, reply: transport::Reply) -> Result<Value> {
    if reply.status.as_u16() == 429 {
        return Err(Outcome::Retry {
            seconds: reply
                .body
                .pointer("/parameters/retry_after")
                .and_then(Value::as_u64)
                .filter(|value| *value <= i32::MAX as u64)
                .map(|value| value as u32)
                .or(reply.retry_after)
                .unwrap_or(300),
            code: "provider-rate-limit",
        });
    }
    if method == "getStickerSet"
        && reply.status.as_u16() == 400
        && reply.body["ok"] == false
        && reply.body["error_code"] == 400
        && reply.body["description"] == "Bad Request: STICKERSET_INVALID"
    {
        return Ok(Value::Null);
    }
    if let Some(outcome) = reply.rejection() {
        return Err(safe_failure(method, outcome));
    }
    if reply.body["ok"] != true || reply.body.get("result").is_none() {
        return Err(safe_failure(
            method,
            Outcome::Unknown("telegram-response-unconfirmed"),
        ));
    }
    Ok(reply.body["result"].clone())
}
async fn identities(api: &impl Api, settings: &Settings) -> Result<u64> {
    let me = api.call("getMe", json!({}), vec![]).await?;
    let bot = me["id"]
        .as_u64()
        .filter(|value| *value > 0)
        .ok_or(blocked("telegram-bot-mismatch"))?;
    if me["is_bot"] != true
        || me["username"]
            .as_str()
            .is_none_or(|value| !value.eq_ignore_ascii_case(BOT))
        || settings
            .token
            .split(':')
            .next()
            .and_then(|value| value.parse::<u64>().ok())
            != Some(bot)
    {
        return Err(blocked("telegram-bot-mismatch"));
    }
    let chat = api
        .call("getChat", json!({"chat_id": settings.channel_id}), vec![])
        .await?;
    if chat["id"].as_i64() != Some(settings.channel_id)
        || chat["type"] != "channel"
        || chat["username"]
            .as_str()
            .is_none_or(|value| !value.eq_ignore_ascii_case(CHANNEL))
    {
        return Err(blocked("telegram-channel-mismatch"));
    }
    let member = api
        .call(
            "getChatMember",
            json!({"chat_id":settings.channel_id,"user_id":bot}),
            vec![],
        )
        .await?;
    if member.pointer("/user/id").and_then(Value::as_u64) != Some(bot)
        || member["status"] != "administrator"
        || member["can_post_messages"] != true
    {
        return Err(blocked("telegram-posting-permission-required"));
    }
    Ok(bot)
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Sticker {
    file_unique_id: String,
    custom_emoji_id: String,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Uploaded {
    design: u8,
    source_hash: String,
    file_id: String,
    file_unique_id: String,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
enum Action {
    Create,
    Add { design: u8 },
    Permission,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Progress {
    schema_version: u8,
    bot_id: u64,
    owner_user_id: u64,
    channel_id: i64,
    base: Vec<Sticker>,
    uploads: Vec<Uploaded>,
    action: Option<Action>,
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Receipt {
    schema_version: u8,
    kind: String,
    collection_id: String,
    package_hash: String,
    set_name: String,
    progress: Progress,
    stickers: Vec<Sticker>,
}
impl Progress {
    fn valid(&self, bot: u64, settings: &Settings, assets: &[&Asset]) -> bool {
        self.schema_version == 1
            && self.bot_id == bot
            && self.owner_user_id == settings.owner_user_id
            && self.channel_id == settings.channel_id
            && valid_stickers(&self.base)
            && self.base.len() <= 195
            && self.uploads.len() <= 5
            && self.uploads.iter().enumerate().all(|(index, upload)| {
                upload.design as usize == index + 1
                    && assets
                        .get(index)
                        .is_some_and(|asset| asset.sha256 == upload.source_hash)
                    && id(&upload.file_id)
                    && id(&upload.file_unique_id)
                    && !self
                        .base
                        .iter()
                        .any(|item| item.file_unique_id == upload.file_unique_id)
            })
            && self
                .uploads
                .iter()
                .map(|item| &item.file_unique_id)
                .collect::<BTreeSet<_>>()
                .len()
                == self.uploads.len()
            && (self.action.is_none() || self.uploads.len() == 5)
            && match self.action {
                Some(Action::Add { design }) => (1..=5).contains(&design),
                _ => true,
            }
    }
    fn outcome(&self) -> Result<Outcome> {
        Ok(Outcome::Progress(
            serde_json::to_value(self).map_err(|_| blocked("telegram-progress-invalid"))?,
        ))
    }
}
fn valid_stickers(stickers: &[Sticker]) -> bool {
    stickers.len() <= 200
        && stickers
            .iter()
            .all(|item| id(&item.file_unique_id) && id(&item.custom_emoji_id))
        && stickers
            .iter()
            .map(|item| &item.file_unique_id)
            .collect::<BTreeSet<_>>()
            .len()
            == stickers.len()
        && stickers
            .iter()
            .map(|item| &item.custom_emoji_id)
            .collect::<BTreeSet<_>>()
            .len()
            == stickers.len()
}
fn assets<'a>(prepared: &'a Prepared, role: &str) -> Result<Vec<&'a Asset>> {
    let mut assets: Vec<_> = prepared
        .assets
        .iter()
        .filter(|asset| asset.role == role)
        .collect();
    assets.sort_by_key(|asset| asset.design);
    if assets.len() != 5
        || assets
            .iter()
            .enumerate()
            .any(|(index, asset)| asset.design as usize != index + 1)
        || assets
            .iter()
            .map(|asset| &asset.sha256)
            .collect::<BTreeSet<_>>()
            .len()
            != 5
    {
        return Err(blocked("telegram-media-invalid"));
    }
    if role == "emoji"
        && assets.iter().any(|asset| {
            asset
                .emoji
                .as_ref()
                .is_none_or(|emoji| emoji.trim().is_empty() || emoji.chars().count() > 16)
        })
    {
        return Err(blocked("telegram-emoji-association-required"));
    }
    Ok(assets)
}
fn transparent_png(bytes: &[u8]) -> bool {
    if bytes.len() > 512 * 1024 {
        return false;
    }
    let mut decoder =
        png::Decoder::new_with_limits(Cursor::new(bytes), png::Limits { bytes: 1024 * 1024 });
    decoder.set_transformations(png::Transformations::EXPAND | png::Transformations::STRIP_16);
    let Ok(mut reader) = decoder.read_info() else {
        return false;
    };
    if reader.info().width != 100
        || reader.info().height != 100
        || reader.info().animation_control.is_some()
    {
        return false;
    }
    let Some(size) = reader.output_buffer_size().filter(|value| *value <= 40000) else {
        return false;
    };
    let mut buffer = vec![0; size];
    let Ok(info) = reader.next_frame(&mut buffer) else {
        return false;
    };
    let channels = match info.color_type {
        png::ColorType::Rgba => 4,
        png::ColorType::GrayscaleAlpha => 2,
        _ => return false,
    };
    let pixels = &buffer[..info.buffer_size()];
    pixels
        .chunks_exact(channels)
        .any(|pixel| pixel[channels - 1] < 255)
        && pixels
            .chunks_exact(channels)
            .any(|pixel| pixel[channels - 1] > 0)
}
// shortcut: JPEG framing and dimensions rely on approved source hashes; decode fully if that approval boundary changes.
fn jpeg(bytes: &[u8]) -> bool {
    if !bytes.starts_with(&[0xff, 0xd8]) || !bytes.ends_with(&[0xff, 0xd9]) {
        return false;
    }
    let mut cursor = 2;
    while cursor + 4 <= bytes.len() {
        if bytes[cursor] != 0xff {
            return false;
        }
        while cursor < bytes.len() && bytes[cursor] == 0xff {
            cursor += 1;
        }
        let Some(&marker) = bytes.get(cursor) else {
            return false;
        };
        cursor += 1;
        if marker == 0xda || marker == 0xd9 {
            return false;
        }
        if marker == 1 || (0xd0..=0xd7).contains(&marker) {
            continue;
        }
        if cursor + 2 > bytes.len() {
            return false;
        }
        let length = u16::from_be_bytes([bytes[cursor], bytes[cursor + 1]]) as usize;
        if length < 2 || cursor + length > bytes.len() {
            return false;
        }
        if [0xc0, 0xc1, 0xc2].contains(&marker) {
            return length >= 8
                && bytes[cursor + 2] == 8
                && u16::from_be_bytes([bytes[cursor + 3], bytes[cursor + 4]]) == 1920
                && u16::from_be_bytes([bytes[cursor + 5], bytes[cursor + 6]]) == 1080;
        }
        cursor += length;
    }
    false
}
async fn sticker_set(api: &impl Api) -> Result<Option<Vec<Sticker>>> {
    let value = api
        .call("getStickerSet", json!({"name":SET}), vec![])
        .await?;
    if value.is_null() {
        return Ok(None);
    }
    if value["name"] != SET || value["title"] != TITLE || value["sticker_type"] != "custom_emoji" {
        return Err(blocked("telegram-set-mismatch"));
    }
    let entries = value["stickers"]
        .as_array()
        .filter(|items| !items.is_empty() && items.len() <= 200)
        .ok_or(blocked("telegram-set-mismatch"))?;
    let mut stickers = Vec::new();
    for item in entries {
        if item["type"] != "custom_emoji"
            || item["set_name"] != SET
            || item["width"] != 100
            || item["height"] != 100
            || item["is_animated"] != false
            || item["is_video"] != false
        {
            return Err(blocked("telegram-set-mismatch"));
        }
        stickers.push(Sticker {
            file_unique_id: item["file_unique_id"].as_str().unwrap_or("").into(),
            custom_emoji_id: item["custom_emoji_id"].as_str().unwrap_or("").into(),
        });
    }
    if !valid_stickers(&stickers) {
        return Err(blocked("telegram-set-mismatch"));
    }
    Ok(Some(stickers))
}
fn matches(progress: &Progress, stickers: &[Sticker]) -> bool {
    progress.base.iter().all(|old| {
        stickers.iter().any(|item| {
            item.file_unique_id == old.file_unique_id && item.custom_emoji_id == old.custom_emoji_id
        })
    }) && stickers.iter().all(|item| {
        progress.base.iter().any(|old| {
            item.file_unique_id == old.file_unique_id && item.custom_emoji_id == old.custom_emoji_id
        }) || progress
            .uploads
            .iter()
            .any(|upload| upload.file_unique_id == item.file_unique_id)
    })
}
fn receipt(value: &Value) -> Result<Receipt> {
    let receipt: Receipt = serde_json::from_value(value.clone())
        .map_err(|_| blocked("telegram-managed-receipt-required"))?;
    if receipt.schema_version != 1
        || receipt.kind != "telegram-emoji-set"
        || receipt.set_name != SET
        || !valid_stickers(&receipt.stickers)
        || receipt.progress.uploads.len() != 5
        || receipt.progress.schema_version != 1
        || !super::hexadecimal(&receipt.package_hash, 64)
        || !super::collection_id(&receipt.collection_id)
        || !valid_stickers(&receipt.progress.base)
        || receipt.stickers.len() != receipt.progress.base.len() + 5
        || !matches!(receipt.progress.action, Some(Action::Permission))
        || receipt
            .progress
            .uploads
            .iter()
            .enumerate()
            .any(|(index, upload)| {
                upload.design as usize != index + 1
                    || !super::hexadecimal(&upload.source_hash, 64)
                    || !id(&upload.file_id)
                    || !id(&upload.file_unique_id)
            })
        || !matches(&receipt.progress, &receipt.stickers)
        || receipt.progress.uploads.iter().any(|upload| {
            !receipt
                .stickers
                .iter()
                .any(|item| item.file_unique_id == upload.file_unique_id)
        })
    {
        return Err(blocked("telegram-managed-receipt-required"));
    }
    Ok(receipt)
}
async fn emoji_step(
    api: &impl Api,
    settings: &Settings,
    bot: u64,
    delivery: &Delivery,
    prepared: &Prepared,
    previous: Option<&Value>,
) -> Result<Outcome> {
    let emoji = assets(prepared, "emoji")?;
    let mut progress = if delivery
        .progress
        .as_object()
        .is_some_and(|value| value.is_empty())
    {
        let existing = sticker_set(api).await?;
        let base = if let Some(previous) = previous {
            let previous = receipt(previous)?;
            if previous.progress.bot_id != bot
                || previous.progress.owner_user_id != settings.owner_user_id
            {
                return Err(blocked("telegram-set-owner-mismatch"));
            }
            let current = existing.ok_or(blocked("telegram-managed-set-missing"))?;
            if current.len() != previous.stickers.len()
                || !previous.stickers.iter().all(|old| {
                    current.iter().any(|item| {
                        item.file_unique_id == old.file_unique_id
                            && item.custom_emoji_id == old.custom_emoji_id
                    })
                })
            {
                return Err(blocked("telegram-set-content-mismatch"));
            }
            current
        } else {
            if existing.is_some() {
                return Err(blocked("telegram-unmanaged-set-exists"));
            }
            Vec::new()
        };
        if base.len() + 5 > 200 {
            return Err(blocked("telegram-set-capacity-review"));
        }
        Progress {
            schema_version: 1,
            bot_id: bot,
            owner_user_id: settings.owner_user_id,
            channel_id: settings.channel_id,
            base,
            uploads: vec![],
            action: None,
        }
    } else {
        serde_json::from_value::<Progress>(delivery.progress.clone())
            .map_err(|_| blocked("telegram-progress-invalid"))?
    };
    if !progress.valid(bot, settings, &emoji) {
        return Err(blocked("telegram-progress-invalid"));
    }
    if delivery
        .progress
        .as_object()
        .is_some_and(|value| value.is_empty())
        || (delivery.reconcile && progress.uploads.len() < 5)
    {
        return progress.outcome();
    }
    if progress.uploads.len() < 5 {
        let asset = emoji[progress.uploads.len()];
        let bytes = api.asset(asset).await?;
        if !transparent_png(&bytes) {
            return Err(blocked("telegram-emoji-media-invalid"));
        }
        // A private upload can be repeated safely; it cannot publish a set or channel post.
        let uploaded = api
            .call(
                "uploadStickerFile",
                json!({"user_id":settings.owner_user_id,"sticker_format":"static"}),
                vec![Upload {
                    field: "sticker".into(),
                    bytes,
                    filename: asset.file.clone(),
                    mime: "image/png",
                }],
            )
            .await
            .map_err(|outcome| match outcome {
                Outcome::Unknown(_) => retry("telegram-private-upload-unconfirmed"),
                other => other,
            })?;
        let file = Uploaded {
            design: asset.design,
            source_hash: asset.sha256.clone(),
            file_id: uploaded["file_id"].as_str().unwrap_or("").into(),
            file_unique_id: uploaded["file_unique_id"].as_str().unwrap_or("").into(),
        };
        if !id(&file.file_id) || !id(&file.file_unique_id) {
            return Err(retry("telegram-private-upload-unconfirmed"));
        }
        progress.uploads.push(file);
        if !progress.valid(bot, settings, &emoji) {
            return Err(blocked("telegram-upload-identity-mismatch"));
        }
        return progress.outcome();
    }
    let current = sticker_set(api).await?;
    if current
        .as_ref()
        .is_some_and(|stickers| !matches(&progress, stickers))
    {
        return Err(blocked("telegram-set-content-mismatch"));
    }
    if current.is_none() && !progress.base.is_empty() {
        return Err(blocked("telegram-managed-set-missing"));
    }
    let present = |design: u8| {
        current.as_ref().is_some_and(|stickers| {
            stickers.iter().any(|item| {
                item.file_unique_id == progress.uploads[design as usize - 1].file_unique_id
            })
        })
    };
    let missing: Vec<u8> = (1..=5).filter(|design| !present(*design)).collect();
    let input = |design: u8| json!({"sticker":progress.uploads[design as usize-1].file_id,"format":"static","emoji_list":[emoji[design as usize-1].emoji]});
    if current.as_ref().map_or(0, Vec::len) + missing.len() > 200 {
        return Err(blocked("telegram-set-capacity-review"));
    }
    match progress.action.clone() {
        Some(Action::Create) if current.is_none() => {
            if delivery.reconcile {
                return progress.outcome();
            }
            let result=api.call("createNewStickerSet",json!({"user_id":settings.owner_user_id,"name":SET,"title":TITLE,"sticker_type":"custom_emoji","stickers":(1..=5).map(input).collect::<Vec<_>>()}),vec![]).await?;
            if result != true {
                return Err(Outcome::Unknown("telegram-set-write-unconfirmed"));
            }
            progress.action = Some(Action::Permission);
        }
        Some(Action::Add { design }) if !present(design) => {
            if delivery.reconcile {
                return progress.outcome();
            }
            let result = api
                .call(
                    "addStickerToSet",
                    json!({"user_id":settings.owner_user_id,"name":SET,"sticker":input(design)}),
                    vec![],
                )
                .await?;
            if result != true {
                return Err(Outcome::Unknown("telegram-set-write-unconfirmed"));
            }
            progress.action = None;
        }
        Some(Action::Permission) if missing.is_empty() => {
            if delivery.reconcile {
                return progress.outcome();
            }
            // getStickerSet has no owner field; an unchanged title write proves this bot can manage it.
            let result = api
                .call(
                    "setStickerSetTitle",
                    json!({"name":SET,"title":TITLE}),
                    vec![],
                )
                .await?;
            if result != true {
                return Err(Outcome::Unknown("telegram-set-write-unconfirmed"));
            }
            let receipt = Receipt {
                schema_version: 1,
                kind: "telegram-emoji-set".into(),
                collection_id: delivery.collection_id.clone(),
                package_hash: delivery.payload["collection"]["packageHash"]
                    .as_str()
                    .unwrap_or("")
                    .into(),
                set_name: SET.into(),
                progress,
                stickers: current.unwrap_or_default(),
            };
            return Ok(Outcome::Delivered(
                serde_json::to_value(receipt).map_err(|_| blocked("telegram-progress-invalid"))?,
            ));
        }
        _ => {
            progress.action = if missing.is_empty() {
                Some(Action::Permission)
            } else if current.is_none() {
                Some(Action::Create)
            } else {
                Some(Action::Add { design: missing[0] })
            };
        }
    }
    progress.outcome()
}
fn caption(
    prepared: &Prepared,
    index: usize,
    collection_url: &str,
    wallpaper_url: &str,
) -> Result<String> {
    let text = if index == 0 {
        format!(
            "{}\n\n{}\n\n{}\n\n{wallpaper_url}\n\nhttps://t.me/addemoji/{SET}",
            prepared.title, prepared.description, collection_url
        )
    } else {
        format!(
            "{}\n\n{wallpaper_url}",
            prepared.manifest.wallpapers[index].title["en"]
        )
    };
    // Plain text captions need no HTML/Markdown escaping; count UTF-16 conservatively.
    if text.encode_utf16().count() > 1024
        || text
            .chars()
            .any(|character| character.is_control() && !['\n', '\t'].contains(&character))
    {
        return Err(blocked("telegram-caption-invalid"));
    }
    Ok(text)
}
fn album_receipt(
    value: Value,
    settings: &Settings,
    collection: &str,
    hashes: &[String],
) -> Result<Outcome> {
    let messages = value
        .as_array()
        .filter(|items| items.len() == 5)
        .ok_or(Outcome::Unknown("telegram-album-response-unconfirmed"))?;
    let mut ids = BTreeSet::new();
    let mut group = None;
    for message in messages {
        let message_id = message["message_id"]
            .as_i64()
            .filter(|value| *value > 0)
            .ok_or(Outcome::Unknown("telegram-album-response-unconfirmed"))?;
        let media_group = message["media_group_id"]
            .as_str()
            .filter(|value| id(value))
            .ok_or(Outcome::Unknown("telegram-album-response-unconfirmed"))?;
        if message.pointer("/chat/id").and_then(Value::as_i64) != Some(settings.channel_id)
            || message.pointer("/chat/type").and_then(Value::as_str) != Some("channel")
            || !ids.insert(message_id)
            || group.is_some_and(|value| value != media_group)
            || message["photo"].as_array().is_none_or(|photos| {
                photos.is_empty()
                    || photos.iter().any(|photo| {
                        !photo["file_id"].as_str().is_some_and(id)
                            || !photo["file_unique_id"].as_str().is_some_and(id)
                    })
            })
        {
            return Err(Outcome::Unknown("telegram-album-response-unconfirmed"));
        }
        group = Some(media_group);
    }
    Ok(Outcome::Delivered(
        json!({"schemaVersion":1,"kind":"telegram-album","collectionId":collection,"chatId":settings.channel_id,"messageIds":messages.iter().map(|item|item["message_id"].clone()).collect::<Vec<_>>(),"mediaGroupId":group,"sourceHashes":hashes}),
    ))
}
async fn album(
    api: &impl Api,
    settings: &Settings,
    bot: u64,
    delivery: &Delivery,
    prepared: &Prepared,
    emoji_receipt: Option<&Value>,
) -> Result<Outcome> {
    if delivery.reconcile {
        return Err(Outcome::Unknown("telegram-album-reconciliation-required"));
    }
    let receipt = receipt(emoji_receipt.ok_or(retry("telegram-emoji-set-not-ready"))?)?;
    let emoji = assets(prepared, "emoji")?;
    if receipt.collection_id != delivery.collection_id
        || receipt.package_hash
            != delivery.payload["collection"]["packageHash"]
                .as_str()
                .unwrap_or("")
        || !receipt.progress.valid(bot, settings, &emoji)
    {
        return Err(blocked("telegram-managed-receipt-required"));
    }
    let current = sticker_set(api)
        .await?
        .ok_or(blocked("telegram-managed-set-missing"))?;
    // Later collections may append items; every confirmed item must still exist unchanged.
    if !receipt.stickers.iter().all(|old| {
        current.iter().any(|item| {
            item.file_unique_id == old.file_unique_id && item.custom_emoji_id == old.custom_emoji_id
        })
    }) {
        return Err(blocked("telegram-set-content-mismatch"));
    }
    let media = assets(prepared, "social")?;
    let collection_url = api.page(prepared, true).await?;
    let mut files = Vec::new();
    let mut inputs = Vec::new();
    let mut hashes = Vec::new();
    for (index, asset) in media.into_iter().enumerate() {
        let mut page = prepared.clone();
        page.index = index + 1;
        let wallpaper_url = api.page(&page, false).await?;
        let caption = caption(prepared, index, &collection_url, &wallpaper_url)?;
        let bytes = api.asset(asset).await?;
        if !jpeg(&bytes) || bytes.len() > 5 * 1024 * 1024 {
            return Err(blocked("telegram-photo-media-invalid"));
        }
        let field = format!("photo{index}");
        inputs.push(json!({"type":"photo","media":format!("attach://{field}"),"caption":caption}));
        files.push(Upload {
            field,
            bytes,
            filename: asset.file.clone(),
            mime: "image/jpeg",
        });
        hashes.push(asset.sha256.clone());
    }
    let response = api
        .call(
            "sendMediaGroup",
            json!({"chat_id":settings.channel_id,"media":inputs}),
            files,
        )
        .await?;
    album_receipt(response, settings, &delivery.collection_id, &hashes)
}
pub(super) async fn send(
    delivery: &Delivery,
    credentials: &Credentials,
    store: &Store,
    prepared: &Prepared,
) -> Outcome {
    let result = async {
        let settings = Settings::parse(
            credentials
                .get("telegram")
                .ok_or(blocked("destination-not-configured"))?,
        )?;
        let api = Http {
            client: transport::client().map_err(|error| blocked(error.0))?,
            settings: &settings,
        };
        let bot = identities(&api, &settings).await?;
        let previous = store
            .telegram_receipt(if delivery.item == "album" {
                Some(&delivery.collection_id)
            } else {
                None
            })
            .await
            .map_err(|error| retry(error.0))?;
        match delivery.item.as_str() {
            "emoji-set" => {
                emoji_step(&api, &settings, bot, delivery, prepared, previous.as_ref()).await
            }
            "album" => album(&api, &settings, bot, delivery, prepared, previous.as_ref()).await,
            _ => Err(blocked("invalid-delivery-item")),
        }
    }
    .await;
    result.unwrap_or_else(|outcome| outcome)
}

#[cfg(test)]
mod tests;
