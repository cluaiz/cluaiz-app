use std::fs;
use std::path::Path;
use std::sync::Mutex;
use base64::Engine;
use serde::{Deserialize, Serialize};
use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher, Event, EventKind};
use tauri::Emitter;

static WATCHER: Mutex<Option<RecommendedWatcher>> = Mutex::new(None);

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FsChangeEvent {
    pub kind: String,
    pub path: String,
    pub is_folder: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DiskItemDto {
    pub path: String,
    pub name: String,
    pub is_folder: bool,
    pub length: u64,
    pub modified: String,
}

#[tauri::command]
pub fn fs_read_file(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    let ext = p.extension().and_then(|s| s.to_str()).unwrap_or("").to_ascii_lowercase();
    let is_binary_ext = matches!(
        ext.as_str(),
        "png" | "jpg" | "jpeg" | "webp" | "gif" | "ico" | "bmp" | "avif" | "pdf" | "woff" | "woff2" | "ttf" | "otf" | "mp4" | "webm" | "mkv" | "mov" | "mp3" | "wav" | "ogg" | "flac" | "aac" | "m4a"
    );

    if is_binary_ext {
        return match fs::read(&path) {
            Ok(bytes) => {
                let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
                Ok(format!("__BASE64__:{}", b64))
            }
            Err(e) => Err(format!("Failed to read {}: {}", path, e)),
        };
    }

    // 1. Fast path: Read UTF-8 code/text files
    match fs::read_to_string(&path) {
        Ok(content) => Ok(content),
        Err(_) => {
            // 2. Binary fallback (for non-utf8 files): return base64
            match fs::read(&path) {
                Ok(bytes) => {
                    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
                    Ok(format!("__BASE64__:{}", b64))
                }
                Err(e) => Err(format!("Failed to read {}: {}", path, e)),
            }
        }
    }
}

#[tauri::command]
pub fn fs_write_file(path: String, content: String) -> Result<(), String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&path, content).map_err(|e| format!("Failed to write {}: {}", path, e))
}

#[tauri::command]
pub fn fs_list_dir(
    dir_path: Option<String>,
    root_path: Option<String>,
    recursive: Option<bool>
) -> Result<Vec<DiskItemDto>, String> {
    let target_dir_str = dir_path.clone().or_else(|| root_path.clone()).unwrap_or_default();
    let dir = Path::new(&target_dir_str);
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let root_str = root_path.as_deref().unwrap_or(&target_dir_str);
    let base_root = Path::new(root_str);

    let mut results = Vec::new();
    let ignored_names = [
        ".git", "node_modules", "target", "dist", "build", ".cache", 
        "$RECYCLE.BIN", "System Volume Information", "AppData", ".vscode", ".idea"
    ];

    let is_recursive = recursive.unwrap_or(false);

    if !is_recursive {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let entry_path = entry.path();
                let file_name = entry.file_name();
                let name = file_name.to_string_lossy();
                if ignored_names.iter().any(|&ig| name.eq_ignore_ascii_case(ig)) {
                    continue;
                }

                let rel_str = if let Ok(rel) = entry_path.strip_prefix(base_root) {
                    rel.to_string_lossy().replace('\\', "/")
                } else {
                    name.to_string()
                };

                let is_dir = entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false);
                let length = if is_dir { 0 } else { entry.metadata().map(|m| m.len()).unwrap_or(0) };
                let modified = entry.metadata()
                    .and_then(|m| m.modified())
                    .ok()
                    .map(|t| format!("{:?}", t))
                    .unwrap_or_default();

                results.push(DiskItemDto {
                    path: rel_str,
                    name: name.to_string(),
                    is_folder: is_dir,
                    length,
                    modified,
                });
            }
        }
        return Ok(results);
    }

    fn walk_dir(
        dir: &Path, 
        root: &Path, 
        results: &mut Vec<DiskItemDto>, 
        ignored: &[&str],
        depth: usize
    ) {
        if depth > 12 { return; }
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let file_name = entry.file_name();
                let name = file_name.to_string_lossy();

                if ignored.iter().any(|&ig| name.eq_ignore_ascii_case(ig)) {
                    continue;
                }

                if let Ok(rel) = path.strip_prefix(root) {
                    let rel_str = rel.to_string_lossy().replace('\\', "/");
                    if rel_str.is_empty() { continue; }

                    let is_dir = entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false);
                    let length = if is_dir { 0 } else { entry.metadata().map(|m| m.len()).unwrap_or(0) };
                    let modified = entry.metadata()
                        .and_then(|m| m.modified())
                        .ok()
                        .map(|t| format!("{:?}", t))
                        .unwrap_or_default();

                    results.push(DiskItemDto {
                        path: rel_str,
                        name: name.to_string(),
                        is_folder: is_dir,
                        length,
                        modified,
                    });

                    if is_dir {
                        walk_dir(&path, root, results, ignored, depth + 1);
                    }
                }
            }
        }
    }

    walk_dir(dir, base_root, &mut results, &ignored_names, 0);
    Ok(results)
}

