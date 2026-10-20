use crate::{
    AppState,
    error::{ApiError, Result},
    models::{Collection, ListingFlags, Wallpaper},
};
use axum::{
    body::{Body, to_bytes},
    extract::{Request, State},
    http::{HeaderValue, Method, StatusCode, header},
    middleware::Next,
    response::{IntoResponse, Response},
};
use base64::{Engine, engine::general_purpose::STANDARD};
use lol_html::{RewriteStrSettings, element, html_content::ContentType, rewrite_str, text};
use serde::Deserialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::{PgPool, Row};
use std::{
    cell::RefCell,
    collections::{BTreeMap, HashMap},
    path::Path,
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalizedBuild {
    gallery: Value,
    data_url: String,
    scene_html: HashMap<String, String>,
    mosaic_html: HashMap<String, Vec<String>>,
    cover_html: HashMap<String, String>,
    previous_html: HashMap<String, String>,
    next_html: HashMap<String, String>,
    results_label: String,
    empty_search_html: String,
    wallpapers_label: String,
    collections_label: String,
    numbers: Vec<String>,
}
#[derive(Deserialize)]
pub struct BuildCatalog {
    schema: u32,
    collections: Vec<Collection>,
    wallpapers: Vec<Wallpaper>,
    order: Vec<String>,
    locales: HashMap<String, LocalizedBuild>,
}
#[derive(Clone)]
pub struct DynamicHashes(pub HashMap<String, Vec<String>>);
impl BuildCatalog {
    pub fn load(
        directory: &Path,
    ) -> std::result::Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let value: Self =
            serde_json::from_slice(&std::fs::read(directory.join("../runtime-catalog.json"))?)?;
        if value.schema != 1
            || value.locales.len() != 4
            || value.order.len() != value.wallpapers.len()
        {
            return Err("Invalid runtime catalog".into());
        }
        Ok(value)
    }
    fn collection(&self, value: &str) -> Option<&Collection> {
        let slug = value
            .trim_end_matches('/')
            .rsplit('/')
            .next()
            .unwrap_or_default();
        self.collections
            .iter()
            .find(|item| item.slug == slug || item.id == value)
    }
    fn wallpaper(&self, value: &str) -> Option<&Wallpaper> {
        let slug = value
            .trim_end_matches('/')
            .rsplit('/')
            .next()
            .unwrap_or_default();
        self.wallpapers.iter().find(|item| item.id == slug)
    }
    fn shown(&self, flags: &ListingFlags, id: &str, collection_page: Option<&str>) -> bool {
        self.wallpaper(id).is_some_and(|item| {
            flags.wallpapers.get(&item.id) == Some(&true)
                && (collection_page == Some(item.collection.as_str())
                    || flags.collections.get(&item.collection_id) == Some(&true))
        })
    }
    fn count(&self, flags: &ListingFlags, collection: &Collection) -> usize {
        self.wallpapers
            .iter()
            .filter(|item| {
                item.collection_id == collection.id && flags.wallpapers.get(&item.id) == Some(&true)
            })
            .count()
    }
    fn cover<'a>(&'a self, flags: &ListingFlags, collection: &Collection) -> Option<&'a Wallpaper> {
        self.wallpapers.iter().find(|item| {
            item.collection_id == collection.id && flags.wallpapers.get(&item.id) == Some(&true)
        })
    }
    fn gallery(&self, localized: &LocalizedBuild, flags: &ListingFlags) -> Value {
        let mut data = localized.gallery.clone();
        if let Some(items) = data["wallpapers"].as_array_mut() {
            items.retain(|item| self.shown(flags, item["id"].as_str().unwrap_or_default(), None));
        }
        if let Some(stories) = data["stories"].as_object_mut() {
            stories.retain(|slug, _| {
                self.collection(slug)
                    .is_some_and(|item| flags.collections.get(&item.id) == Some(&true))
            });
            for (slug, story) in stories {
                if let Some(collection) = self.collection(slug)
                    && collection.video_cover.is_none()
                {
                    if let Some(cover) = self
                        .cover(flags, collection)
                        .and_then(|item| gallery_item(localized, &item.id))
                    {
                        story["image"] = cover["desktop"].clone();
                    } else if let Some(story) = story.as_object_mut() {
                        story.remove("image");
                    }
                }
            }
        }
        data
    }
    fn navigation(&self, localized: &LocalizedBuild, flags: &ListingFlags, id: &str) -> Value {
        let visible: Vec<_> = self
            .order
            .iter()
            .filter(|id| self.shown(flags, id, None))
            .collect();
        let position = visible
            .iter()
            .position(|item| item.as_str() == id)
            .map(|index| index + 1);
        let current = self.order.iter().position(|item| item == id).unwrap_or(0);
        let neighbor = |backwards: bool| {
            (1..=self.order.len())
                .map(|step| {
                    if backwards {
                        (current + self.order.len() - step) % self.order.len()
                    } else {
                        (current + step) % self.order.len()
                    }
                })
                .map(|index| &self.order[index])
                .find(|other| other.as_str() != id && self.shown(flags, other, None))
                .and_then(|other| gallery_item(localized, other))
                .map(|item| json!({"href":item["href"],"title":item["title"]}))
                .unwrap_or(Value::Null)
        };
        json!({"position":position,"total":visible.len(),"previous":neighbor(true),"next":neighbor(false)})
    }
    pub fn project(
        &self,
        html: &str,
        path: &str,
        flags: &ListingFlags,
    ) -> Result<(String, Vec<String>)> {
        let (locale, route) = localized_route(path);
        let localized = self.locales.get(locale).ok_or_else(ApiError::invalid)?;
        let collection_page = route
            .strip_prefix("/collections/")
            .filter(|slug| !slug.contains('/'));
        let wallpaper_id = route.strip_prefix("/wallpapers/");
        let data = self.gallery(localized, flags);
        let items = data["wallpapers"]
            .as_array()
            .ok_or_else(ApiError::invalid)?;
        let selected = items
            .iter()
            .find(|item| item["id"] == "contours-of-silence-11")
            .or_else(|| items.first());
        let version = hex::encode(Sha256::digest(
            serde_json::to_vec(flags).map_err(|_| ApiError::invalid())?,
        ));
        let url = format!("{}?listing={version}", localized.data_url);
        let navigation = wallpaper_id.map(|id| self.navigation(localized, flags, id));
        let direct_collection = collection_page.and_then(|slug| self.collection(slug));
        let direct_cover = direct_collection
            .and_then(|collection| self.cover(flags, collection))
            .and_then(|item| gallery_item(localized, &item.id));
        let change_metadata_cover = route.is_empty()
            || direct_collection.is_some_and(|collection| collection.video_cover.is_none());
        let metadata_cover = if route.is_empty() {
            selected
        } else {
            direct_cover
        };
        let projected = rewrite_str(html, handlers(vec![
            element!("[data-collection-card]", |element| {
                let shown = element.get_attribute("data-collection-card").and_then(|id| self.collection(&id)).is_some_and(|item| flags.collections.get(&item.id) == Some(&true));
                if !shown { element.remove(); } Ok(())
            }),
            element!("[data-wallpaper-card], [data-listing-wallpaper]", |element| {
                let id = element.get_attribute("data-wallpaper-card").or_else(|| element.get_attribute("data-listing-wallpaper")).unwrap_or_default();
                if !self.shown(flags, &id, collection_page) { element.remove(); } Ok(())
            }),
            element!("[data-listing-tag]", |element| {
                let tag = element.get_attribute("data-listing-tag").unwrap_or_default();
                if !self.wallpapers.iter().any(|item| collection_page == Some(item.collection.as_str()) && self.shown(flags, &item.id, collection_page) && item.tags.contains(&tag)) { element.remove(); } Ok(())
            }),
            element!("[data-collection-count]", |element| {
                if let Some(collection) = element.get_attribute("data-collection-count").and_then(|value| self.collection(&value)) {
                    element.set_inner_content(&format!("{} {}", self.count(flags, collection), localized.wallpapers_label), ContentType::Text);
                } Ok(())
            }),
            element!("[data-collection-image]", |element| {
                if let Some(collection) = element.get_attribute("data-collection-image").and_then(|value| self.collection(&value)) && collection.video_cover.is_none() {
                    if let Some(cover) = self.cover(flags, collection).and_then(|item| localized.cover_html.get(&item.id)) { element.replace(cover, ContentType::Html); }
                    else { element.remove(); }
                } Ok(())
            }),
            element!("[data-collection-story-image]", |element| {
                let slug = element.get_attribute("data-collection-story-image").unwrap_or_default();
                let image = &data["stories"][slug]["image"];
                if image.is_null() { element.remove(); } else {
                    for key in ["src", "width", "height"] {
                        let value = &image[key];
                        element.set_attribute(key, &escape(&value.as_str().map(str::to_owned).unwrap_or_else(|| value.to_string())))?;
                    }
                } Ok(())
            }),
            element!("[data-direct-collection-cover]", |element| {
                if direct_cover.is_none() { element.remove(); } Ok(())
            }),
            element!("[data-direct-collection-cover] img", |element| {
                if let Some(item) = direct_cover {
                    for key in ["src", "width", "height"] {
                        let value = &item["desktop"][key];
                        element.set_attribute(key, &escape(&value.as_str().map(str::to_owned).unwrap_or_else(|| value.to_string())))?;
                    }
                    element.set_attribute("alt", &escape(item["description"].as_str().unwrap_or_default()))?;
                } Ok(())
            }),
            element!("[data-discovery-count]", |element| {
                let kind = element.get_attribute("data-discovery-count").unwrap_or_default();
                let collections = kind == "collections";
                let count = if collections { self.collections.iter().filter(|item| flags.collections.get(&item.id) == Some(&true)).count() } else { items.len() };
                element.set_inner_content(&format!("{count} {}", if collections { &localized.collections_label } else if kind == "results" { &localized.results_label } else { &localized.wallpapers_label }), ContentType::Text); Ok(())
            }),
            element!("[data-story-group]", |element| { if data["stories"].as_object().is_none_or(|stories| stories.is_empty()) { element.remove(); } Ok(()) }),
            element!("astro-island[props]", |element| {
                let component = element.get_attribute("component-url").unwrap_or_default();
                let kind = ["DeviceScene", "HomeMosaic", "CollectionCarousel", "CatalogSearch", "StoryCarousel", "WallpaperView"].into_iter().find(|name| component.contains(name));
                let Some(kind) = kind else { return Ok(()); };
                let raw = unescape(&element.get_attribute("props").unwrap_or_default());
                let serialized: Value = serde_json::from_str(&raw)?;
                let mut props = decode_object(&serialized)?;
                match kind {
                    "DeviceScene" => {
                        let Some(item) = selected else { element.remove(); return Ok(()); };
                        let id = item["id"].as_str().ok_or("Missing scene identity")?;
                        props["items"] = json!([item]); props["initialId"] = json!(id);
                        element.set_inner_content(localized.scene_html.get(id).ok_or("Missing scene fragment")?, ContentType::Html);
                    }
                    "HomeMosaic" => { props["items"] = json!(items.iter().take(6).collect::<Vec<_>>()); if items.is_empty() { element.remove(); return Ok(()); } }
                    "CollectionCarousel" => {
                        if let Some(cards) = props["items"].as_array_mut() {
                            cards.retain(|card| self.collection(card["href"].as_str().unwrap_or_default()).is_some_and(|item| flags.collections.get(&item.id) == Some(&true)));
                            for card in cards { if let Some(collection) = self.collection(card["href"].as_str().unwrap_or_default()) {
                                card["countLabel"] = json!(format!("{} {}", self.count(flags, collection), localized.wallpapers_label));
                                if collection.video_cover.is_none() { if let Some(item) = self.cover(flags, collection).and_then(|item| gallery_item(localized, &item.id)) { card["image"] = item["desktop"].clone(); } else { card.as_object_mut().ok_or("Invalid card")?.remove("image"); } }
                            } }
                        }
                    }
                    "CatalogSearch" => {
                        if let Some(cards) = props["items"].as_array_mut() { cards.retain(|card| self.shown(flags, card["id"].as_str().unwrap_or_default(), None)); }
                        if let Some(collections) = props["collections"].as_array_mut() { collections.retain(|card| self.collection(card["value"].as_str().unwrap_or_default()).is_some_and(|item| flags.collections.get(&item.id) == Some(&true))); }
                        let categories: Vec<_> = props["items"].as_array().into_iter().flatten().filter_map(|item| item["category"].as_str().map(str::to_owned)).collect();
                        if let Some(options) = props["categories"].as_array_mut() { options.retain(|item| item["value"].as_str().is_some_and(|value| categories.iter().any(|category| category == value))); }
                    }
                    "StoryCarousel" => { props["count"] = json!(data["stories"].as_object().map_or(0, |stories| stories.len())); }
                    "WallpaperView" => { if let Some(navigation) = &navigation { props["navigation"] = navigation.clone(); } }
                    _ => {}
                }
                if props.get("dataUrl").is_some() { props["dataUrl"] = json!(url); }
                element.set_attribute("props", &escape(&serde_json::to_string(&encode_object(&props))?))?;
                Ok(())
            }),
            element!("astro-island[component-url*='CatalogSearch'] .gallery-grid", |element| {
                if items.is_empty() { element.replace(&localized.empty_search_html, ContentType::Html); } Ok(())
            }),
            element!(".home-mosaic", |element| {
                let cards = items.iter().take(6).enumerate().map(|(index, item)| {
                    let id = item["id"].as_str().ok_or("Missing mosaic identity")?;
                    localized.mosaic_html.get(id).and_then(|variants| variants.get(usize::from(index == 1))).cloned().ok_or("Missing mosaic fragment")
                }).collect::<std::result::Result<Vec<_>, _>>()?;
                element.set_attribute("data-count", &cards.len().to_string())?;
                element.set_inner_content(&cards.join(""), ContentType::Html); Ok(())
            }),
            element!(".wallpaper-nav", |element| {
                if let Some(navigation) = &navigation {
                    let button = |direction: &str, fragments: &HashMap<String, String>| navigation[direction]["href"].as_str().and_then(|href| self.wallpaper(href)).and_then(|item| fragments.get(&item.id)).cloned().unwrap_or_default();
                    let position = navigation["position"].as_u64().and_then(|value| localized.numbers.get(value as usize)).map(|value| format!("{value} / {}", localized.numbers.get(navigation["total"].as_u64().unwrap_or(0) as usize).map(String::as_str).unwrap_or(""))).unwrap_or_default();
                    element.set_inner_content(&format!("{}<span class=\"wallpaper-position\" aria-live=\"polite\">{position}</span>{}", button("previous", &localized.previous_html), button("next", &localized.next_html)), ContentType::Html);
                } Ok(())
            }),
            element!("link[rel='preload'][as='image']", |element| { if route.is_empty() { element.remove(); } Ok(()) }),
            element!("meta[property='og:image'], meta[name='twitter:image']", |element| { if change_metadata_cover { if let Some(item) = metadata_cover { if let Some(src) = item["desktop"]["src"].as_str() { element.set_attribute("content", &format!("https://wallpapers.want.foundation{src}"))?; } } else { element.remove(); } } Ok(()) }),
        ])).map_err(|_| ApiError(StatusCode::SERVICE_UNAVAILABLE, "unavailable"))?;
        // JSON-LD is filtered after structural rewriting; hashes cover the final script bytes.
        let scripts = RefCell::new(Vec::<String>::new());
        let document = rewrite_str(
            &projected,
            handlers(vec![
                element!("script:not([src])", |_element| {
                    scripts.borrow_mut().push(String::new());
                    Ok(())
                }),
                text!("script:not([src])", |chunk| {
                    scripts
                        .borrow_mut()
                        .last_mut()
                        .ok_or("Missing script")?
                        .push_str(chunk.as_str());
                    Ok(())
                }),
            ]),
        )
        .map_err(|_| ApiError::invalid())?;
        let mut hashes = Vec::new();
        let mut document = document;
        for script in scripts.into_inner() {
            let mut final_script = script.clone();
            if collection_page.is_some()
                && let Ok(mut schema) = serde_json::from_str::<Value>(&script)
                && schema["@type"] == "CollectionPage"
            {
                if let Some(entries) = schema["mainEntity"]["itemListElement"].as_array_mut() {
                    entries.retain(|entry| {
                        entry["url"]
                            .as_str()
                            .and_then(|url| url::Url::parse(url).ok())
                            .is_some_and(|url| self.shown(flags, url.path(), collection_page))
                    });
                    for (index, entry) in entries.iter_mut().enumerate() {
                        entry["position"] = json!(index + 1);
                    }
                }
                final_script = serde_json::to_string(&schema)
                    .map_err(|_| ApiError::invalid())?
                    .replace('<', "\\u003c");
                document = document.replacen(&script, &final_script, 1);
            }
            hashes.push(format!(
                "sha256-{}",
                STANDARD.encode(Sha256::digest(final_script.as_bytes()))
            ));
        }
        Ok((document, hashes))
    }
}
fn handlers<'h>(
    values: Vec<(
        std::borrow::Cow<'h, lol_html::Selector>,
        lol_html::ElementContentHandlers<'h>,
    )>,
) -> RewriteStrSettings<'h, 'h> {
    values
        .into_iter()
        .fold(RewriteStrSettings::new(), |settings, handler| {
            settings.append_element_content_handler(handler)
        })
}
fn gallery_item<'a>(localized: &'a LocalizedBuild, id: &str) -> Option<&'a Value> {
    localized.gallery["wallpapers"]
        .as_array()?
        .iter()
        .find(|item| item["id"] == id)
}
fn localized_route(path: &str) -> (&str, &str) {
    let route = path
        .strip_suffix("index.html")
        .unwrap_or(path)
        .trim_end_matches('/');
    for (prefix, locale) in [("/ru", "ru"), ("/zh-cn", "zh-cn"), ("/pt-br", "pt-br")] {
        if let Some(rest) = route
            .strip_prefix(prefix)
            .filter(|rest| rest.is_empty() || rest.starts_with('/'))
        {
            return (locale, rest);
        }
    }
    ("en", route)
}
// shortcut: Astro 5 serializes catalogue props as tagged JSON values and arrays; verify on Astro upgrades.
fn decode_object(
    value: &Value,
) -> std::result::Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let object = value.as_object().ok_or("Invalid props object")?;
    Ok(Value::Object(
        object
            .iter()
            .map(|(key, tagged)| {
                let pair = tagged.as_array().ok_or("Invalid prop tag")?;
                let value = pair.get(1).cloned().unwrap_or(Value::Null);
                let decoded =
                    match pair.first().and_then(Value::as_u64) {
                        Some(0) if value.is_object() => decode_object(&value)?,
                        Some(0) => value,
                        Some(1) => Value::Array(
                            value
                                .as_array()
                                .ok_or("Invalid prop array")?
                                .iter()
                                .map(|item| {
                                    let wrapper = json!({"value": item});
                                    Ok(decode_object(&wrapper)?["value"].clone())
                                })
                                .collect::<std::result::Result<
                                    Vec<_>,
                                    Box<dyn std::error::Error + Send + Sync>,
                                >>()?,
                        ),
                        _ => return Err("Unsupported catalogue prop tag".into()),
                    };
                Ok((key.clone(), decoded))
            })
            .collect::<std::result::Result<_, Box<dyn std::error::Error + Send + Sync>>>()?,
    ))
}
fn encode_object(value: &Value) -> Value {
    Value::Object(
        value
            .as_object()
            .into_iter()
            .flatten()
            .map(|(key, value)| (key.clone(), encode_value(value)))
            .collect(),
    )
}
fn encode_value(value: &Value) -> Value {
    match value {
        Value::Object(_) => json!([0, encode_object(value)]),
        Value::Array(items) => json!([1, items.iter().map(encode_value).collect::<Vec<_>>()]),
        _ => json!([0, value]),
    }
}
fn escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}
fn unescape(value: &str) -> String {
    value
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
}
async fn flags(pool: &PgPool) -> Result<ListingFlags> {
    let mut transaction = pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *transaction)
        .await?;
    let collections = sqlx::query("SELECT id,listed AND NOT archived AS listed FROM collections")
        .fetch_all(&mut *transaction)
        .await?;
    let wallpapers = sqlx::query("SELECT id,listed AND NOT archived AS listed FROM wallpapers")
        .fetch_all(&mut *transaction)
        .await?;
    let wrap = |rows: Vec<sqlx::postgres::PgRow>| {
        rows.into_iter()
            .map(|row| (row.get("id"), row.get("listed")))
            .collect::<BTreeMap<_, _>>()
    };
    transaction.commit().await?;
    Ok(ListingFlags {
        collections: wrap(collections),
        wallpapers: wrap(wallpapers),
    })
}
pub async fn serve(State(state): State<AppState>, mut request: Request, next: Next) -> Response {
    let path = request.uri().path().to_owned();
    let Some(build) = state.runtime_catalog.as_ref() else {
        return next.run(request).await;
    };
    // Static aliases must not bypass projection through ServeDir's path decoding.
    if !crate::security::is_api_path(&path)
        && (path.contains('%')
            || path.contains("//")
            || path.split('/').any(|part| part == "." || part == ".."))
    {
        return uncached(
            ApiError(StatusCode::BAD_REQUEST, "invalid-input").into_response(),
            request.method() == Method::HEAD,
        );
    }
    let gallery = build.locales.values().find(|value| value.data_url == path);
    let (_, route) = localized_route(&path);
    let page = state.csp_hashes.contains_key(&path)
        && !path.starts_with("/admin")
        && !route.starts_with("/404");
    let llms = path == "/llms.txt";
    if (!page && gallery.is_none() && !llms)
        || !matches!(*request.method(), Method::GET | Method::HEAD)
    {
        return next.run(request).await;
    }
    let head = request.method() == Method::HEAD;
    let current = match flags(&state.pool).await {
        Ok(value) => value,
        Err(error) => {
            return uncached(error.into_response(), head);
        }
    };
    let response = if let Some(localized) = gallery {
        let mut response = axum::Json(build.gallery(localized, &current)).into_response();
        response
            .extensions_mut()
            .insert(DynamicHashes(HashMap::new()));
        response
    } else {
        for name in [
            header::IF_NONE_MATCH,
            header::IF_MODIFIED_SINCE,
            header::RANGE,
            header::IF_RANGE,
            header::IF_MATCH,
            header::IF_UNMODIFIED_SINCE,
        ] {
            request.headers_mut().remove(name);
        }
        *request.method_mut() = Method::GET;
        let response = next.run(request).await;
        if response.status() != StatusCode::OK {
            return uncached(response, head);
        }
        let (mut parts, body) = response.into_parts();
        let body = match to_bytes(body, 8 * 1024 * 1024)
            .await
            .ok()
            .and_then(|bytes| String::from_utf8(bytes.to_vec()).ok())
        {
            Some(value) => value,
            None => {
                return uncached(
                    ApiError(StatusCode::SERVICE_UNAVAILABLE, "unavailable").into_response(),
                    head,
                );
            }
        };
        let result = if llms {
            let filtered = body
                .lines()
                .filter(|line| {
                    !build.wallpapers.iter().any(|item| {
                        line.contains(&format!("/wallpapers/{}/)", item.slug))
                            && !build.shown(&current, &item.id, None)
                    }) && !build.collections.iter().any(|item| {
                        line.contains(&format!("/collections/{}/)", item.slug))
                            && current.collections.get(&item.id) != Some(&true)
                    })
                })
                .collect::<Vec<_>>()
                .join("\n");
            Ok((filtered, Vec::new()))
        } else {
            build.project(&body, &path, &current)
        };
        let (html, hashes) = match result {
            Ok(value) => value,
            Err(error) => return uncached(error.into_response(), head),
        };
        for name in [
            header::ETAG,
            header::LAST_MODIFIED,
            header::ACCEPT_RANGES,
            header::CONTENT_LENGTH,
            header::CONTENT_RANGE,
        ] {
            parts.headers.remove(name);
        }
        parts
            .extensions
            .insert(DynamicHashes(HashMap::from([(path, hashes)])));
        Response::from_parts(parts, Body::from(html))
    };
    uncached(response, head)
}
fn uncached(mut response: Response, head: bool) -> Response {
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    if head {
        *response.body_mut() = Body::empty();
    }
    response
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> BuildCatalog {
        let seed: Value = serde_json::from_str(include_str!("../data/catalog.json")).unwrap();
        let wallpapers: Vec<Wallpaper> =
            serde_json::from_value(seed["wallpapers"].clone()).unwrap();
        let items: Vec<_> = wallpapers.iter().map(|item| json!({"id":item.id,"href":format!("/wallpapers/{}/",item.slug),"title":item.title["en"],"desktop":{"src":"/previews/test.webp","width":1,"height":1}})).collect();
        let localized = json!({"gallery":{"locale":"en","wallpapers":items,"stories":{}},"dataUrl":"/gallery-data/en/test.json","sceneHtml":{},"mosaicHtml":{},"coverHtml":{},"previousHtml":{},"nextHtml":{},"emptySearchHtml":"<p>No matches</p>","resultsLabel":"results","wallpapersLabel":"wallpapers","collectionsLabel":"collections","numbers":(0..=wallpapers.len()).map(|number| number.to_string()).collect::<Vec<_>>()});
        serde_json::from_value(json!({"schema":1,"collections":seed["collections"],"wallpapers":wallpapers,"order":wallpapers.iter().map(|item| &item.id).collect::<Vec<_>>(),"locales":{"en":localized}})).unwrap()
    }
    fn all(build: &BuildCatalog) -> ListingFlags {
        ListingFlags {
            collections: build
                .collections
                .iter()
                .map(|item| (item.id.clone(), true))
                .collect(),
            wallpapers: build
                .wallpapers
                .iter()
                .map(|item| (item.id.clone(), true))
                .collect(),
        }
    }
    #[test]
    fn listing_props_round_trip_escapes_literal_entities_and_nested_values() {
        let props = json!({"items":[{"title":"<script>&quot; \"' &","number":3,"image":null}],"navigation":{"previous":null}});
        assert_eq!(
            unescape(&escape(&serde_json::to_string(&props).unwrap())),
            serde_json::to_string(&props).unwrap()
        );
        assert_eq!(decode_object(&encode_object(&props)).unwrap(), props);
        assert!(decode_object(&json!({"value":[3,"unsupported date"]})).is_err());
    }
    #[test]
    fn listing_projection_distinguishes_discovery_from_direct_collection_contents() {
        let build = fixture();
        let mut flags = all(&build);
        flags
            .collections
            .insert("0001-contours-of-silence".into(), false);
        flags
            .wallpapers
            .insert("contours-of-silence-2".into(), false);
        let html = r#"<article data-wallpaper-card="contours-of-silence-1">one</article><li data-listing-wallpaper="contours-of-silence-2">two</li><article data-collection-card="/collections/contours-of-silence/">collection</article>"#;
        let (general, _) = build.project(html, "/search/", &flags).unwrap();
        assert!(
            !general.contains("one") && !general.contains("two") && !general.contains("collection")
        );
        let (direct, _) = build
            .project(html, "/collections/contours-of-silence/", &flags)
            .unwrap();
        assert!(
            direct.contains("one") && !direct.contains("two") && !direct.contains(">collection<")
        );
        flags
            .collections
            .insert("0001-contours-of-silence".into(), true);
        let (restored, _) = build.project(html, "/search/", &flags).unwrap();
        assert!(restored.contains("one") && !restored.contains("two"));
        let navigation = build.navigation(&build.locales["en"], &flags, "contours-of-silence-2");
        assert_eq!(navigation["position"], Value::Null);
        assert!(
            navigation["previous"]["href"]
                .as_str()
                .unwrap()
                .ends_with("contours-of-silence-1/")
        );
        assert!(
            navigation["next"]["href"]
                .as_str()
                .unwrap()
                .ends_with("contours-of-silence-3/")
        );
    }
    #[test]
    fn listing_projection_filters_search_props_and_json_ld_and_hashes_final_bytes() {
        let build = fixture();
        let mut flags = all(&build);
        flags
            .wallpapers
            .insert("contours-of-silence-2".into(), false);
        let props = json!({"items":[{"id":"contours-of-silence-1","category":"nature"},{"id":"contours-of-silence-2","category":"abstract"}],"collections":[{"value":"contours-of-silence"}],"categories":[{"value":"nature"},{"value":"abstract"}]});
        let html = format!(
            "<astro-island component-url=\"/_astro/CatalogSearch.test.js\" props=\"{}\"></astro-island>",
            escape(&serde_json::to_string(&encode_object(&props)).unwrap())
        );
        let (html, _) = build.project(&html, "/search/", &flags).unwrap();
        assert!(!html.contains("contours-of-silence-2") && !html.contains("abstract"));
        let script = r#"{"@type":"CollectionPage","mainEntity":{"itemListElement":[{"url":"https://wallpapers.want.foundation/wallpapers/contours-of-silence-2/","position":1},{"url":"https://wallpapers.want.foundation/wallpapers/contours-of-silence-1/","position":2}]}}"#;
        let (html, hashes) = build
            .project(
                &format!("<script type=\"application/ld+json\">{script}</script>"),
                "/collections/contours-of-silence/",
                &flags,
            )
            .unwrap();
        assert!(!html.contains("contours-of-silence-2"));
        let script = html
            .strip_prefix("<script type=\"application/ld+json\">")
            .unwrap()
            .strip_suffix("</script>")
            .unwrap();
        assert_eq!(
            hashes,
            vec![format!(
                "sha256-{}",
                STANDARD.encode(Sha256::digest(script.as_bytes()))
            )]
        );
        assert_eq!(
            serde_json::from_str::<Value>(script).unwrap()["mainEntity"]["itemListElement"][0]["position"],
            1
        );
    }
}
