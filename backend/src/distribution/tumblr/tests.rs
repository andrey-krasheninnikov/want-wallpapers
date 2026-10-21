use super::*;
use http_body_util::BodyExt;
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
    malformed_create: Cell<bool>,
    lose_refresh: Cell<bool>,
    rate_refresh: Cell<bool>,
    rate_create: Cell<bool>,
    fail_read: Cell<bool>,
    private_blog: Cell<bool>,
    wrong_blog: Cell<bool>,
    wrong_account: Cell<bool>,
    post: RefCell<Value>,
    uploaded: RefCell<Vec<u8>>,
    pages: RefCell<Vec<String>>,
}
impl Fake {
    fn new() -> Self {
        Self {
            creates: Cell::new(0),
            refreshes: Cell::new(0),
            lose_create: Cell::new(false),
            malformed_create: Cell::new(false),
            lose_refresh: Cell::new(false),
            rate_refresh: Cell::new(false),
            rate_create: Cell::new(false),
            fail_read: Cell::new(false),
            private_blog: Cell::new(false),
            wrong_blog: Cell::new(false),
            wrong_account: Cell::new(false),
            post: RefCell::new(Value::Null),
            uploaded: RefCell::new(vec![]),
            pages: RefCell::new(vec![]),
        }
    }
}
impl Api for Fake {
    async fn read(&self, path: &str, _token: &str) -> Result<Value> {
        match path {
            "/user/info" => Ok(
                json!({"user":{"name":if self.wrong_account.get(){"other"}else{"wallpapers"},"blogs":[{"name":"want-wallpapers","uuid":if self.wrong_blog.get(){"t:other"}else{"t:public-blog"},"type":if self.private_blog.get(){"private"}else{"public"}}]}}),
            ),
            "/blog/t:public-blog/posts/123456789123456789?post_format=npf" => {
                if self.fail_read.get() {
                    Err(retry("tumblr-read-unavailable"))
                } else {
                    Ok(self.post.borrow().clone())
                }
            }
            _ => panic!("unexpected request"),
        }
    }
    async fn create(
        &self,
        _settings: &Settings,
        payload: &Value,
        images: Vec<Vec<u8>>,
    ) -> Result<Value> {
        self.creates.set(self.creates.get() + 1);
        assert_eq!(images.len(), 5);
        for image in &images {
            assert_eq!(image, &photo());
        }
        if self.rate_create.get() {
            return Err(Outcome::Retry {
                seconds: 120,
                code: "provider-rate-limit",
            });
        }
        let mut content = payload["content"].clone();
        for (index, block) in content
            .as_array_mut()
            .unwrap()
            .iter_mut()
            .take(5)
            .enumerate()
        {
            block["media"] = json!([{"type":"image/jpeg","url":format!("https://64.media.tumblr.com/{index}.jpg"),"width":1080,"height":1920},{"type":"image/jpeg","url":format!("https://64.media.tumblr.com/{index}-small.jpg"),"width":250,"height":444}]);
        }
        *self.post.borrow_mut() = json!({"object_type":"post","type":"blocks","state":"published","id":"123456789123456789","tumblelog_uuid":"t:public-blog","content":content,"layout":payload["layout"],"trail":[]});
        if self.lose_create.get() {
            return Err(Outcome::Unknown("provider-write-outcome-unknown"));
        }
        if self.malformed_create.get() {
            return Ok(json!({"id":123456789123456789_u64}));
        }
        Ok(json!({"id":"123456789123456789"}))
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
        self.uploaded.borrow_mut().push(asset.design);
        Ok(photo())
    }
    async fn page(&self, prepared: &Prepared, collection: bool) -> Result<String> {
        let path = if collection {
            format!("collections/{}", prepared.manifest.collection.slug)
        } else {
            format!(
                "wallpapers/{}",
                prepared.manifest.wallpapers[prepared.index - 1].slug
            )
        };
        let url = format!("https://wallpapers.want.foundation/{path}/");
        self.pages.borrow_mut().push(url.clone());
        Ok(url)
    }
}
fn configuration() -> Value {
    json!({"enabled":true,"username":"wallpapers","blogName":"want-wallpapers","blogUuid":"t:public-blog","clientId":"private-client-id","clientSecret":"private-client-secret","accessToken":"private-access","refreshToken":"private-refresh","accessTokenExpiresAt":1000,"scope":SCOPES.join(" ")})
}
fn token_response() -> Value {
    json!({"access_token":"rotated-access","refresh_token":"rotated-refresh","expires_in":2520,"scope":SCOPES.join(" "),"token_type":"bearer"})
}
fn photo() -> Vec<u8> {
    vec![
        0xff, 0xd8, 0xff, 0xc0, 0, 8, 8, 7, 128, 4, 56, 3, 0xff, 0xd9,
    ]
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
    Prepared {
        manifest: serde_json::from_value(json!({"collection":collection,"wallpapers":wallpapers}))
            .unwrap(),
        title: "English collection".into(),
        description: "Approved English copy with <literal> & symbols.".into(),
        index: 1,
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
                url: format!("https://want-foundation.s3.twcstorage.ru/{design}.jpg"),
            })
            .collect(),
    }
}
fn delivery(prepared: &Prepared) -> Delivery {
    Delivery {
        collection_id: prepared.manifest.collection.id.clone(),
        destination: "tumblr".into(),
        item: "post-1".into(),
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
        let path = std::env::temp_dir().join(format!("wallpapers-tumblr-{}", Uuid::new_v4()));
        fs::create_dir(&path).unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o700)).unwrap();
        let root = fs::canonicalize(path).unwrap();
        fs::write(root.join("tumblr.json"), configuration().to_string()).unwrap();
        fs::set_permissions(root.join("tumblr.json"), fs::Permissions::from_mode(0o600)).unwrap();
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
async fn one_npf_photoset_binds_five_previews_copy_and_six_links_then_reads_same_id() {
    let fake = Fake::new();
    let prepared = prepared();
    let mut delivery = delivery(&prepared);
    let settings = Settings::parse(&configuration()).ok().unwrap();
    identity(&fake, &settings).await.ok().unwrap();
    let Ok(Outcome::Progress(progress)) = deliver(&fake, &delivery, &prepared, &settings).await
    else {
        panic!("creation failed")
    };
    delivery.progress = progress;
    assert_eq!(*fake.uploaded.borrow(), [1, 2, 3, 4, 5]);
    {
        let post = fake.post.borrow();
        assert_eq!(post["content"].as_array().unwrap().len(), 13);
        assert_eq!(post["content"][5]["text"], prepared.title);
        assert_eq!(post["content"][6]["text"], prepared.description);
        for index in 0..5 {
            assert_eq!(
                post["content"][index]["alt_text"],
                prepared.manifest.wallpapers[index].title["en"]
            );
        }
        for (index, url) in fake.pages.borrow().iter().enumerate() {
            assert_eq!(post["content"][index + 7]["text"], *url);
        }
    }
    for _ in 0..2 {
        let Ok(Outcome::Delivered(receipt)) = deliver(&fake, &delivery, &prepared, &settings).await
        else {
            panic!("readback failed")
        };
        assert_eq!(receipt["postId"], "123456789123456789");
        assert_eq!(receipt["sourceHashes"].as_array().unwrap().len(), 5);
        assert!(!receipt.to_string().contains("private"));
    }
    assert_eq!(fake.creates.get(), 1);
    assert_eq!(*fake.uploaded.borrow(), [1, 2, 3, 4, 5]);
}
#[tokio::test]
async fn saved_post_survives_read_failure_but_changed_payload_or_blog_never_reposts() {
    let fake = Fake::new();
    let prepared = prepared();
    let mut delivery = delivery(&prepared);
    let mut settings = Settings::parse(&configuration()).ok().unwrap();
    let Ok(Outcome::Progress(progress)) = deliver(&fake, &delivery, &prepared, &settings).await
    else {
        panic!("creation failed")
    };
    delivery.progress = progress;
    fake.fail_read.set(true);
    assert!(matches!(
        deliver(&fake, &delivery, &prepared, &settings).await,
        Err(Outcome::Retry { .. })
    ));
    fake.fail_read.set(false);
    let mut changed = prepared.clone();
    changed.description.push('!');
    assert!(matches!(
        deliver(&fake, &delivery, &changed, &settings).await,
        Err(Outcome::Blocked("tumblr-progress-identity-mismatch"))
    ));
    settings.blog_uuid = "t:other".into();
    assert!(matches!(
        deliver(&fake, &delivery, &prepared, &settings).await,
        Err(Outcome::Blocked("tumblr-progress-identity-mismatch"))
    ));
    assert_eq!(fake.creates.get(), 1);
}
#[tokio::test]
async fn missing_creation_receipt_stays_unknown_and_rate_limit_stays_retryable() {
    let prepared = prepared();
    let delivery = delivery(&prepared);
    let settings = Settings::parse(&configuration()).ok().unwrap();
    for malformed in [false, true] {
        let fake = Fake::new();
        fake.lose_create.set(!malformed);
        fake.malformed_create.set(malformed);
        assert!(matches!(
            deliver(&fake, &delivery, &prepared, &settings).await,
            Err(Outcome::Unknown(_))
        ));
        assert_eq!(fake.creates.get(), 1);
    }
    let fake = Fake::new();
    fake.rate_create.set(true);
    assert!(matches!(
        deliver(&fake, &delivery, &prepared, &settings).await,
        Err(Outcome::Retry { seconds: 120, .. })
    ));
    assert!(matches!(
        read_failure(Outcome::Unknown("private-detail")),
        Outcome::Retry { .. }
    ));
    assert!(matches!(
        read_failure(Outcome::Blocked("provider-reauthorization-required")),
        Outcome::Blocked(_)
    ));
}
#[tokio::test]
async fn only_expected_public_writable_blog_can_receive_a_post() {
    let fake = Fake::new();
    let settings = Settings::parse(&configuration()).ok().unwrap();
    for flag in [&fake.wrong_account, &fake.wrong_blog, &fake.private_blog] {
        flag.set(true);
        assert!(matches!(
            identity(&fake, &settings).await,
            Err(Outcome::Blocked("tumblr-public-blog-mismatch"))
        ));
        flag.set(false);
    }
    assert_eq!(fake.creates.get(), 0);
    let mut value = configuration();
    value["scope"] = json!("basic write");
    assert!(Settings::parse(&value).is_err());
    value = configuration();
    value["blogUuid"] = json!("t:../other");
    assert!(Settings::parse(&value).is_err());
    value = configuration();
    value["accessToken"] = json!("unsafe\nheader");
    assert!(Settings::parse(&value).is_err());
}
#[tokio::test]
async fn refresh_rotates_atomically_and_lost_refresh_blocks_after_restart() {
    let fake = Fake::new();
    let mut private = Private::new();
    let mut settings = Settings::parse(private.credentials.get("tumblr").unwrap())
        .ok()
        .unwrap();
    authorize(&fake, &mut private.credentials, &mut settings, 1001)
        .await
        .ok()
        .unwrap();
    assert_eq!(settings.access_token_expires_at, 3521);
    assert_eq!(
        fs::metadata(private.root.join("tumblr.json"))
            .unwrap()
            .permissions()
            .mode()
            & 0o777,
        0o600
    );
    let reloaded = Credentials::load(&private.root);
    assert_eq!(
        reloaded.get("tumblr").unwrap()["refreshToken"],
        "rotated-refresh"
    );
    authorize(&fake, &mut private.credentials, &mut settings, 1002)
        .await
        .ok()
        .unwrap();
    assert_eq!(fake.refreshes.get(), 1);
    let mut private = Private::new();
    let mut settings = Settings::parse(private.credentials.get("tumblr").unwrap())
        .ok()
        .unwrap();
    fake.lose_refresh.set(true);
    assert!(matches!(
        authorize(&fake, &mut private.credentials, &mut settings, 1001).await,
        Err(Outcome::Blocked("tumblr-reauthorization-required"))
    ));
    let reloaded = Credentials::load(&private.root);
    assert!(matches!(
        Settings::parse(reloaded.get("tumblr").unwrap()),
        Err(Outcome::Blocked("tumblr-reauthorization-required"))
    ));
    assert_eq!(fake.refreshes.get(), 2);
    assert_eq!(fake.creates.get(), 0);
}
#[tokio::test]
async fn confirmed_refresh_rate_limit_retains_old_tokens_and_clears_intent() {
    let fake = Fake::new();
    fake.rate_refresh.set(true);
    let mut private = Private::new();
    let mut settings = Settings::parse(private.credentials.get("tumblr").unwrap())
        .ok()
        .unwrap();
    assert!(matches!(
        authorize(&fake, &mut private.credentials, &mut settings, 1001).await,
        Err(Outcome::Retry { seconds: 120, .. })
    ));
    assert_eq!(
        private.credentials.get("tumblr").unwrap()["refreshPending"],
        false
    );
    assert_eq!(
        private.credentials.get("tumblr").unwrap()["accessToken"],
        "private-access"
    );
    fake.rate_refresh.set(false);
    authorize(&fake, &mut private.credentials, &mut settings, 1002)
        .await
        .ok()
        .unwrap();
    assert_eq!(fake.refreshes.get(), 2);
    let mut response = token_response();
    response["refresh_token"] = Value::Null;
    assert!(refreshed(&mut settings, &response, 1003).is_err());
    response = token_response();
    response["scope"] = json!("basic");
    assert!(refreshed(&mut settings, &response, 1003).is_err());
}
#[tokio::test]
async fn multipart_and_envelopes_follow_tumblr_contract_without_extra_requests() {
    let fake = Fake::new();
    let prepared = prepared();
    let settings = Settings::parse(&configuration()).ok().unwrap();
    let links = (0..6)
        .map(|index| format!("https://wallpapers.want.foundation/{index}/"))
        .collect::<Vec<_>>();
    let payload = payload(&prepared, &media(&prepared).ok().unwrap(), &links)
        .ok()
        .unwrap();
    let _ = rustls::crypto::ring::default_provider().install_default();
    let http = Http(transport::client().unwrap());
    let mut request = http
        .request(
            Method::POST,
            "/blog/t:public-blog/posts",
            &settings.access_token,
        )
        .multipart(form(&payload, vec![photo(); 5]).ok().unwrap())
        .build()
        .unwrap();
    assert_eq!(
        request.headers()[reqwest::header::USER_AGENT],
        "WantWallpapers/1 (+https://wallpapers.want.foundation/)"
    );
    assert_eq!(
        request.url().as_str(),
        "https://api.tumblr.com/v2/blog/t:public-blog/posts"
    );
    let body = request
        .body_mut()
        .take()
        .unwrap()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let body = String::from_utf8_lossy(&body);
    assert!(body.contains("name=\"json\""));
    assert!(
        body.contains("Content-Type: application/json")
            || body.contains("content-type: application/json")
    );
    for index in 1..=5 {
        assert!(body.contains(&format!(
            "name=\"photo{index}\"; filename=\"photo{index}.jpg\""
        )));
        assert_eq!(
            payload["content"][index - 1]["media"][0]["identifier"],
            format!("photo{index}")
        );
    }
    for status in [StatusCode::OK, StatusCode::CREATED] {
        let reply = transport::Reply {
            status,
            body: json!({"meta":{"status":status.as_u16()},"response":{"id":"123"}}),
            retry_after: None,
        };
        assert!(response(reply, status).is_ok());
    }
    let reply = transport::Reply {
        status: StatusCode::CREATED,
        body: json!({"meta":{"status":200},"response":{}}),
        retry_after: None,
    };
    assert!(matches!(
        response(reply, StatusCode::CREATED),
        Err(Outcome::Unknown(_))
    ));
    assert_eq!(fake.creates.get(), 0);
}
#[tokio::test]
async fn mismatched_content_layout_or_remote_identity_blocks_without_replacement() {
    let prepared = prepared();
    let settings = Settings::parse(&configuration()).ok().unwrap();
    for pointer in [
        "/state",
        "/tumblelog_uuid",
        "/content/0/alt_text",
        "/content/7/formatting/0/url",
        "/layout/0/display/0/blocks/0",
        "/content/0/media/0/url",
    ] {
        let fake = Fake::new();
        let mut delivery = delivery(&prepared);
        let Ok(Outcome::Progress(progress)) = deliver(&fake, &delivery, &prepared, &settings).await
        else {
            panic!("creation failed")
        };
        delivery.progress = progress;
        *fake.post.borrow_mut().pointer_mut(pointer).unwrap() = json!("changed");
        assert!(matches!(
            deliver(&fake, &delivery, &prepared, &settings).await,
            Err(Outcome::Blocked("tumblr-post-readback-mismatch"))
        ));
        assert_eq!(fake.creates.get(), 1);
    }
    let fake = Fake::new();
    let mut bad = prepared.clone();
    bad.description = "x".repeat(4097);
    assert!(matches!(
        deliver(&fake, &delivery(&bad), &bad, &settings).await,
        Err(Outcome::Blocked("tumblr-content-invalid"))
    ));
    bad = prepared.clone();
    bad.assets.pop();
    assert!(media(&bad).is_err());
    assert_eq!(fake.creates.get(), 0);
    assert!(!post_id("000123"));
    assert!(!post_id("18446744073709551616"));
}

#[tokio::test]
async fn unknown_creation_cannot_reenter_publication_through_send() {
    let prepared = prepared();
    let mut delivery = delivery(&prepared);
    delivery.reconcile = true;
    let mut private = Private::new();
    assert!(matches!(
        send(&delivery, &mut private.credentials, &prepared).await,
        Outcome::Unknown("tumblr-reconciliation-required")
    ));
}