#[tauri::command]
pub fn fs_delete_path(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Ok(());
    }
    if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| format!("Failed to delete folder {}: {}", path, e))
    } else {
        fs::remove_file(p).map_err(|e| format!("Failed to delete file {}: {}", path, e))
    }
}

#[tauri::command]
pub fn fs_rename_path(old_path: String, new_path: String) -> Result<(), String> {
    let src = Path::new(&old_path);
    let dest = Path::new(&new_path);
    if let Some(parent) = dest.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::rename(src, dest).map_err(|e| format!("Failed to rename {} to {}: {}", old_path, new_path, e))
}

#[tauri::command]
pub fn fs_copy_path(src_path: String, dest_path: String) -> Result<(), String> {
    let src = Path::new(&src_path);
    let dest = Path::new(&dest_path);
    if let Some(parent) = dest.parent() {
        let _ = fs::create_dir_all(parent);
    }

    if src.is_dir() {
        fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
            fs::create_dir_all(dst)?;
            for entry in fs::read_dir(src)? {
                let entry = entry?;
                let ty = entry.file_type()?;
                if ty.is_dir() {
                    copy_dir_all(&entry.path(), &dst.join(entry.file_name()))?;
                } else {
                    fs::copy(entry.path(), dst.join(entry.file_name()))?;
                }
            }
            Ok(())
        }
        copy_dir_all(src, dest).map_err(|e| format!("Failed to copy folder {}: {}", src_path, e))
    } else {
        fs::copy(src, dest)
            .map(|_| ())
            .map_err(|e| format!("Failed to copy file {}: {}", src_path, e))
    }
}

#[tauri::command]
pub fn fs_create_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| format!("Failed to create dir {}: {}", path, e))
}

#[tauri::command]
pub fn start_fs_watcher(app_handle: tauri::AppHandle, root_path: String) -> Result<(), String> {
    let mut lock = WATCHER.lock().map_err(|e| e.to_string())?;
    *lock = None;

    let root = Path::new(&root_path).to_path_buf();
    if !root.exists() {
        return Ok(());
    }

    let root_clone = root.clone();
    let app = app_handle.clone();

    let mut watcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                let kind_str = match event.kind {
                    EventKind::Create(_) => "create",
                    EventKind::Modify(_) => "modify",
                    EventKind::Remove(_) => "remove",
                    _ => return,
                };

                let ignored = [
                    ".git", "node_modules", "target", "dist", "build", ".cache",
                    "$RECYCLE.BIN", "System Volume Information", "AppData", ".vscode", ".idea"
                ];

                for path in event.paths {
                    let is_ignored = path.iter().any(|seg| {
                        let s = seg.to_string_lossy();
                        ignored.iter().any(|&ig| s.eq_ignore_ascii_case(ig))
                    });
                    if is_ignored {
                        continue;
                    }

                    if let Ok(rel) = path.strip_prefix(&root_clone) {
                        let rel_str = rel.to_string_lossy().replace('\\', "/");
                        if rel_str.is_empty() {
                            continue;
                        }

                        let is_dir = path.is_dir();
                        let payload = FsChangeEvent {
                            kind: kind_str.to_string(),
                            path: rel_str,
                            is_folder: is_dir,
                        };

                        let _ = app.emit("fs:change", payload);
                    }
                }
            }
        },
        Config::default(),
    ).map_err(|e| format!("Failed to create watcher: {}", e))?;

    watcher.watch(&root, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch {}: {}", root_path, e))?;

    *lock = Some(watcher);
    Ok(())
}

#[tauri::command]
pub fn stop_fs_watcher() -> Result<(), String> {
    if let Ok(mut lock) = WATCHER.lock() {
        *lock = None;
    }
    Ok(())
}

