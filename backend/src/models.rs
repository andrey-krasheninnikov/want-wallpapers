use crate::error::{ApiError, Result};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};

pub const LOCALES: [&str; 6] = ["en", "ru", "zh-cn", "pt-br", "ja", "ar"];
pub type Localized = BTreeMap<String, String>;
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Collection {
    pub id: String,
    pub slug: String,
    pub count: i64,
    pub title: Localized,
    pub description: Localized,
    #[serde(
        default,
        rename = "videoCover",
        skip_serializing_if = "Option::is_none",
        deserialize_with = "video_cover"
    )]
    pub video_cover: Option<VideoCover>,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct VideoCover {
    pub src: String,
    pub poster: String,
}
fn video_cover<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> std::result::Result<Option<VideoCover>, D::Error> {
    VideoCover::deserialize(deserializer).map(Some)
}
impl VideoCover {
    fn validate(&self, collection_id: &str) -> Result<()> {
        let prefix = format!(
            "https://want-foundation.s3.twcstorage.ru/wallpapers/assets/collections/{collection_id}/"
        );
        for (url, extension) in [(&self.src, ".mp4"), (&self.poster, ".png")] {
            let name = url
                .strip_prefix(&prefix)
                .and_then(|name| name.strip_suffix(extension))
                .ok_or_else(ApiError::invalid)?;
            if url.len() > 2048
                || name.is_empty()
                || !name.as_bytes()[0].is_ascii_alphanumeric()
                || !name
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
            {
                return Err(ApiError::invalid());
            }
        }
        Ok(())
    }
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Wallpaper {
    pub id: String,
    pub slug: String,
    pub collection: String,
    pub collection_id: String,
    pub s3_folder: String,
    pub file_stem: String,
    pub number: i64,
    pub category: String,
    pub tags: Vec<String>,
    pub title: Localized,
    pub description: Localized,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Manifest {
    pub collection: Collection,
    pub wallpapers: Vec<Wallpaper>,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct ListingFlags {
    pub collections: BTreeMap<String, bool>,
    pub wallpapers: BTreeMap<String, bool>,
}
#[derive(Serialize)]
pub struct Snapshot {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub listing: Option<ListingFlags>,
    #[serde(rename = "collectionPublicationDates")]
    pub collection_publication_dates: BTreeMap<String, String>,
    #[serde(rename = "publicationDates")]
    pub publication_dates: BTreeMap<String, String>,
    pub collections: Vec<Collection>,
    pub wallpapers: Vec<Wallpaper>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Taxonomy {
    pub category_labels: Vec<String>,
    pub tag_labels: Vec<String>,
}
fn localized(value: &Localized, max: usize) -> Result<()> {
    if value.len() != LOCALES.len()
        || LOCALES.iter().any(|key| {
            value.get(*key).is_none_or(|text| {
                text.trim().is_empty() || text.encode_utf16().count() > max || text.contains('\0')
            })
        })
    {
        return Err(ApiError::invalid());
    }
    Ok(())
}
pub fn text(value: &str, min: usize, max: usize) -> Result<String> {
    let value = value.trim();
    if !(min..=max).contains(&value.encode_utf16().count()) || value.contains('\0') {
        return Err(ApiError::invalid());
    }
    Ok(value.to_owned())
}
impl Collection {
    pub fn folder_number(&self) -> Result<i64> {
        let (number, slug) = self.id.split_once('-').ok_or_else(ApiError::invalid)?;
        if !number.bytes().all(|byte| byte.is_ascii_digit()) {
            return Err(ApiError::invalid());
        }
        let number: i64 = number.parse().map_err(|_| ApiError::invalid())?;
        if number <= 0
            || number > 9_007_199_254_740_991
            || slug != self.slug
            || self.id.len() > 200
            || self.slug.len() > 180
            || self.slug.split('-').any(|part| {
                part.is_empty()
                    || !part
                        .bytes()
                        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
            })
            || self.count < 0
            || self.count > 1000
        {
            return Err(ApiError::invalid());
        }
        localized(&self.title, 200)?;
        localized(&self.description, 2000)?;
        if let Some(cover) = &self.video_cover {
            cover.validate(&self.id)?;
        }
        Ok(number)
    }
}
impl Wallpaper {
    pub fn validate(&self, collection: &Collection) -> Result<()> {
        collection.folder_number()?;
        let taxonomy: Taxonomy = serde_json::from_str(include_str!("../data/taxonomy.json"))
            .map_err(|_| ApiError::invalid())?;
        if self.number <= 0
            || self.number > 9_007_199_254_740_991
            || self.id != format!("{}-{}", collection.slug, self.number)
            || self.slug != self.id
            || self.collection_id != collection.id
            || self.s3_folder != collection.id
            || self.collection != collection.slug
            || self.file_stem != collection.slug
            || !taxonomy.category_labels.contains(&self.category)
            || self.tags.is_empty()
            || self.tags.iter().collect::<HashSet<_>>().len() != self.tags.len()
            || self
                .tags
                .iter()
                .any(|tag| !taxonomy.tag_labels.contains(tag))
        {
            return Err(ApiError::invalid());
        }
        localized(&self.title, 200)?;
        localized(&self.description, 2000)?;
        Ok(())
    }
}
impl Manifest {
    pub fn validate(&self) -> Result<()> {
        self.collection.folder_number()?;
        if self.wallpapers.is_empty()
            || self.collection.count != self.wallpapers.len() as i64
            || self
                .wallpapers
                .iter()
                .map(|w| w.number)
                .collect::<HashSet<_>>()
                .len()
                != self.wallpapers.len()
        {
            return Err(ApiError::invalid());
        }
        for wallpaper in &self.wallpapers {
            wallpaper.validate(&self.collection)?;
        }
        Ok(())
    }
}
