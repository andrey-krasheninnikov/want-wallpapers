use super::{
    Delivery, Error, Outcome, Result, credentials::Credentials, hexadecimal, store::Store,
};
use crate::models::Manifest;
use reqwest::{Client, RequestBuilder, StatusCode};
use serde::Deserialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::time::{Duration, SystemTime};
const SITE: &str = "https://wallpapers.want.foundation";
const CDN: &str = "https://want-foundation.s3.twcstorage.ru/wallpapers/assets/collections";

pub fn client() -> Result<Client> {
    Client::builder()
        .https_only(true)
        .no_proxy()
        .retry(reqwest::retry::never())
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(20))
        .pool_max_idle_per_host(2)
        .build()
        .map_err(|_| Error("distribution-http-unavailable"))
}
pub async fn bytes(mut response: reqwest::Response, limit: usize) -> Result<Vec<u8>> {
    if response
        .content_length()
        .is_some_and(|length| length > limit as u64)
    {
        return Err(Error("distribution-response-too-large"));
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| Error("distribution-response-interrupted"))?
    {
        if bytes.len().saturating_add(chunk.len()) > limit {
            return Err(Error("distribution-response-too-large"));
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}
pub struct Reply {
    pub status: StatusCode,
    pub body: Value,
    pub retry_after: Option<u32>,
}
impl Reply {
    pub fn rejection(&self) -> Option<Outcome> {
        match self.status.as_u16() {
            429 => Some(Outcome::Retry {
                seconds: self.retry_after.unwrap_or(300),
                code: "provider-rate-limit",
            }),
            401 | 403 => Some(Outcome::Blocked("provider-reauthorization-required")),
            400..=499 if self.status != StatusCode::REQUEST_TIMEOUT => {
                Some(Outcome::Blocked("provider-confirmed-rejection"))
            }
            500..=599 | 408 => Some(Outcome::Unknown("provider-write-outcome-unknown")),
            _ if self.status.is_success() => None,
            _ => Some(Outcome::Blocked("provider-unexpected-response")),
        }
    }
}
pub fn retry_after(value: &str, now: SystemTime) -> Option<u32> {
    value
        .parse::<u32>()
        .ok()
        .filter(|value| *value <= i32::MAX as u32)
        .or_else(|| {
            httpdate::parse_http_date(value)
                .ok()?
                .duration_since(now)
                .ok()?
                .as_secs()
                .try_into()
                .ok()
                .filter(|value| *value <= i32::MAX as u32)
        })
}
pub async fn write(request: RequestBuilder) -> std::result::Result<Reply, Outcome> {
    let response = request
        .send()
        .await
        .map_err(|_| Outcome::Unknown("provider-write-outcome-unknown"))?;
    let status = response.status();
    let retry_after = response
        .headers()
        .get(reqwest::header::RETRY_AFTER)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| retry_after(value, SystemTime::now()));
    let body = bytes(response, 256 * 1024)
        .await
        .map_err(|_| Outcome::Unknown("provider-write-outcome-unknown"))?;
    let body = match serde_json::from_slice(&body) {
        Ok(value) => value,
        Err(_) if !status.is_success() => Value::Null,
        Err(_) => return Err(Outcome::Unknown("provider-response-unconfirmed")),
    };
    Ok(Reply {
        status,
        body,
        retry_after,
    })
}
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Asset {
    pub role: String,
    pub design: u8,
    pub variant: Option<String>,
    pub sha256: String,
    pub width: u32,
    pub height: u32,
    pub name: Option<String>,
    pub emoji: Option<String>,
    pub file: String,
    pub url: String,
}
impl Asset {
    pub fn valid(&self, collection: &str) -> bool {
        self.design > 0
            && self.design <= 5
            && hexadecimal(&self.sha256, 64)
            && self.width > 0
            && self.height > 0
            && ["final", "preview", "social", "emoji"].contains(&self.role.as_str())
            && !self.file.is_empty()
            && self.file.len() <= 180
            && self
                .file
                .bytes()
                .all(|value| value.is_ascii_alphanumeric() || [b'.', b'-', b'_'].contains(&value))
            && ![".", ".."].contains(&self.file.as_str())
            && self.url == format!("{CDN}/{collection}/{}", self.file)
            && match self.role.as_str() {
                "social" => self.variant.is_none() && self.width == 1080 && self.height == 1920,
                "emoji" => self.variant.is_none() && self.width == 100 && self.height == 100,
                _ => matches!(self.variant.as_deref(), Some("desktop" | "mobile")),
            }
    }
    pub async fn download(&self, client: &Client) -> Result<Vec<u8>> {
        let response = client
            .get(&self.url)
            .send()
            .await
            .map_err(|_| Error("public-media-unavailable"))?;
        let content_type = if self.role == "social" {
            "image/jpeg"
        } else if self.role == "preview" {
            "image/webp"
        } else {
            "image/png"
        };
        if !response.status().is_success()
            || response
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|value| value.to_str().ok())
                .is_none_or(|value| value.split(';').next() != Some(content_type))
        {
            return Err(Error("public-media-unavailable"));
        }
        let bytes = bytes(response, 5 * 1024 * 1024).await?;
        if hex::encode(Sha256::digest(&bytes)) != self.sha256 {
            return Err(Error("public-media-hash-mismatch"));
        }
        Ok(bytes)
    }
}
pub struct Prepared {
    pub manifest: Manifest,
    pub title: String,
    pub description: String,
    pub assets: Vec<Asset>,
    pub index: usize,
}
pub fn prepare(delivery: &Delivery) -> Result<Prepared> {
    let package = &delivery.payload["collection"];
    let manifest: Manifest = serde_json::from_value(package["manifest"].clone())
        .map_err(|_| Error("publication-package-missing"))?;
    manifest
        .validate()
        .map_err(|_| Error("invalid-publication-manifest"))?;
    if manifest.collection.id != delivery.collection_id || manifest.wallpapers.len() != 5 {
        return Err(Error("invalid-publication-manifest"));
    }
    let index = delivery.payload["index"]
        .as_u64()
        .ok_or(Error("invalid-delivery-item"))? as usize;
    let copy = package["copy"][&delivery.destination]
        .as_array()
        .ok_or(Error("destination-copy-missing"))?;
    let one = ["telegram", "tumblr"].contains(&delivery.destination.as_str());
    if copy.len() != if one { 1 } else { 5 }
        || index == 0
        || index
            > if delivery.destination == "telegram" {
                2
            } else if one {
                1
            } else {
                5
            }
    {
        return Err(Error("destination-copy-missing"));
    }
    let post = &copy[if one { 0 } else { index - 1 }];
    let title = post["title"]
        .as_str()
        .filter(|value| !value.trim().is_empty() && value.len() <= 400)
        .ok_or(Error("destination-copy-missing"))?
        .to_owned();
    let description = post["description"]
        .as_str()
        .filter(|value| !value.trim().is_empty() && value.len() <= 8000)
        .ok_or(Error("destination-copy-missing"))?
        .to_owned();
    let assets: Vec<Asset> = serde_json::from_value(package["assets"].clone())
        .map_err(|_| Error("invalid-publication-media"))?;
    if assets.len() > 40
        || assets
            .iter()
            .any(|asset| !asset.valid(&delivery.collection_id))
    {
        return Err(Error("invalid-publication-media"));
    }
    Ok(Prepared {
        manifest,
        title,
        description,
        assets,
        index,
    })
}
pub fn canonical_page(html: &str, expected: &str) -> bool {
    let mut links = Vec::new();
    let mut english = false;
    let settings = lol_html::RewriteStrSettings::new()
        .append_element_content_handler(lol_html::element!("link[rel='canonical']", |element| {
            links.push(element.get_attribute("href").unwrap_or_default());
            Ok(())
        }))
        .append_element_content_handler(lol_html::element!("html", |element| {
            english = element
                .get_attribute("lang")
                .is_some_and(|value| value == "en");
            Ok(())
        }));
    let parsed = lol_html::rewrite_str(html, settings);
    parsed.is_ok() && english && links == [expected]
}
pub async fn check_page(client: &Client, prepared: &Prepared, collection: bool) -> Result<String> {
    let path = if collection {
        format!("/collections/{}/", prepared.manifest.collection.slug)
    } else {
        format!(
            "/wallpapers/{}/",
            prepared
                .manifest
                .wallpapers
                .get(prepared.index - 1)
                .ok_or(Error("invalid-delivery-item"))?
                .slug
        )
    };
    let url = SITE.to_owned() + &path;
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|_| Error("public-page-unavailable"))?;
    if !response.status().is_success() {
        return Err(Error("public-page-unavailable"));
    }
    let bytes = bytes(response, 512 * 1024).await?;
    let html = std::str::from_utf8(&bytes).map_err(|_| Error("public-page-invalid"))?;
    if !canonical_page(html, &url) {
        return Err(Error("public-page-invalid"));
    }
    Ok(url)
}
pub async fn send(delivery: &Delivery, credentials: &mut Credentials, _store: &Store) -> Outcome {
    if credentials.get(&delivery.destination).is_none() {
        return Outcome::Blocked("destination-not-configured");
    }
    if let Err(error) = prepare(delivery) {
        return Outcome::Blocked(error.0);
    }
    Outcome::Blocked("destination-adapter-unavailable")
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn confirmed_rejection_rate_limits_and_uncertain_writes_differ() {
        let reply = |status| Reply {
            status: StatusCode::from_u16(status).unwrap(),
            body: Value::Null,
            retry_after: Some(75),
        };
        assert!(matches!(
            reply(429).rejection(),
            Some(Outcome::Retry { seconds: 75, .. })
        ));
        assert!(matches!(reply(403).rejection(), Some(Outcome::Blocked(_))));
        assert!(matches!(reply(503).rejection(), Some(Outcome::Unknown(_))));
        assert!(reply(200).rejection().is_none());
    }
    #[test]
    fn links_and_retry_after_are_strict() {
        let url = "https://wallpapers.want.foundation/collections/test/";
        assert!(canonical_page(
            &format!("<html lang='en'><link rel='canonical' href='{url}'></html>"),
            url
        ));
        for html in [
            "<html lang='ru'></html>",
            "<html lang='en'><link rel='canonical' href='https://other.test/'></html>",
            "<html lang='en'></html>",
        ] {
            assert!(!canonical_page(html, url));
        }
        let now = SystemTime::UNIX_EPOCH + Duration::from_secs(1000);
        assert_eq!(retry_after("120", now), Some(120));
        assert_eq!(
            retry_after(&httpdate::fmt_http_date(now + Duration::from_secs(90)), now),
            Some(90)
        );
        assert_eq!(retry_after("4294967295", now), None);
        assert_eq!(retry_after("invalid", now), None);
    }
}
