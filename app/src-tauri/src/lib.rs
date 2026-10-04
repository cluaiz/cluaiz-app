pub mod core;
pub mod features;

use core::engine::spawner::{boot_cluaiz_engine, update_engine_settings, get_session_token};
use core::state::EngineState;
use features::chat::commands::{ffi_delete_session, ffi_fetch_history, ffi_send_message};
use features::code_editor::{start_fs_watcher, stop_fs_watcher, pick_folder};
use tauri::Manager;

async fn start_local_bridge() {
    let port: u16 = std::env::var("CLUAIZ_BRIDGE_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or_else(|| {
            let content = include_str!("../../../src/api/app/native/native.endpoints.ts");
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("export const DEFAULT_BRIDGE_PORT") {
                    if let Some(val_str) = trimmed.split('=').nth(1) {
                        let clean = val_str.trim().trim_end_matches(';').trim();
                        if let Ok(p) = clean.parse::<u16>() {
                            return p;
                        }
                    }
                }
            }
            1421
        });

    let bind_addr = format!("0.0.0.0:{}", port);
    let listener = match tokio::net::TcpListener::bind(&bind_addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("[LocalBridge] Port bind notice on {}: {}", bind_addr, e);
            return;
        }
    };
    println!("[LocalBridge] Local HTTP Bridge active on port {} (0.0.0.0: accepts localhost, LAN IP, and domain)", port);

    loop {
        let (mut socket, _) = match listener.accept().await {
            Ok(s) => s,
            Err(_) => continue,
        };

        tokio::spawn(async move {
            use tokio::io::{AsyncReadExt, AsyncWriteExt};
            let mut buf = [0u8; 2048];
            let n = match socket.read(&mut buf).await {
                Ok(n) if n > 0 => n,
                _ => return,
            };
            let req = String::from_utf8_lossy(&buf[..n]);

            // Handle CORS preflight
            if req.starts_with("OPTIONS") {
                let response = "HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: *\r\n\r\n";
                let _ = socket.write_all(response.as_bytes()).await;
                return;
            }

            if req.contains("/api/pick-folder") || req.contains("/api/pick_folder") {
                let folder_res = features::code_editor::pick_folder().await;
                let (status, path_val) = match folder_res {
                    Ok(Some(path)) => ("success", Some(path)),
                    Ok(None) => ("cancelled", None),
                    Err(e) => ("error", Some(e)),
                };
                let json = serde_json::json!({
                    "status": status,
                    "path": path_val
                }).to_string();

                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: *\r\nContent-Length: {}\r\n\r\n{}",
                    json.len(),
                    json
                );
                let _ = socket.write_all(response.as_bytes()).await;
            } else {
                let response = "HTTP/1.1 404 Not Found\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: 0\r\n\r\n";
                let _ = socket.write_all(response.as_bytes()).await;
            }
        });
    }
}

#[allow(dependency_on_unit_never_type_fallback)]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(EngineState::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_session_token,
            boot_cluaiz_engine,
            update_engine_settings,
            ffi_send_message,
            ffi_fetch_history,
            ffi_delete_session,
            start_fs_watcher,
            stop_fs_watcher,
            pick_folder
        ])
        .setup(|_app| {
            tauri::async_runtime::spawn(async move {
                start_local_bridge().await;
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| match event {
            tauri::RunEvent::Exit => {
                let state = app_handle.state::<EngineState>();
                if let Ok(mut child_lock) = state.inner().child_process.lock() {
                    if let Some(mut child) = child_lock.take() {
                        println!("Tauri App Exiting: Killing Cluaiz Engine...");
                        let _ = child.kill();
                    }
                }
            }
            _ => {}
        });
}
