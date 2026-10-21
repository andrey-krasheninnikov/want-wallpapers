use super::*;
use std::{
    cell::{Cell, RefCell},
    fs,
    os::unix::fs::PermissionsExt,
    path::PathBuf,
};
use uuid::Uuid;

struct Fake {
    creates: Cell<usize>,
    refreshes: Cell<usize>,
    lose_create: Cell<bool>,
    lose_refresh: Cell<bool>,
    rate_refresh: Cell<bool>,
    read_fails: Cell<bool>,
    wrong_account: Cell<bool>,
    secret_board: Cell<bool>,
    post: RefCell<Value>,
    image: Cell<u8>,
}
impl Fake {
    fn new() -> Self {
        Self {
            creates: Cell::new(0),
            refreshes: Cell::new(0),
            lose_create: Cell::new(false),
            lose_refresh: Cell::new(false),
            rate_refresh: Cell::new(false),
            read_fails: Cell::new(false),
            wrong_account: Cell::new(false),
            secret_board: Cell::new(false),
            post: RefCell::new(Value::Null),
            image: Cell::new(0),
        }
    }
}
impl Api for Fake {
    async fn read(&self, path: &str, _token: &str) -> Result<Value> {
        match path {
            "/user_account" => {
                Ok(json!({"username":if self.wrong_account.get(){"other"}else{"wallpapers"}}))
            }
            "/boards/123" => Ok(
                json!({"id":"123","privacy":if self.secret_board.get(){"SECRET"}else{"PUBLIC"},"is_ads_only":false,"owner":{"username":"wallpapers"}}),
            ),
            "/pins/456" => {
                if self.read_fails.get() {
                    Err(retry("pinterest-read-unavailable"))
                } else {
                    Ok(self.post.borrow().clone())
                }
            }
            _ => panic!("unexpected read"),
        }
    }
    async fn create(&self, _token: &str, payload: &Value) -> Result<Value> {
        self.creates.set(self.creates.get() + 1);
        *self.post.borrow_mut() = json!({"id":"456","board_id":"123","board_owner":{"username":"wallpapers"},"is_owner":true,"media":{"media_type":"image"},"link":payload["link"],"title":payload["title"],"description":payload["description"],"ai_disclosures":payload.get("ai_disclosures").cloned()});
        if self.lose_create.get() {
            return Err(Outcome::Unknown("provider-write-outcome-unknown"));
        }
        Ok(json!({"id":"456"}))
    }
    async fn refresh(&self, _settings: &Settings) -> Result<Value> {
        self.refreshes.set(self.refreshes.get() + 1);
        if self.rate_refresh.get() {
            return Err(Outcome::Retry {
                seconds: 120,
                code: "provider-rate-limit",
            });
        }
        if self.lose_refresh.get() {
            return Err(Outcome::Unknown("provider-write-outcome-unknown"));
        }
        Ok(token_response())
    }
    async fn asset(&self, asset: &Asset) -> Result<Vec<u8>> {
        self.image.set(asset.design);
        Ok(photo())
    }
    async fn page(&self, prepared: &Prepared) -> Result<String> {
        Ok(format!(
            "https://wallpapers.want.foundation/wallpapers/{}/",
            prepared.manifest.wallpapers[prepared.index - 1].slug
        ))
    }
}
fn configuration() -> Value {
    json!({"enabled":true,"accessTier":"standard","username":"wallpapers","boardId":"123","clientId":"789","clientSecret":"private-client-secret","accessToken":"pina-private-access","refreshToken":"pinr-private-refresh","accessTokenExpiresAt":1000,"scope":SCOPES.join(" ")})
}
fn token_response() -> Value {
    json!({"access_token":"pina-rotated-access","refresh_token":"pinr-rotated-refresh","expires_in":3600,"token_type":"bearer","scope":SCOPES.join(" ")})
}
fn photo() -> Vec<u8> {
    vec![
        0xff, 0xd8, 0xff, 0xc0, 0, 8, 8, 7, 128, 4, 56, 3, 0xff, 0xd9,
    ]
}
fn prepared(index: usize) -> Prepared {
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
    Prepared {
        manifest: serde_json::from_value(json!({"collection":collection,"wallpapers":wallpapers}))
            .unwrap(),
        title: format!("English design {index}"),
        description: "English approved copy.".into(),
        index,
        assets: (1..=5)
            .map(|design| Asset {
                role: "social".into(),
                design,
                variant: None,
                sha256: format!("{design:064x}"),
                width: 1080,
                height: 1920,
                name: None,
                emoji: None,
                file: format!("social-{design}.jpg"),
                url: "https://want-foundation.s3.twcstorage.ru/test.jpg".into(),
            })
            .collect(),
    }
}
fn delivery(prepared: &Prepared) -> Delivery {
    Delivery {
        collection_id: prepared.manifest.collection.id.clone(),
        destination: "pinterest".into(),
        item: format!("post-{}", prepared.index),
        claim: Uuid::new_v4(),
        generation: 1,
        payload: json!({}),
        progress: json!({}),
        reconcile: false,
    }
}
struct Private {
    root: PathBuf,
    credentials: Credentials,
}
impl Private {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!("wallpapers-pinterest-{}", Uuid::new_v4()));
        fs::create_dir(&path).unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o700)).unwrap();
        let root = fs::canonicalize(path).unwrap();
        let file = root.join("pinterest.json");
        fs::write(&file, configuration().to_string()).unwrap();
        fs::set_permissions(&file, fs::Permissions::from_mode(0o600)).unwrap();
        Self {
            credentials: Credentials::load(&root),
            root,
        }
    }
}
impl Drop for Private {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.root).unwrap();
    }
}
#[tokio::test]
async fn each_preview_maps_to_its_english_copy_and_live_wallpaper_then_readback() {
    let fake = Fake::new();
    let settings = Settings::parse(&configuration()).ok().unwrap();
    for index in 1..=5 {
        let prepared = prepared(index);
        let mut delivery = delivery(&prepared);
        let Ok(Outcome::Progress(progress)) = deliver(&fake, &delivery, &prepared, &settings).await
        else {
            panic!("create failed")
        };
        delivery.progress = progress;
        assert_eq!(fake.image.get() as usize, index);
        {
            let post = fake.post.borrow();
            assert_eq!(post["title"], prepared.title);
            assert_eq!(
                post["link"],
                format!(
                    "https://wallpapers.want.foundation/wallpapers/{}/",
                    prepared.manifest.wallpapers[index - 1].slug
                )
            );
        }
        let Ok(Outcome::Delivered(receipt)) = deliver(&fake, &delivery, &prepared, &settings).await
        else {
            panic!("readback failed")
        };
        assert_eq!(receipt["pinId"], "456");
        assert_eq!(receipt["sourceHash"], format!("{index:064x}"));
    }
    assert_eq!(fake.creates.get(), 5);
}
#[tokio::test]
async fn saved_pin_id_survives_retry_and_mismatched_readback_without_recreation() {
    let fake = Fake::new();
    let settings = Settings::parse(&configuration()).ok().unwrap();
    let prepared = prepared(1);
    let mut delivery = delivery(&prepared);
    let Ok(Outcome::Progress(progress)) = deliver(&fake, &delivery, &prepared, &settings).await
    else {
        panic!("create failed")
    };
    delivery.progress = progress;
    fake.read_fails.set(true);
    assert!(matches!(
        deliver(&fake, &delivery, &prepared, &settings).await,
        Err(Outcome::Retry { .. })
    ));
    fake.read_fails.set(false);
    fake.post.borrow_mut()["link"] = json!("https://other.test/");
    assert!(matches!(
        deliver(&fake, &delivery, &prepared, &settings).await,
        Err(Outcome::Blocked("pinterest-pin-readback-mismatch"))
    ));
    assert_eq!(fake.creates.get(), 1);
    assert_eq!(delivery.progress["pinId"], "456");
}
#[tokio::test]
async fn ambiguous_creation_is_unknown_and_private_refresh_is_durable() {
    let fake = Fake::new();
    let prepared = prepared(1);
    let delivery = delivery(&prepared);
    let settings = Settings::parse(&configuration()).ok().unwrap();
    fake.lose_create.set(true);
    assert!(matches!(
        deliver(&fake, &delivery, &prepared, &settings).await,
        Err(Outcome::Unknown(_))
    ));
    assert_eq!(fake.creates.get(), 1);
    let mut private = Private::new();
    let mut settings = Settings::parse(private.credentials.get("pinterest").unwrap())
        .ok()
        .unwrap();
    authorize(&fake, &mut private.credentials, &mut settings, 1001)
        .await
        .ok()
        .unwrap();
    assert_eq!(settings.access_token, "pina-rotated-access");
    assert_eq!(settings.refresh_token, "pinr-rotated-refresh");
    assert!(!settings.refresh_pending);
    assert_eq!(
        private.credentials.get("pinterest").unwrap()["accessTokenExpiresAt"],
        4601
    );
    assert_eq!(
        fs::metadata(private.root.join("pinterest.json"))
            .unwrap()
            .permissions()
            .mode()
            & 0o777,
        0o600
    );
}
#[tokio::test]
async fn lost_refresh_requires_reauthorization_and_cannot_repeat_after_restart() {
    let fake = Fake::new();
    fake.lose_refresh.set(true);
    let mut private = Private::new();
    let mut settings = Settings::parse(private.credentials.get("pinterest").unwrap())
        .ok()
        .unwrap();
    assert!(matches!(
        authorize(&fake, &mut private.credentials, &mut settings, 1001).await,
        Err(Outcome::Blocked("pinterest-reauthorization-required"))
    ));
    let restarted = Credentials::load(&private.root);
    assert!(matches!(
        Settings::parse(restarted.get("pinterest").unwrap()),
        Err(Outcome::Blocked("pinterest-reauthorization-required"))
    ));
    assert_eq!(fake.refreshes.get(), 1);
    assert!(
        private.credentials.get("pinterest").unwrap()["refreshPending"]
            .as_bool()
            .unwrap()
    );
    assert_eq!(fake.creates.get(), 0);
}
#[tokio::test]
async fn authorization_and_public_board_are_required_before_posting() {
    let fake = Fake::new();
    let settings = Settings::parse(&configuration()).ok().unwrap();
    assert!(identities(&fake, &settings).await.is_ok());
    fake.wrong_account.set(true);
    assert!(matches!(
        identities(&fake, &settings).await,
        Err(Outcome::Blocked("pinterest-account-mismatch"))
    ));
    fake.wrong_account.set(false);
    fake.secret_board.set(true);
    assert!(matches!(
        identities(&fake, &settings).await,
        Err(Outcome::Blocked("pinterest-public-board-required"))
    ));
    let mut trial = configuration();
    trial["accessTier"] = json!("trial");
    assert!(matches!(
        Settings::parse(&trial),
        Err(Outcome::Blocked("pinterest-standard-access-required"))
    ));
    let mut missing = configuration();
    missing["scope"] = json!("pins:read");
    assert!(Settings::parse(&missing).is_err());
    assert_eq!(fake.creates.get(), 0);
}
#[test]
fn content_limits_payload_and_disclosure_fields_follow_the_native_contract() {
    let prepared = prepared(1);
    let mut settings = Settings::parse(&configuration()).ok().unwrap();
    let link = "https://wallpapers.want.foundation/wallpapers/test/";
    let value = payload(&prepared, &settings, &photo(), link).ok().unwrap();
    assert_eq!(value["media_source"]["source_type"], "image_base64");
    assert_eq!(
        STANDARD
            .decode(value["media_source"]["data"].as_str().unwrap())
            .unwrap(),
        photo()
    );
    assert!(value.get("ai_disclosures").is_none());
    settings.ai_disclosures = Some(vec![Disclosure::Modified]);
    let disclosed = payload(&prepared, &settings, &photo(), link).ok().unwrap();
    assert_eq!(
        disclosed["ai_disclosures"],
        json!({"values":["AI_MODIFIED"]})
    );
    let mut long = prepared.clone();
    long.title = "x".repeat(101);
    assert!(payload(&long, &settings, &photo(), link).is_err());
    long.title = "Title".into();
    long.description = "x".repeat(801);
    assert!(payload(&long, &settings, &photo(), link).is_err());
    assert!(payload(&prepared, &settings, b"bad", link).is_err());
    let mut settings = Settings::parse(&configuration()).ok().unwrap();
    let mut invalid = token_response();
    invalid["scope"] = json!("pins:read");
    assert!(refreshed(&mut settings, &invalid, 1001).is_err());
    assert!(matches!(
        read_failure(Outcome::Unknown("private-detail")),
        Outcome::Retry { .. }
    ));
    let rate = transport::Reply {
        status: reqwest::StatusCode::TOO_MANY_REQUESTS,
        body: json!({}),
        retry_after: Some(120),
    };
    assert!(matches!(
        rate.rejection(),
        Some(Outcome::Retry { seconds: 120, .. })
    ));
}

#[tokio::test]
async fn confirmed_refresh_rate_limit_clears_intent_before_later_retry() {
    let fake = Fake::new();
    fake.rate_refresh.set(true);
    let mut private = Private::new();
    let mut settings = Settings::parse(private.credentials.get("pinterest").unwrap())
        .ok()
        .unwrap();
    assert!(matches!(
        authorize(&fake, &mut private.credentials, &mut settings, 1001).await,
        Err(Outcome::Retry { seconds: 120, .. })
    ));
    assert_eq!(
        private.credentials.get("pinterest").unwrap()["refreshPending"],
        false
    );
    assert_eq!(
        private.credentials.get("pinterest").unwrap()["accessToken"],
        "pina-private-access"
    );
    fake.rate_refresh.set(false);
    authorize(&fake, &mut private.credentials, &mut settings, 1002)
        .await
        .ok()
        .unwrap();
    assert_eq!(fake.refreshes.get(), 2);
    assert!(!settings.refresh_pending);
    assert_eq!(fake.creates.get(), 0);
}
