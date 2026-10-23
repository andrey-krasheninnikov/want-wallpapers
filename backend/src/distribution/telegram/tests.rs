use super::*;
use std::cell::{Cell, RefCell};
use uuid::Uuid;

struct Fake {
    stickers: RefCell<Option<Vec<Sticker>>>,
    calls: RefCell<Vec<&'static str>>,
    lose: Cell<Option<&'static str>>,
    next_upload: Cell<usize>,
    permission: Cell<bool>,
    malformed: Cell<bool>,
    wrong_bot: Cell<bool>,
    wrong_chat: Cell<bool>,
    bad_album: Cell<bool>,
}
impl Fake {
    fn new() -> Self {
        Self {
            stickers: RefCell::new(None),
            calls: RefCell::new(vec![]),
            lose: Cell::new(None),
            next_upload: Cell::new(0),
            permission: Cell::new(true),
            malformed: Cell::new(false),
            wrong_bot: Cell::new(false),
            wrong_chat: Cell::new(false),
            bad_album: Cell::new(false),
        }
    }
    fn count(&self, method: &str) -> usize {
        self.calls
            .borrow()
            .iter()
            .filter(|value| **value == method)
            .count()
    }
    fn sticker(file: &str) -> Sticker {
        Sticker {
            file_unique_id: format!("unique-{}", file.trim_start_matches("file-")),
            custom_emoji_id: format!("emoji-{}", file.trim_start_matches("file-")),
        }
    }
    fn set(&self) -> Value {
        self.stickers.borrow().as_ref().map_or(Value::Null,|items|json!({"name":SET,"title":TITLE,"sticker_type":"custom_emoji","stickers":items.iter().map(|item|json!({"type":"custom_emoji","set_name":SET,"width":100,"height":100,"is_animated":false,"is_video":false,"file_unique_id":item.file_unique_id,"custom_emoji_id":item.custom_emoji_id})).collect::<Vec<_>>()}))
    }
}
impl Api for Fake {
    async fn call(
        &self,
        method: &'static str,
        parameters: Value,
        files: Vec<Upload>,
    ) -> Result<Value> {
        self.calls.borrow_mut().push(method);
        let response = match method {
            "getMe" => {
                json!({"id":7,"is_bot":true,"username":if self.wrong_bot.get(){"other"}else{BOT}})
            }
            "getChat" => {
                json!({"id":-100,"type":"channel","username":if self.wrong_chat.get(){"other"}else{CHANNEL}})
            }
            "getChatMember" => {
                json!({"user":{"id":7},"status":"administrator","can_post_messages":self.permission.get()})
            }
            "getStickerSet" => self.set(),
            "uploadStickerFile" => {
                assert_eq!(files.len(), 1);
                assert_eq!(files[0].mime, "image/png");
                assert!(transparent_png(&files[0].bytes));
                let index = self.next_upload.get();
                self.next_upload.set(index + 1);
                json!({"file_id":format!("file-{index}"),"file_unique_id":format!("unique-{index}"),"file_size":files[0].bytes.len()})
            }
            "createNewStickerSet" => {
                assert_eq!(parameters["name"], SET);
                assert_eq!(parameters["sticker_type"], "custom_emoji");
                assert!(self.stickers.borrow().is_none());
                let items = parameters["stickers"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|input| Self::sticker(input["sticker"].as_str().unwrap()))
                    .collect();
                *self.stickers.borrow_mut() = Some(items);
                json!(true)
            }
            "addStickerToSet" => {
                let sticker = Self::sticker(parameters["sticker"]["sticker"].as_str().unwrap());
                let mut set = self.stickers.borrow_mut();
                let items = set.as_mut().unwrap();
                if !items
                    .iter()
                    .any(|item| item.file_unique_id == sticker.file_unique_id)
                {
                    items.push(sticker);
                }
                json!(true)
            }
            "setStickerSetTitle" => {
                assert_eq!(parameters["title"], TITLE);
                json!(true)
            }
            "sendMediaGroup" => {
                assert_eq!(files.len(), 5);
                assert!(parameters.get("allow_paid_broadcast").is_none());
                assert!(
                    parameters["media"]
                        .as_array()
                        .unwrap()
                        .iter()
                        .all(|item| item.get("parse_mode").is_none())
                );
                if self.bad_album.get() {
                    json!([])
                } else {
                    album_messages()
                }
            }
            _ => panic!("unexpected method"),
        };
        if self.lose.get() == Some(method) {
            self.lose.set(None);
            return Err(Outcome::Unknown("telegram-write-unconfirmed"));
        }
        Ok(response)
    }
    async fn asset(&self, asset: &Asset) -> Result<Vec<u8>> {
        if self.malformed.get() {
            return Ok(vec![0; 40]);
        }
        Ok(if asset.role == "emoji" {
            png(100, Some(128))
        } else {
            photo()
        })
    }
    async fn page(&self, prepared: &Prepared, collection: bool) -> Result<String> {
        Ok(if collection {
            format!(
                "https://wallpapers.want.foundation/collections/{}/",
                prepared.manifest.collection.slug
            )
        } else {
            format!(
                "https://wallpapers.want.foundation/wallpapers/{}/",
                prepared.manifest.wallpapers[prepared.index - 1].slug
            )
        })
    }
}
fn settings() -> Settings {
    Settings {
        enabled: true,
        token: format!("7:{}", "x".repeat(32)),
        owner_user_id: 9,
        channel_id: -100,
    }
}
fn prepared() -> Prepared {
    let snapshot: Value = serde_json::from_str(include_str!(
        "../../../../frontend/src/data/catalog-live.json"
    ))
    .unwrap();
    let collection = snapshot["collections"][0].clone();
    let wallpapers = snapshot["wallpapers"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|item| item["collectionId"] == collection["id"])
        .take(5)
        .cloned()
        .collect::<Vec<_>>();
    let manifest =
        serde_json::from_value(json!({"collection":collection,"wallpapers":wallpapers})).unwrap();
    let mut assets = Vec::new();
    for role in ["emoji", "social"] {
        for design in 1..=5 {
            assets.push(Asset {
                role: role.into(),
                design,
                variant: None,
                sha256: format!("{design:064x}"),
                width: if role == "emoji" { 100 } else { 1080 },
                height: if role == "emoji" { 100 } else { 1920 },
                name: Some(format!("Motif {design}")),
                emoji: Some("🌿".into()),
                file: format!("{role}-{design}.png"),
                url: "https://want-foundation.s3.twcstorage.ru/test.png".into(),
            });
        }
    }
    Prepared {
        manifest,
        title: "Collection <&> *title*".into(),
        description: "English description.".into(),
        assets,
        index: 1,
    }
}
fn delivery(prepared: &Prepared) -> Delivery {
    Delivery {
        collection_id: prepared.manifest.collection.id.clone(),
        destination: "telegram".into(),
        item: "emoji-set".into(),
        claim: Uuid::new_v4(),
        generation: 1,
        payload: json!({"collection":{"packageHash":"a".repeat(64)}}),
        progress: json!({}),
        reconcile: false,
    }
}
fn png(side: u32, alpha: Option<u8>) -> Vec<u8> {
    let mut bytes = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut bytes, side, side);
        encoder.set_color(if alpha.is_some() {
            png::ColorType::Rgba
        } else {
            png::ColorType::Rgb
        });
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().unwrap();
        let mut pixels =
            vec![100; side as usize * side as usize * if alpha.is_some() { 4 } else { 3 }];
        if let Some(alpha) = alpha {
            for pixel in pixels.chunks_exact_mut(4) {
                pixel[3] = alpha;
            }
        }
        writer.write_image_data(&pixels).unwrap();
    }
    bytes
}
fn photo() -> Vec<u8> {
    vec![
        0xff, 0xd8, 0xff, 0xc0, 0, 8, 8, 7, 128, 4, 56, 3, 0xff, 0xd9,
    ]
}
fn album_messages() -> Value {
    (0..5).map(|index|json!({"message_id":index+1,"chat":{"id":-100,"type":"channel"},"media_group_id":"12345","photo":[{"file_id":format!("photo-{index}"),"file_unique_id":format!("photo-unique-{index}")}]})).collect()
}
async fn complete(
    fake: &Fake,
    delivery: &mut Delivery,
    prepared: &Prepared,
    previous: Option<&Value>,
) -> Value {
    for _ in 0..30 {
        match emoji_step(fake, &settings(), 7, delivery, prepared, previous).await {
            Ok(Outcome::Progress(progress)) => {
                delivery.progress = progress;
                delivery.reconcile = false;
            }
            Ok(Outcome::Delivered(receipt)) => return receipt,
            _ => panic!("unexpected outcome"),
        }
    }
    panic!("did not finish")
}
#[tokio::test]
async fn initial_creation_lost_response_reconciles_without_second_create() {
    let fake = Fake::new();
    let prepared = prepared();
    let mut delivery = delivery(&prepared);
    fake.lose.set(Some("createNewStickerSet"));
    loop {
        match emoji_step(&fake, &settings(), 7, &delivery, &prepared, None).await {
            Ok(Outcome::Progress(progress)) => delivery.progress = progress,
            Err(Outcome::Unknown(_)) => break,
            _ => panic!("unexpected outcome"),
        }
    }
    assert_eq!(fake.count("createNewStickerSet"), 1);
    let writes = fake.calls.borrow().len();
    delivery.reconcile = true;
    let Ok(Outcome::Progress(progress)) =
        emoji_step(&fake, &settings(), 7, &delivery, &prepared, None).await
    else {
        panic!("reconcile failed")
    };
    assert_eq!(fake.calls.borrow().len(), writes + 1);
    assert_eq!(fake.calls.borrow().last(), Some(&"getStickerSet"));
    delivery.progress = progress;
    delivery.reconcile = false;
    let receipt = complete(&fake, &mut delivery, &prepared, None).await;
    assert_eq!(fake.count("createNewStickerSet"), 1);
    assert_eq!(fake.count("addStickerToSet"), 0);
    assert_eq!(fake.count("setStickerSetTitle"), 1);
    assert_eq!(receipt["stickers"].as_array().unwrap().len(), 5);
    assert_eq!(receipt["progress"]["uploads"].as_array().unwrap().len(), 5);
    assert!(receipt.to_string().contains("sourceHash"));
    assert!(!receipt.to_string().contains(&settings().token));
}
#[tokio::test]
async fn append_keeps_old_items_and_reconciles_partial_additions() {
    let fake = Fake::new();
    let prepared = prepared();
    let mut first = delivery(&prepared);
    let previous = complete(&fake, &mut first, &prepared, None).await;
    let old = fake
        .stickers
        .borrow()
        .as_ref()
        .unwrap()
        .iter()
        .map(|item| item.custom_emoji_id.clone())
        .collect::<Vec<_>>();
    let mut second = delivery(&prepared);
    second.collection_id = "0008-next".into();
    fake.lose.set(Some("addStickerToSet"));
    loop {
        match emoji_step(&fake, &settings(), 7, &second, &prepared, Some(&previous)).await {
            Ok(Outcome::Progress(progress)) => second.progress = progress,
            Err(Outcome::Unknown(_)) => break,
            _ => panic!("unexpected outcome"),
        }
    }
    assert_eq!(fake.count("addStickerToSet"), 1);
    second.reconcile = true;
    let Ok(Outcome::Progress(progress)) =
        emoji_step(&fake, &settings(), 7, &second, &prepared, Some(&previous)).await
    else {
        panic!("reconcile failed")
    };
    assert_eq!(fake.count("addStickerToSet"), 1);
    second.progress = progress;
    second.reconcile = false;
    let receipt = complete(&fake, &mut second, &prepared, Some(&previous)).await;
    assert_eq!(fake.count("addStickerToSet"), 5);
    assert_eq!(fake.count("createNewStickerSet"), 1);
    let current = fake.stickers.borrow();
    assert_eq!(current.as_ref().unwrap().len(), 10);
    assert_eq!(
        current.as_ref().unwrap()[..5]
            .iter()
            .map(|item| item.custom_emoji_id.clone())
            .collect::<Vec<_>>(),
        old
    );
    assert_eq!(
        receipt["progress"]["uploads"][0]["fileUniqueId"],
        "unique-5"
    );
}
#[tokio::test]
async fn capacity_unmanaged_content_and_owner_mismatch_block_changes() {
    let fake = Fake::new();
    let prepared = prepared();
    let mut delivery = delivery(&prepared);
    let mut previous = complete(&fake, &mut delivery, &prepared, None).await;
    let mut stickers: Vec<Sticker> = serde_json::from_value(previous["stickers"].clone()).unwrap();
    stickers.extend((5..200).map(|index| Fake::sticker(&format!("file-{index}"))));
    previous["stickers"] = serde_json::to_value(&stickers).unwrap();
    previous["progress"]["base"] = serde_json::to_value(&stickers[5..]).unwrap();
    *fake.stickers.borrow_mut() = Some(stickers);
    delivery.progress = json!({});
    assert!(matches!(
        emoji_step(&fake, &settings(), 7, &delivery, &prepared, Some(&previous)).await,
        Err(Outcome::Blocked("telegram-set-capacity-review"))
    ));
    assert!(matches!(
        emoji_step(&fake, &settings(), 7, &delivery, &prepared, None).await,
        Err(Outcome::Blocked("telegram-unmanaged-set-exists"))
    ));
    previous["progress"]["ownerUserId"] = json!(88);
    assert!(matches!(
        emoji_step(&fake, &settings(), 7, &delivery, &prepared, Some(&previous)).await,
        Err(Outcome::Blocked("telegram-set-owner-mismatch"))
    ));
    assert_eq!(fake.count("addStickerToSet"), 0);
}
#[tokio::test]
async fn malformed_media_and_permission_identity_fail_before_public_write() {
    let fake = Fake::new();
    let prepared = prepared();
    let mut delivery = delivery(&prepared);
    fake.permission.set(false);
    assert!(matches!(
        identities(&fake, &settings()).await,
        Err(Outcome::Blocked("telegram-posting-permission-required"))
    ));
    fake.permission.set(true);
    fake.wrong_bot.set(true);
    assert!(matches!(
        identities(&fake, &settings()).await,
        Err(Outcome::Blocked("telegram-bot-mismatch"))
    ));
    fake.wrong_bot.set(false);
    fake.wrong_chat.set(true);
    assert!(matches!(
        identities(&fake, &settings()).await,
        Err(Outcome::Blocked("telegram-channel-mismatch"))
    ));
    fake.wrong_chat.set(false);
    assert_eq!(identities(&fake, &settings()).await.ok(), Some(7));
    let Ok(Outcome::Progress(progress)) =
        emoji_step(&fake, &settings(), 7, &delivery, &prepared, None).await
    else {
        panic!("initialization failed")
    };
    delivery.progress = progress;
    fake.malformed.set(true);
    assert!(matches!(
        emoji_step(&fake, &settings(), 7, &delivery, &prepared, None).await,
        Err(Outcome::Blocked("telegram-emoji-media-invalid"))
    ));
    assert_eq!(fake.count("uploadStickerFile"), 0);
    assert_eq!(fake.count("createNewStickerSet"), 0);
    assert!(!transparent_png(&png(99, Some(128))));
    assert!(!transparent_png(&png(100, None)));
    assert!(!transparent_png(&png(100, Some(255))));
    assert!(!transparent_png(&png(100, Some(0))));
    assert!(transparent_png(&png(100, Some(128))));
    assert!(!transport::social_jpeg(b"invalid"));
    assert!(transport::social_jpeg(&photo()));
}
#[tokio::test]
async fn album_requires_verified_emoji_plain_captions_and_response_identity() {
    let fake = Fake::new();
    let prepared = prepared();
    let mut delivery = delivery(&prepared);
    let receipt = complete(&fake, &mut delivery, &prepared, None).await;
    delivery.item = "album".into();
    delivery.progress = json!({});
    assert!(matches!(
        album(&fake, &settings(), 7, &delivery, &prepared, None).await,
        Err(Outcome::Retry { .. })
    ));
    assert_eq!(fake.count("sendMediaGroup"), 0);
    assert!(matches!(
        album(&fake, &settings(), 7, &delivery, &prepared, Some(&receipt)).await,
        Ok(Outcome::Delivered(_))
    ));
    assert_eq!(fake.count("sendMediaGroup"), 1);
    fake.lose.set(Some("sendMediaGroup"));
    assert!(matches!(
        album(&fake, &settings(), 7, &delivery, &prepared, Some(&receipt)).await,
        Err(Outcome::Unknown(_))
    ));
    delivery.reconcile = true;
    assert!(matches!(
        album(&fake, &settings(), 7, &delivery, &prepared, Some(&receipt)).await,
        Err(Outcome::Unknown(_))
    ));
    assert_eq!(fake.count("sendMediaGroup"), 2);
    let caption = caption(
        &prepared,
        0,
        "https://wallpapers.want.foundation/collections/test/",
        "unused",
    )
    .ok()
    .unwrap();
    assert!(caption.contains("<&> *title*"));
    assert!(caption.contains(&format!("https://t.me/addemoji/{SET}")));
    let mut long = prepared.clone();
    long.description = "x".repeat(1024);
    assert!(caption_length_invalid(&long));
    for field in ["message_id", "chat", "media_group_id", "photo"] {
        let mut bad = album_messages();
        bad[0][field] = Value::Null;
        assert!(matches!(
            album_receipt(bad, &settings(), "test", &[]),
            Err(Outcome::Unknown(_))
        ));
    }
    let mut bad = album_messages();
    bad[1]["message_id"] = bad[0]["message_id"].clone();
    assert!(matches!(
        album_receipt(bad, &settings(), "test", &[]),
        Err(Outcome::Unknown(_))
    ));
}
fn caption_length_invalid(prepared: &Prepared) -> bool {
    caption(
        prepared,
        0,
        "https://wallpapers.want.foundation/collections/test/",
        "unused",
    )
    .is_err()
}
#[tokio::test]
async fn unknown_private_upload_can_repeat_and_changed_set_never_appends() {
    let fake = Fake::new();
    let prepared = prepared();
    let mut delivery = delivery(&prepared);
    let Ok(Outcome::Progress(progress)) =
        emoji_step(&fake, &settings(), 7, &delivery, &prepared, None).await
    else {
        panic!("initialization failed")
    };
    delivery.progress = progress;
    fake.lose.set(Some("uploadStickerFile"));
    assert!(matches!(
        emoji_step(&fake, &settings(), 7, &delivery, &prepared, None).await,
        Err(Outcome::Retry { .. })
    ));
    let receipt = complete(&fake, &mut delivery, &prepared, None).await;
    assert_eq!(fake.count("uploadStickerFile"), 6);
    assert_eq!(fake.count("createNewStickerSet"), 1);
    fake.stickers.borrow_mut().as_mut().unwrap()[0].custom_emoji_id = "unexpected".into();
    delivery.progress = json!({});
    assert!(matches!(
        emoji_step(&fake, &settings(), 7, &delivery, &prepared, Some(&receipt)).await,
        Err(Outcome::Blocked("telegram-set-content-mismatch"))
    ));
}
#[test]
fn api_errors_are_sanitized_and_read_failures_and_429_remain_retryable() {
    let reply = |status, body| transport::Reply {
        status: reqwest::StatusCode::from_u16(status).unwrap(),
        body,
        retry_after: None,
    };
    assert!(matches!(
        response(
            "sendMediaGroup",
            reply(429, json!({"ok":false,"parameters":{"retry_after":123}}))
        ),
        Err(Outcome::Retry { seconds: 123, .. })
    ));
    assert!(matches!(
        response("sendMediaGroup", reply(503, json!({}))),
        Err(Outcome::Unknown(_))
    ));
    assert!(matches!(
        response("getMe", reply(503, json!({}))),
        Err(Outcome::Retry { .. })
    ));
    assert!(matches!(
        response(
            "sendMediaGroup",
            reply(403, json!({"description":"private text"}))
        ),
        Err(Outcome::Blocked("provider-reauthorization-required"))
    ));
    assert!(matches!(
        response("createNewStickerSet", reply(200, json!({"ok":false}))),
        Err(Outcome::Unknown(_))
    ));
    assert!(
        response(
            "getStickerSet",
            reply(
                400,
                json!({"ok":false,"error_code":400,"description":"Bad Request: STICKERSET_INVALID"})
            )
        )
        .ok()
        .unwrap()
        .is_null()
    );
    assert!(matches!(
        response(
            "getStickerSet",
            reply(
                400,
                json!({"ok":false,"error_code":400,"description":"other failure"})
            )
        ),
        Err(Outcome::Blocked(_))
    ));
    assert!(
        Settings::parse(
            &json!({"enabled":true,"token":"7:invalid/token","ownerUserId":9,"channelId":-100})
        )
        .is_err()
    );
}
#[test]
fn publication_binds_five_ordered_designs_to_the_media() {
    let mut prepared = prepared();
    prepared.manifest.collection.count = 5;
    let mut delivery = delivery(&prepared);
    for asset in &mut prepared.assets {
        asset.url = format!(
            "https://want-foundation.s3.twcstorage.ru/wallpapers/assets/collections/{}/{}",
            delivery.collection_id, asset.file
        );
    }
    delivery.payload = json!({"index":1,"collection":{"manifest":prepared.manifest,"copy":{"telegram":[{"title":"Collection","description":"Description"}]},"assets":prepared.assets.iter().map(|asset|json!({"role":asset.role,"design":asset.design,"sha256":asset.sha256,"width":asset.width,"height":asset.height,"file":asset.file,"url":asset.url,"name":asset.name,"emoji":asset.emoji})).collect::<Vec<_>>()}});
    assert!(transport::prepare(&delivery).is_ok());
    delivery.payload["collection"]["manifest"]["wallpapers"]
        .as_array_mut()
        .unwrap()
        .swap(0, 1);
    assert!(transport::prepare(&delivery).is_err());
}
