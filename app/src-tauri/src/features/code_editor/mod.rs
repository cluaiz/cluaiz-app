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

#[cfg(target_os = "windows")]
#[link(name = "ole32")]
extern "system" {
    fn CoInitializeEx(pv_reserved: *mut std::ffi::c_void, dw_co_init: u32) -> i32;
    fn CoUninitialize();
}

#[cfg(target_os = "windows")]
#[link(name = "user32")]
extern "system" {
    fn FindWindowW(lp_class_name: *const u16, lp_window_name: *const u16) -> isize;
    fn SetForegroundWindow(h_wnd: isize) -> i32;
    fn SetWindowPos(h_wnd: isize, h_wnd_insert_after: isize, x: i32, y: i32, cx: i32, cy: i32, u_flags: u32) -> i32;
    fn BringWindowToTop(h_wnd: isize) -> i32;
}

#[tauri::command]
pub async fn pick_folder() -> Result<Option<String>, String> {
    let folder = tokio::task::spawn_blocking(|| {
        #[cfg(target_os = "windows")]
        unsafe {
            // 0x2 = COINIT_APARTMENTTHREADED, 0x4 = COINIT_DISABLE_OLE1DDE
            CoInitializeEx(std::ptr::null_mut(), 0x2 | 0x4);
        }

        #[cfg(target_os = "windows")]
        let _watcher = std::thread::spawn(|| {
            let title: Vec<u16> = "Open Folder\0".encode_utf16().collect();
            for _ in 0..60 {
                std::thread::sleep(std::time::Duration::from_millis(50));
                unsafe {
                    let hwnd = FindWindowW(std::ptr::null(), title.as_ptr());
                    if hwnd != 0 {
                        const HWND_TOPMOST: isize = -1;
                        const HWND_NOTOPMOST: isize = -2;
                        const SWP_NOMOVE: u32 = 0x0002;
                        const SWP_NOSIZE: u32 = 0x0001;
                        const SWP_SHOWWINDOW: u32 = 0x0040;

                        BringWindowToTop(hwnd);
                        SetForegroundWindow(hwnd);
                        SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
                        SetWindowPos(hwnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
                        SetForegroundWindow(hwnd);
                        break;
                    }
                }
            }
        });

        let mut dialog = rfd::FileDialog::new().set_title("Open Folder");
        if let Some(home) = dirs::home_dir() {
            dialog = dialog.set_directory(home);
        }
        let result = dialog.pick_folder();

        #[cfg(target_os = "windows")]
        unsafe {
            CoUninitialize();
        }

        result
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(folder.map(|p| p.to_string_lossy().to_string()))
}
