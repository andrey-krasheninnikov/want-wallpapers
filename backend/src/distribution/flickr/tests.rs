use super::*;
use std::cell::{Cell, RefCell};

struct Fake {
    uploads: Cell<usize>,
    license_writes: Cell<usize>,
    publishes: Cell<usize>,
    lose_upload: Cell<bool>,
    lose_publish: Cell<bool>,
    wrong_user: Cell<bool>,
    expired: Cell<bool>,
    quota_exhausted: Cell<bool>,
    read_fails: Cell<bool>,
    pro: Cell<bool>,
    photo: RefCell<Value>,
    requests: RefCell<Vec<Value>>,
}
impl Fake {
    fn new() -> Self {
        Self {
            uploads: Cell::new(0),
            license_writes: Cell::new(0),
            publishes: Cell::new(0),
            lose_upload: Cell::new(false),
            lose_publish: Cell::new(false),
            wrong_user: Cell::new(false),
            expired: Cell::new(false),
            quota_exhausted: Cell::new(false),
            read_fails: Cell::new(false),
            pro: Cell::new(true),
            photo: RefCell::new(Value::Null),
            requests: RefCell::new(vec![]),
        }
    }
}
impl Api for Fake {
    async fn call(
        &self,
        settings: &Settings,
        method: &str,
        parameters: &[(&str, &str)],
        write: bool,
    ) -> Result<Value> {
        let parameters = parameters
            .iter()
            .map(|(key, value)| (key.to_string(), json!(value)))
            .collect::<serde_json::Map<_, _>>();
        self.requests
            .borrow_mut()
            .push(json!({"method":method,"parameters":parameters,"write":write}));
        match method {
            "flickr.auth.oauth.checkToken" => {
                if self.expired.get() {
                    return Err(blocked("flickr-reauthorization-required"));
                }
                Ok(
                    json!({"stat":"ok","oauth":{"user":{"nsid":if self.wrong_user.get(){"999@N00"}else{&settings.user_id}},"token":{"_content":settings.access_token},"perms":{"_content":"write"}}}),
                )
            }
            "flickr.people.getUploadStatus" => Ok(
                json!({"stat":"ok","user":{"id":settings.user_id,"ispro":if self.pro.get(){1}else{0},"filesize":{"maxbytes":"5242880"},"bandwidth":{"unlimited":0,"remainingbytes":if self.quota_exhausted.get(){0}else{5242880}}}}),
            ),
            "flickr.photos.getInfo" => {
                if self.read_fails.get() {
                    Err(retry("flickr-read-unavailable"))
                } else {
                    Ok(json!({"stat":"ok","photo":self.photo.borrow().clone()}))
                }
            }
            "flickr.photos.licenses.setLicense" => {
                assert!(write);
                assert_eq!(parameters["license_id"], "0");
                self.license_writes.set(self.license_writes.get() + 1);
                self.photo.borrow_mut()["license"] = json!("0");
                Ok(json!({"stat":"ok"}))
            }
            "flickr.photos.setPerms" => {
                assert!(write);
                assert_eq!(parameters["is_public"], "1");
                assert_eq!(parameters["is_friend"], "0");
                assert_eq!(parameters["is_family"], "0");
                assert_eq!(self.photo.borrow()["license"], "0");
                self.publishes.set(self.publishes.get() + 1);
                self.photo.borrow_mut()["visibility"]["ispublic"] = json!(1);
                if self.lose_publish.get() {
                    Err(Outcome::Unknown("flickr-write-unconfirmed"))
                } else {
                    Ok(json!({"stat":"ok","photoid":{"_content":"123456789012345678"}}))
                }
            }
            _ => panic!("unexpected method"),
        }
    }
    async fn upload(
        &self,
        settings: &Settings,
        metadata: &Value,
        image: Vec<u8>,
    ) -> Result<String> {
        self.uploads.set(self.uploads.get() + 1);
        assert_eq!(image, photo());
        *self.photo.borrow_mut() = json!({"id":"123456789012345678","owner":{"nsid":settings.user_id},"title":{"_content":metadata["title"]},"description":{"_content":metadata["description"]},"license":"4","visibility":{"ispublic":0,"isfriend":"0","isfamily":0},"content_type":"3","safety_level":1});
        if self.lose_upload.get() {
            Err(Outcome::Unknown("flickr-upload-unconfirmed"))
        } else {
            Ok("123456789012345678".into())
        }
    }
    async fn asset(&self, _asset: &Asset) -> Result<Vec<u8>> {
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
    json!({"enabled":true,"commercialApiApproved":true,"userId":"123456@N00","apiKey":"private-api-key","apiSecret":"private-api-secret","accessToken":"private-token","tokenSecret":"private-token-secret"})
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
        index,
        title: format!("English artwork {index}"),
        description: "Approved <literal> text & details.".into(),
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
        destination: "flickr".into(),
        item: format!("post-{}", prepared.index),
        claim: Uuid::new_v4(),
        generation: 1,
        payload: json!({}),
        progress: json!({}),
        reconcile: false,
    }
}
async fn step(
    fake: &Fake,
    delivery: &mut Delivery,
    prepared: &Prepared,
    settings: &Settings,
) -> Outcome {
    let outcome = deliver(fake, delivery, prepared, settings)
        .await
        .unwrap_or_else(|value| value);
    if let Outcome::Progress(progress) = &outcome {
        delivery.progress = progress.clone();
    }
    outcome
}
#[tokio::test]
async fn five_items_stage_privately_then_verify_license_before_publishing_without_reupload() {
    let settings = Settings::parse(&configuration()).ok().unwrap();
    for index in 1..=5 {
        let fake = Fake::new();
        let prepared = prepared(index);
        let mut delivery = delivery(&prepared);
        identity(&fake, &settings).await.ok().unwrap();
        assert!(matches!(
            step(&fake, &mut delivery, &prepared, &settings).await,
            Outcome::Progress(_)
        ));
        assert_eq!(fake.photo.borrow()["visibility"]["ispublic"], 0);
        assert_eq!(fake.publishes.get(), 0);
        assert!(matches!(
            step(&fake, &mut delivery, &prepared, &settings).await,
            Outcome::Progress(_)
        ));
        assert_eq!(fake.license_writes.get(), 1);
        assert_eq!(fake.publishes.get(), 0);
        assert!(matches!(
            step(&fake, &mut delivery, &prepared, &settings).await,
            Outcome::Progress(_)
        ));
        assert_eq!(delivery.progress["phase"], "publish");
        assert_eq!(fake.publishes.get(), 0);
        assert!(matches!(
            step(&fake, &mut delivery, &prepared, &settings).await,
            Outcome::Progress(_)
        ));
        for _ in 0..2 {
            let Outcome::Delivered(receipt) =
                step(&fake, &mut delivery, &prepared, &settings).await
            else {
                panic!("readback failed")
            };
            assert_eq!(receipt["photoId"], "123456789012345678");
            assert!(
                receipt["canonicalUrl"]
                    .as_str()
                    .unwrap()
                    .contains(&prepared.manifest.wallpapers[index - 1].slug)
            );
            assert!(!receipt.to_string().contains("private"));
        }
        assert_eq!(fake.uploads.get(), 1);
        assert_eq!(fake.license_writes.get(), 1);
        assert_eq!(fake.publishes.get(), 1);
        assert_eq!(media(&prepared).ok().unwrap().design as usize, index);
    }
}
#[tokio::test]
async fn saved_photo_survives_read_retry_but_modified_identity_or_payload_blocks() {
    let settings = Settings::parse(&configuration()).ok().unwrap();
    let fake = Fake::new();
    let prepared = prepared(1);
    let mut delivery = delivery(&prepared);
    step(&fake, &mut delivery, &prepared, &settings).await;
    fake.read_fails.set(true);
    assert!(matches!(
        step(&fake, &mut delivery, &prepared, &settings).await,
        Outcome::Retry { .. }
    ));
    fake.read_fails.set(false);
    let mut changed = prepared.clone();
    changed.description.push('!');
    assert!(matches!(
        step(&fake, &mut delivery, &changed, &settings).await,
        Outcome::Blocked("flickr-progress-identity-mismatch")
    ));
    for pointer in [
        "/owner/nsid",
        "/title/_content",
        "/description/_content",
        "/content_type",
        "/safety_level",
    ] {
        let old = fake.photo.borrow().pointer(pointer).unwrap().clone();
        *fake.photo.borrow_mut().pointer_mut(pointer).unwrap() = json!("changed");
        assert!(matches!(
            step(&fake, &mut delivery, &prepared, &settings).await,
            Outcome::Blocked("flickr-photo-readback-mismatch")
        ));
        *fake.photo.borrow_mut().pointer_mut(pointer).unwrap() = old;
    }
    assert_eq!(fake.uploads.get(), 1);
    assert_eq!(fake.publishes.get(), 0);
}
#[tokio::test]
async fn quota_expired_token_commercial_approval_and_wrong_account_stop_before_upload() {
    let settings = Settings::parse(&configuration()).ok().unwrap();
    let fake = Fake::new();
    let prepared = prepared(1);
    let mut delivery = delivery(&prepared);
    fake.quota_exhausted.set(true);
    assert!(matches!(
        step(&fake, &mut delivery, &prepared, &settings).await,
        Outcome::Blocked("flickr-upload-quota-reached")
    ));
    fake.quota_exhausted.set(false);
    fake.pro.set(false);
    assert!(matches!(
        step(&fake, &mut delivery, &prepared, &settings).await,
        Outcome::Blocked("flickr-commercial-account-required")
    ));
    fake.pro.set(true);
    fake.wrong_user.set(true);
    assert!(identity(&fake, &settings).await.is_err());
    fake.wrong_user.set(false);
    fake.expired.set(true);
    assert!(matches!(
        identity(&fake, &settings).await,
        Err(Outcome::Blocked("flickr-reauthorization-required"))
    ));
    let mut unapproved = configuration();
    unapproved["commercialApiApproved"] = json!(false);
    assert!(matches!(
        Settings::parse(&unapproved),
        Err(Outcome::Blocked("flickr-commercial-api-approval-required"))
    ));
    assert_eq!(fake.uploads.get(), 0);
    assert_eq!(fake.publishes.get(), 0);
}
#[tokio::test]
async fn lost_private_upload_and_public_transition_stay_unknown_with_saved_public_id_readable() {
    let settings = Settings::parse(&configuration()).ok().unwrap();
    let prepared = prepared(1);
    let fake = Fake::new();
    let mut delivery = delivery(&prepared);
    fake.lose_upload.set(true);
    assert!(matches!(
        step(&fake, &mut delivery, &prepared, &settings).await,
        Outcome::Unknown(_)
    ));
    assert_eq!(fake.uploads.get(), 1);
    let fake = Fake::new();
    for _ in 0..3 {
        assert!(matches!(
            step(&fake, &mut delivery, &prepared, &settings).await,
            Outcome::Progress(_)
        ));
    }
    fake.lose_publish.set(true);
    assert!(matches!(
        step(&fake, &mut delivery, &prepared, &settings).await,
        Outcome::Unknown(_)
    ));
    // Owner inspection can confirm this saved ID; the queue keeps the unknown attempt held meanwhile.
    assert!(matches!(
        step(&fake, &mut delivery, &prepared, &settings).await,
        Outcome::Delivered(_)
    ));
    assert_eq!(fake.uploads.get(), 1);
    assert_eq!(fake.publishes.get(), 1);
}
#[test]
fn art_classification_private_upload_and_literal_copy_follow_native_fields() {
    let prepared = prepared(1);
    let link = "https://wallpapers.want.foundation/wallpapers/work/";
    let metadata = metadata(&prepared, link).ok().unwrap();
    let parameters = upload_parameters(&metadata)
        .into_iter()
        .collect::<std::collections::BTreeMap<_, _>>();
    for (key, value) in [
        ("is_public", "0"),
        ("is_friend", "0"),
        ("is_family", "0"),
        ("content_type", "3"),
        ("safety_level", "1"),
        ("hidden", "1"),
    ] {
        assert_eq!(parameters[key], value);
    }
    assert_eq!(metadata["license"], 0);
    assert!(parameters["description"].contains("&lt;literal&gt; text &amp;"));
    assert!(parameters["description"].contains(&format!("<a href=\"{link}\">{link}</a>")));
    let mut bad = prepared.clone();
    bad.title = "x".repeat(256);
    assert!(super::metadata(&bad, link).is_err());
}
#[test]
fn oauth_encoding_and_signature_match_rfc5849_corrected_example() {
    let parameters = [
        ("b5", "=%3D"),
        ("a3", "a"),
        ("c@", ""),
        ("a2", "r b"),
        ("c2", ""),
        ("a3", "2 q"),
        ("oauth_consumer_key", "9djdj82h48djs9d2"),
        ("oauth_token", "kkk9d7dh3k39sjv7"),
        ("oauth_signature_method", "HMAC-SHA1"),
        ("oauth_timestamp", "137131201"),
        ("oauth_nonce", "7d8f3e4a"),
    ]
    .map(|(key, value)| (key.into(), value.into()));
    assert_eq!(
        signature(
            "POST",
            "http://example.com/request",
            &parameters,
            "j49sk3j29djd",
            "dh893hdasih9"
        )
        .ok()
        .unwrap(),
        "r6/TJjbCOr97/+UU0NsvSne7s5g="
    );
    assert_eq!(encode("a b+c/%~"), "a%20b%2Bc%2F%25~");
    assert_eq!(encode("é"), "%C3%A9");
    let settings = Settings::parse(&configuration()).ok().unwrap();
    let parameters = upload_parameters(&json!({"title":"title","description":"copy"}));
    let auth = authorization(&settings, UPLOAD, &parameters).ok().unwrap();
    assert!(auth.starts_with("OAuth "));
    assert!(auth.contains("oauth_signature_method=\"HMAC-SHA1\""));
    assert!(!auth.contains("private-token-secret"));
    assert!(!auth.contains("private-api-secret"));
}
#[test]
fn xml_upload_ids_are_strict_and_native_failures_never_leak_messages() {
    assert_eq!(upload_response(b"<rsp stat='ok'><photoid secret='private-photo-secret' originalsecret='private-original-secret'>123</photoid></rsp>").ok().unwrap(),"123");
    assert_eq!(
        upload_response(
            b"<?xml version='1.0'?><rsp stat='ok'><photoid>123456789012345678</photoid></rsp>"
        )
        .ok()
        .unwrap(),
        "123456789012345678"
    );
    for xml in [
        "<rsp stat='ok'><photoid>1</photoid><photoid>2</photoid></rsp>",
        "<other stat='ok'><photoid>1</photoid></other>",
        "<rsp stat='ok'><photoid>1</photoid></rsp><rsp stat='ok'><photoid>2</photoid></rsp>",
        "<!DOCTYPE rsp [<!ENTITY x '1'>]><rsp stat='ok'><photoid>&x;</photoid></rsp>",
        "<rsp stat='ok'><photoid>abc</photoid></rsp>",
        "<rsp stat='ok'><photoid>1</photoid>",
    ] {
        assert!(matches!(
            upload_response(xml.as_bytes()),
            Err(Outcome::Unknown(_))
        ));
    }
    assert!(matches!(
        upload_response(b"<rsp stat='fail'><err code='6' msg='private details'/></rsp>"),
        Err(Outcome::Blocked("flickr-upload-quota-reached"))
    ));
    assert!(matches!(
        upload_response(b"<rsp stat='fail'><err code='3' msg='private details'/></rsp>"),
        Err(Outcome::Unknown("flickr-upload-unconfirmed"))
    ));
    for code in 96..=100 {
        assert!(matches!(
            failure(code, false),
            Outcome::Blocked("flickr-reauthorization-required")
        ));
    }
    let reply = transport::Reply {
        status: reqwest::StatusCode::OK,
        body: json!({"stat":"fail","code":105,"message":"private details"}),
        retry_after: None,
    };
    assert!(matches!(
        rpc(reply),
        Err(Outcome::Unknown("flickr-write-unconfirmed"))
    ));
    assert!(matches!(
        read_failure(Outcome::Unknown("private details")),
        Outcome::Retry { .. }
    ));
    let reply = transport::Reply {
        status: reqwest::StatusCode::TOO_MANY_REQUESTS,
        body: Value::Null,
        retry_after: Some(120),
    };
    assert!(matches!(
        rpc(reply),
        Err(Outcome::Retry { seconds: 120, .. })
    ));
}

#[tokio::test]
async fn account_downgrade_before_publication_preserves_private_photo() {
    let fake = Fake::new();
    let prepared = prepared(1);
    let settings = Settings::parse(&configuration()).ok().unwrap();
    let mut delivery = delivery(&prepared);
    for _ in 0..3 {
        assert!(matches!(
            step(&fake, &mut delivery, &prepared, &settings).await,
            Outcome::Progress(_)
        ));
    }
    fake.pro.set(false);
    assert!(matches!(
        step(&fake, &mut delivery, &prepared, &settings).await,
        Outcome::Blocked("flickr-commercial-account-required")
    ));
    assert_eq!(fake.photo.borrow()["visibility"]["ispublic"], 0);
    assert_eq!(fake.uploads.get(), 1);
    assert_eq!(fake.publishes.get(), 0);
}
