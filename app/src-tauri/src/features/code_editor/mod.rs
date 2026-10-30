use std::path::Path;
use std::sync::Mutex;
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

                for path in event.paths {
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

#[tauri::command]
pub async fn pick_folder(window: tauri::Window) -> Result<Option<String>, String> {
    let folder = tokio::task::spawn_blocking(move || {
        // Own the invoking window until the modal dialog closes. Windows can then
        // keep the picker above its owner without title searches or focus polling.
        // rfd initializes and releases the platform dialog runtime on this thread.
        let mut dialog = rfd::FileDialog::new()
            .set_parent(&window)
            .set_title("Open Folder");
        if let Some(home) = dirs::home_dir() {
            dialog = dialog.set_directory(home);
        }
        dialog.pick_folder()
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(folder.map(|p| p.to_string_lossy().to_string()))
}
