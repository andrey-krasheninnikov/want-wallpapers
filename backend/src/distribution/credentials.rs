use super::{DESTINATIONS, Error, Result};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    os::unix::fs::{MetadataExt, OpenOptionsExt},
    path::{Path, PathBuf},
};
use uuid::Uuid;

pub(super) fn private_bytes(path: &Path) -> Result<Vec<u8>> {
    let metadata = fs::symlink_metadata(path).map_err(|_| Error("credentials-unavailable"))?;
    if !metadata.is_file()
        || metadata.mode() & 0o077 != 0
        || metadata.len() > 65536
        || fs::canonicalize(path).map_err(|_| Error("credentials-unavailable"))? != path
    {
        return Err(Error("private-credentials-required"));
    }
    let mut bytes = Vec::new();
    File::open(path)
        .map_err(|_| Error("credentials-unavailable"))?
        .take(65537)
        .read_to_end(&mut bytes)
        .map_err(|_| Error("credentials-unavailable"))?;
    if bytes.len() > 65536 {
        return Err(Error("invalid-credentials"));
    }
    Ok(bytes)
}
pub struct Credentials {
    root: PathBuf,
    values: BTreeMap<String, (Value, Vec<u8>)>,
}
impl Credentials {
    pub fn load(root: &Path) -> Self {
        let mut values = BTreeMap::new();
        for (destination, _) in DESTINATIONS {
            if let Ok(bytes) = private_bytes(&root.join(format!("{destination}.json")))
                && let Ok(value) = serde_json::from_slice::<Value>(&bytes)
                && value.get("enabled").and_then(Value::as_bool) == Some(true)
            {
                values.insert(
                    destination.to_owned(),
                    (value, Sha256::digest(&bytes).to_vec()),
                );
            }
        }
        Self {
            root: root.to_owned(),
            values,
        }
    }
    pub fn configured(&self) -> BTreeSet<String> {
        self.values.keys().cloned().collect()
    }
    pub fn get(&self, destination: &str) -> Option<&Value> {
        self.values.get(destination).map(|item| &item.0)
    }
    pub fn replace(&mut self, destination: &str, value: Value) -> Result<()> {
        let (_, expected) = self
            .values
            .get(destination)
            .ok_or(Error("credentials-unavailable"))?;
        let directory =
            fs::symlink_metadata(&self.root).map_err(|_| Error("private-credentials-required"))?;
        if !directory.is_dir()
            || directory.mode() & 0o077 != 0
            || fs::canonicalize(&self.root).map_err(|_| Error("private-credentials-required"))?
                != self.root
            || !value.is_object()
        {
            return Err(Error("private-credentials-required"));
        }
        let lock_path = self.root.join("credentials.lock");
        if lock_path.exists() {
            private_bytes(&lock_path)?;
        }
        let lock = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .mode(0o600)
            .open(&lock_path)
            .map_err(|_| Error("credentials-unavailable"))?;
        lock.try_lock().map_err(|_| Error("credentials-busy"))?;
        let path = self.root.join(format!("{destination}.json"));
        if Sha256::digest(private_bytes(&path)?).to_vec() != *expected {
            return Err(Error("credentials-changed"));
        }
        let bytes = serde_json::to_vec(&value).map_err(|_| Error("invalid-credentials"))?;
        if bytes.len() > 65536 {
            return Err(Error("invalid-credentials"));
        }
        let temporary = self.root.join(format!(".credentials-{}", Uuid::new_v4()));
        let result = (|| {
            let mut output = OpenOptions::new()
                .write(true)
                .create_new(true)
                .mode(0o600)
                .open(&temporary)
                .map_err(|_| Error("credentials-unavailable"))?;
            output
                .write_all(&bytes)
                .and_then(|_| output.sync_all())
                .map_err(|_| Error("credentials-unavailable"))?;
            fs::rename(&temporary, &path).map_err(|_| Error("credentials-unavailable"))?;
            File::open(&self.root)
                .and_then(|directory| directory.sync_all())
                .map_err(|_| Error("credentials-unavailable"))?;
            Ok(())
        })();
        if temporary.exists() {
            let _ = fs::remove_file(temporary);
        }
        result?;
        self.values.insert(
            destination.to_owned(),
            (value, Sha256::digest(&bytes).to_vec()),
        );
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::fs::PermissionsExt;
    #[test]
    fn atomic_rotation_detects_owner_changes_and_preserves_private_mode() {
        let root = std::env::temp_dir().join(format!("wallpapers-credentials-{}", Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        fs::set_permissions(&root, fs::Permissions::from_mode(0o700)).unwrap();
        let root = fs::canonicalize(root).unwrap();
        let result = std::panic::catch_unwind(|| {
            let path = root.join("tumblr.json");
            fs::write(&path, b"{\"enabled\":true,\"accessToken\":\"old\"}").unwrap();
            fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
            let mut credentials = Credentials::load(&root);
            credentials.replace("tumblr",serde_json::json!({"enabled":true,"accessToken":"new","refreshToken":"rotated"})).unwrap();
            assert_eq!(path.metadata().unwrap().mode() & 0o777, 0o600);
            assert_eq!(
                credentials.get("tumblr").unwrap()["refreshToken"],
                "rotated"
            );
            let owner_lock = File::open(root.join("credentials.lock")).unwrap();
            owner_lock.lock().unwrap();
            assert_eq!(
                credentials
                    .replace("tumblr", serde_json::json!({}))
                    .unwrap_err()
                    .0,
                "credentials-busy"
            );
            fs::write(&path, b"{}").unwrap();
            drop(owner_lock);
            assert_eq!(
                credentials
                    .replace("tumblr", serde_json::json!({}))
                    .unwrap_err()
                    .0,
                "credentials-changed"
            );
            fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap();
            assert!(Credentials::load(&root).configured().is_empty());
        });
        fs::remove_dir_all(root).unwrap();
        result.unwrap();
    }
}
