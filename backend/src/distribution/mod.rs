//! Durable publication and delivery state for the private distribution command.
pub mod credentials;
mod pinterest;
pub mod runtime;
pub mod store;
mod telegram;
pub mod transport;
pub const DESTINATIONS: [(&str, u8); 5] = [
    ("telegram", 2),
    ("pinterest", 5),
    ("tumblr", 1),
    ("deviantart", 5),
    ("flickr", 5),
];
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{collections::BTreeSet, fmt};
use uuid::Uuid;

#[derive(Debug)]
pub struct Error(pub &'static str);
impl fmt::Display for Error {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.0)
    }
}
impl std::error::Error for Error {}
pub type Result<T> = std::result::Result<T, Error>;
pub fn hash(value: &Value) -> Result<String> {
    fn sorted(value: &Value) -> Value {
        match value {
            Value::Object(items) => Value::Object(
                items
                    .iter()
                    .map(|(key, value)| (key.clone(), sorted(value)))
                    .collect::<std::collections::BTreeMap<_, _>>()
                    .into_iter()
                    .collect(),
            ),
            Value::Array(items) => Value::Array(items.iter().map(sorted).collect()),
            _ => value.clone(),
        }
    }
    serde_json::to_vec(&sorted(value))
        .map(|bytes| hex::encode(Sha256::digest(bytes)))
        .map_err(|_| Error("invalid-distribution-payload"))
}
pub fn hexadecimal(value: &str, length: usize) -> bool {
    value.len() == length
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}
pub fn collection_id(value: &str) -> bool {
    value.len() <= 140
        && value.split_once('-').is_some_and(|(number, slug)| {
            !number.is_empty()
                && number.bytes().all(|byte| byte.is_ascii_digit())
                && !slug.is_empty()
                && slug.split('-').all(|part| {
                    !part.is_empty()
                        && part
                            .bytes()
                            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
                })
        })
}
#[derive(Clone)]
pub struct Delivery {
    pub collection_id: String,
    pub destination: String,
    pub item: String,
    pub claim: Uuid,
    pub generation: i64,
    pub payload: Value,
    pub progress: Value,
    pub reconcile: bool,
}
pub enum Outcome {
    Delivered(Value),
    Progress(Value),
    Retry { seconds: u32, code: &'static str },
    Unknown(&'static str),
    Blocked(&'static str),
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ResolutionReceipt {
    schema_version: u8,
    collection_id: String,
    destination: String,
    item: String,
    remote_ids: Vec<String>,
}
impl ResolutionReceipt {
    pub fn matches(&self, collection: &str, destination: &str, item: &str) -> bool {
        self.schema_version == 1
            && self.collection_id == collection
            && self.destination == destination
            && self.item == item
            && !self.remote_ids.is_empty()
            && self.remote_ids.len() <= 200
            && self.remote_ids.iter().all(|id| {
                !id.is_empty()
                    && id.len() <= 160
                    && id.bytes().all(|byte| {
                        byte.is_ascii_alphanumeric() || [b'-', b'_', b':', b'.'].contains(&byte)
                    })
            })
    }
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Receipt {
    pub request_id: String,
    pub tag: String,
    pub source_sha: String,
    pub index_digest: String,
    pub revision: String,
    pub architecture: String,
    pub state: String,
    pub stage: String,
    pub backup_verified: bool,
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Publication {
    pub collection_id: String,
    pub package: Option<Value>,
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Batch {
    pub schema_version: u8,
    pub verified_at: u64,
    pub receipt: Receipt,
    pub publications: Vec<Publication>,
}
impl Batch {
    pub fn validate(&self) -> Result<()> {
        let receipt = &self.receipt;
        let version = receipt.tag.strip_prefix('v').unwrap_or("");
        if self.schema_version != 1
            || self.verified_at == 0
            || !hexadecimal(&receipt.request_id, 32)
            || !hexadecimal(&receipt.source_sha, 40)
            || receipt.source_sha != receipt.revision
            || !receipt
                .index_digest
                .strip_prefix("sha256:")
                .is_some_and(|value| hexadecimal(value, 64))
            || version.split('.').count() != 3
            || !version
                .split('.')
                .all(|part| !part.is_empty() && part.bytes().all(|byte| byte.is_ascii_digit()))
            || receipt.architecture != "amd64"
            || receipt.state != "succeeded"
            || receipt.stage != "complete"
            || !receipt.backup_verified
            || self.publications.is_empty()
            || self.publications.len() > 1000
        {
            return Err(Error("invalid-publication-evidence"));
        }
        let mut seen = BTreeSet::new();
        for publication in &self.publications {
            if !collection_id(&publication.collection_id)
                || !seen.insert(&publication.collection_id)
            {
                return Err(Error("invalid-publication-identity"));
            }
            if let Some(package) = &publication.package
                && (package.get("schemaVersion").and_then(Value::as_u64) != Some(1)
                    || package
                        .pointer("/manifest/collection/id")
                        .and_then(Value::as_str)
                        != Some(&publication.collection_id)
                    || !package
                        .get("packageHash")
                        .and_then(Value::as_str)
                        .is_some_and(|value| hexadecimal(value, 64)))
            {
                return Err(Error("invalid-publication-package"));
            }
        }
        Ok(())
    }
    pub async fn ingest(
        &self,
        store: &store::Store,
        configured: &BTreeSet<String>,
        file_hash: &str,
    ) -> Result<()> {
        self.validate()?;
        let items = self
            .publications
            .iter()
            .map(|publication| {
                let package_hash = publication
                    .package
                    .as_ref()
                    .and_then(|package| package.get("packageHash"))
                    .and_then(Value::as_str)
                    .map(str::to_owned);
                (
                    publication.collection_id.clone(),
                    package_hash,
                    publication.package.clone().unwrap_or_else(
                        || serde_json::json!({"collectionId": publication.collection_id,"blockedReason":"publication-package-unverified"}),
                    ),
                )
            })
            .collect::<Vec<_>>();
        let receipt = serde_json::to_value(&self.receipt)
            .map_err(|_| Error("invalid-publication-evidence"))?;
        store
            .ingest(&items, &receipt, configured, file_hash, self.verified_at)
            .await
    }
}
