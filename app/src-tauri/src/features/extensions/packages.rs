//! Main-host package persistence. Shared App admission validates archives;
//! callers cannot select filesystem paths or a guest identity.
use super::surfaces::{HOST_VIEW, MAX_DOCUMENT_BYTES};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs::{self, File, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};
use tauri::Manager;

const MAX_PACKAGES: usize = 128;
const MAX_CATALOG_BYTES: u64 = 1024 * 1024;
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PackageRecord {
    id: String,
    name: String,
    version: String,
    package_hash: String,
    document_hash: String,
    revision: String,
    grants: Vec<String>,
    enabled: bool,
    installed_at: u64,
    updated_at: u64,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct StoredPackage {
    record: PackageRecord,
    html: String,
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Catalog {
    schema_version: u8,
    records: BTreeMap<String, PackageRecord>,
}
fn valid_id(id: &str) -> bool {
    let parts: Vec<_> = id.split('.').collect();
    id.len() <= 120
        && parts.len() == 2
        && parts.iter().all(|part| {
            part.as_bytes().first().is_some_and(u8::is_ascii_lowercase)
                && part.split('-').all(|piece| {
                    !piece.is_empty()
                        && piece
                            .bytes()
                            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
                })
        })
}
fn valid_hash(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn validate_record(value: &PackageRecord) -> Result<(), String> {
    if !valid_id(&value.id)
        || value.name.trim().is_empty()
        || value.name.len() > 480
        || value.version.is_empty()
        || value.version.len() > 60
        || !value
            .version
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b".+-".contains(&byte))
        || !valid_hash(&value.package_hash)
        || !valid_hash(&value.document_hash)
        || uuid::Uuid::parse_str(&value.revision).is_err()
        || value.installed_at == 0
        || value.updated_at == 0
        || value.grants.len() > 64
        || value
            .grants
            .iter()
            .any(|cap| cap.is_empty() || cap.len() > 120)
        || value
            .grants
            .iter()
            .enumerate()
            .any(|(index, cap)| value.grants[..index].contains(cap))
    {
        return Err("Invalid installed extension receipt".into());
    }
    Ok(())
}
fn directory(path: &Path) -> Result<PathBuf, String> {
    if fs::symlink_metadata(path).is_ok_and(|meta| meta.file_type().is_symlink()) {
        return Err("Extension storage cannot be a link".into());
    }
    fs::create_dir_all(path).map_err(|error| error.to_string())?;
    path.canonicalize().map_err(|error| error.to_string())
}
fn owned_file(parent: &Path, name: &str) -> Result<PathBuf, String> {
    let path = parent.join(name);
    match fs::symlink_metadata(&path) {
        Ok(meta) => {
            if !meta.is_file() || meta.file_type().is_symlink() {
                return Err("Extension storage file is not a regular file".into());
            }
            if path
                .canonicalize()
                .map_err(|error| error.to_string())?
                .parent()
                != Some(parent)
            {
                return Err("Extension storage path escaped its owner".into());
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(error.to_string()),
    }
    Ok(path)
}
struct Store {
    root: PathBuf,
    documents: PathBuf,
    _lock: File,
}
impl Store {
    fn lock(root: &Path) -> Result<Self, String> {
        let root = directory(root)?;
        let documents = directory(&root.join("documents"))?;
        if documents.parent() != Some(root.as_path()) {
            return Err("Invalid extension documents directory".into());
        }
        let lock = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(owned_file(&root, "catalog.lock")?)
            .map_err(|error| error.to_string())?;
        lock.try_lock()
            .map_err(|error| format!("Extension storage is busy or unavailable: {error}"))?;
        Ok(Self {
            root,
            documents,
            _lock: lock,
        })
    }
    fn catalog(&self) -> Result<Catalog, String> {
        let path = owned_file(&self.root, "catalog.json")?;
        if !path.exists() {
            return Ok(Catalog {
                schema_version: 1,
                records: BTreeMap::new(),
            });
        }
        if fs::metadata(&path)
            .map_err(|error| error.to_string())?
            .len()
            > MAX_CATALOG_BYTES
        {
            return Err("Extension catalog is too large".into());
        }
        let catalog: Catalog =
            serde_json::from_slice(&fs::read(path).map_err(|error| error.to_string())?)
                .map_err(|error| format!("Installed extension catalog is invalid: {error}"))?;
        if catalog.schema_version != 1 || catalog.records.len() > MAX_PACKAGES {
            return Err("Unsupported extension catalog".into());
        }
        for (id, record) in &catalog.records {
            validate_record(record)?;
            if id != &record.id {
                return Err("Extension catalog identity mismatch".into());
            }
        }
        Ok(catalog)
    }
    fn document(&self, digest: &str) -> Result<String, String> {
        if !valid_hash(digest) {
            return Err("Invalid document digest".into());
        }
        let path = owned_file(&self.documents, &format!("{digest}.html"))?;
        if fs::metadata(&path)
            .map_err(|error| error.to_string())?
            .len()
            > MAX_DOCUMENT_BYTES as u64
        {
            return Err("Installed document is too large".into());
        }
        let html = fs::read_to_string(path).map_err(|error| error.to_string())?;
        if hash(html.as_bytes()) != digest {
            return Err("Installed extension integrity check failed".into());
        }
        Ok(html)
    }
    fn read(&self, id: &str) -> Result<Option<StoredPackage>, String> {
        if !valid_id(id) {
            return Err("Invalid extension ID".into());
        }
        self.catalog()?
            .records
            .get(id)
            .map(|record| {
                Ok(StoredPackage {
                    record: record.clone(),
                    html: self.document(&record.document_hash)?,
                })
            })
            .transpose()
    }
    fn commit(
        &self,
        id: &str,
        expected: Option<&str>,
        next: Option<StoredPackage>,
    ) -> Result<(), String> {
        if !valid_id(id) {
            return Err("Invalid extension ID".into());
        }
        let mut catalog = self.catalog()?;
        let current = catalog.records.get(id).cloned();
        if current.as_ref().map(|record| record.revision.as_str()) != expected {
            return Err(
                "Extension changed in another operation. Refresh before trying again.".into(),
            );
        }
        if let Some(value) = next {
            validate_record(&value.record)?;
            if value.record.id != id
                || value.html.is_empty()
                || value.html.len() > MAX_DOCUMENT_BYTES
                || hash(value.html.as_bytes()) != value.record.document_hash
            {
                return Err("Extension document/receipt mismatch".into());
            }
            if current.is_none() && catalog.records.len() >= MAX_PACKAGES {
                return Err("Installed extension limit reached".into());
            }
            let path = owned_file(
                &self.documents,
                &format!("{}.html", value.record.document_hash),
            )?;
            if path.exists() {
                self.document(&value.record.document_hash)?;
            } else {
                atomic_write(&path, value.html.as_bytes())?;
            }
            catalog.records.insert(id.to_string(), value.record);
        } else {
            catalog.records.remove(id);
        }
        let encoded = serde_json::to_vec(&catalog).map_err(|error| error.to_string())?;
        if encoded.len() as u64 > MAX_CATALOG_BYTES {
            return Err("Extension catalog limit reached".into());
        }
        atomic_write(&owned_file(&self.root, "catalog.json")?, &encoded)?;
        if let Some(old) = current {
            if !catalog
                .records
                .values()
                .any(|record| record.document_hash == old.document_hash)
            {
                // The catalog already revokes activation. A locked file is retained
                // for later cleanup; never turn this into a recursive delete.
                let cleanup = owned_file(&self.documents, &format!("{}.html", old.document_hash))
                    .and_then(|path| fs::remove_file(path).map_err(|error| error.to_string()));
                if let Err(error) = cleanup {
                    eprintln!("Unreferenced extension document retained: {error}");
                }
            }
        }
        Ok(())
    }
}
fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or("Extension output parent is missing")?;
    let temporary = parent.join(format!("stage-{}", uuid::Uuid::new_v4()));
    let result = (|| {
        let mut file = File::create_new(&temporary).map_err(|error| error.to_string())?;
        file.write_all(bytes)
            .and_then(|_| file.sync_all())
            .map_err(|error| error.to_string())?;
        drop(file);
        fs::rename(&temporary, path).map_err(|error| error.to_string())
    })();
    if result.is_err() {
        let _ = fs::remove_file(temporary);
    }
    result
}
fn root(app: &tauri::AppHandle, caller: &tauri::Webview) -> Result<PathBuf, String> {
    if caller.label() != HOST_VIEW {
        return Err("Only the main App can manage installed extensions".into());
    }
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("extension-packages"))
}
#[tauri::command]
pub async fn extension_packages_list(
    app: tauri::AppHandle,
    webview: tauri::Webview,
) -> Result<Vec<PackageRecord>, String> {
    let root = root(&app, &webview)?;
    tokio::task::spawn_blocking(move || {
        Ok(Store::lock(&root)?
            .catalog()?
            .records
            .into_values()
            .collect())
    })
    .await
    .map_err(|error| error.to_string())?
}
#[tauri::command]
pub async fn extension_package_read(
    app: tauri::AppHandle,
    webview: tauri::Webview,
    id: String,
) -> Result<Option<StoredPackage>, String> {
    let root = root(&app, &webview)?;
    tokio::task::spawn_blocking(move || Store::lock(&root)?.read(&id))
        .await
        .map_err(|error| error.to_string())?
}
#[tauri::command]
pub async fn extension_package_commit(
    app: tauri::AppHandle,
    webview: tauri::Webview,
    id: String,
    expected: Option<String>,
    next: Option<StoredPackage>,
) -> Result<(), String> {
    let root = root(&app, &webview)?;
    tokio::task::spawn_blocking(move || Store::lock(&root)?.commit(&id, expected.as_deref(), next))
        .await
        .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            Self(std::env::temp_dir().join(format!("cluaiz-package-test-{}", uuid::Uuid::new_v4())))
        }
        fn store(&self) -> Store {
            Store::lock(&self.0).unwrap()
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            // Only this UUID-named test root is recursively removed.
            if self.0.parent() == Some(std::env::temp_dir().as_path())
                && self
                    .0
                    .file_name()
                    .unwrap()
                    .to_string_lossy()
                    .starts_with("cluaiz-package-test-")
            {
                let _ = fs::remove_dir_all(&self.0);
            }
        }
    }
    fn package(version: &str) -> StoredPackage {
        let html = format!("<!doctype html><title>Storage fixture {version}</title>");
        StoredPackage {
            record: PackageRecord {
                id: "fixture.storage".into(),
                name: "Storage test".into(),
                version: version.into(),
                package_hash: hash(b"owned-test-archive"),
                document_hash: hash(html.as_bytes()),
                revision: uuid::Uuid::new_v4().to_string(),
                grants: vec!["storage.read".into()],
                enabled: true,
                installed_at: 1,
                updated_at: 2,
            },
            html,
        }
    }
    #[test]
    fn install_reopen_update_conflict_and_uninstall() {
        let fixture = Fixture::new();
        let first = package("1.0.0");
        let second = package("1.1.0");
        fixture
            .store()
            .commit(&first.record.id, None, Some(first.clone()))
            .unwrap();
        assert_eq!(
            fixture
                .store()
                .read(&first.record.id)
                .unwrap()
                .unwrap()
                .record,
            first.record
        );
        let store = fixture.store();
        assert!(store
            .commit(&first.record.id, None, Some(second.clone()))
            .is_err());
        store
            .commit(
                &first.record.id,
                Some(&first.record.revision),
                Some(second.clone()),
            )
            .unwrap();
        assert!(!store
            .documents
            .join(format!("{}.html", first.record.document_hash))
            .exists());
        assert_eq!(
            store.read(&first.record.id).unwrap().unwrap().html,
            second.html
        );
        store
            .commit(&first.record.id, Some(&second.record.revision), None)
            .unwrap();
        assert!(store.read(&first.record.id).unwrap().is_none());
        assert!(!store
            .documents
            .join(format!("{}.html", second.record.document_hash))
            .exists());
    }
    #[test]
    fn failed_update_keeps_prior_catalog_and_document() {
        let fixture = Fixture::new();
        let store = fixture.store();
        let first = package("1.0.0");
        let second = package("1.1.0");
        store
            .commit(&first.record.id, None, Some(first.clone()))
            .unwrap();
        let before = fs::read(store.root.join("catalog.json")).unwrap();
        fs::create_dir(
            store
                .documents
                .join(format!("{}.html", second.record.document_hash)),
        )
        .unwrap();
        assert!(store
            .commit(&first.record.id, Some(&first.record.revision), Some(second))
            .is_err());
        assert_eq!(before, fs::read(store.root.join("catalog.json")).unwrap());
        assert_eq!(
            store.read(&first.record.id).unwrap().unwrap().html,
            first.html
        );
    }
    #[test]
    fn corrupt_data_and_untrusted_paths_are_refused() {
        let fixture = Fixture::new();
        let store = fixture.store();
        let mut value = package("1.0.0");
        value.html.push_str("tampered");
        assert!(store
            .commit(&value.record.id, None, Some(value.clone()))
            .is_err());
        assert!(store.read("../outside").is_err());
        assert!(store.commit("../outside", None, None).is_err());
        fs::write(store.root.join("catalog.json"), "invalid-json").unwrap();
        assert!(store.catalog().is_err());
        assert!(store.commit("fixture.storage", None, None).is_err());
        assert_eq!(
            fs::read_to_string(store.root.join("catalog.json")).unwrap(),
            "invalid-json"
        );
    }
    #[test]
    fn simultaneous_catalog_writer_is_refused() {
        let fixture = Fixture::new();
        let first = fixture.store();
        assert!(Store::lock(&fixture.0).is_err());
        drop(first);
        assert!(Store::lock(&fixture.0).is_ok());
    }
    #[test]
    fn document_tampering_is_detected_after_reopen() {
        let fixture = Fixture::new();
        let value = package("1.0.0");
        {
            let store = fixture.store();
            store
                .commit(&value.record.id, None, Some(value.clone()))
                .unwrap();
            fs::write(
                store
                    .documents
                    .join(format!("{}.html", value.record.document_hash)),
                "tampered",
            )
            .unwrap();
        }
        assert!(fixture
            .store()
            .read(&value.record.id)
            .unwrap_err()
            .contains("integrity"));
    }
}
