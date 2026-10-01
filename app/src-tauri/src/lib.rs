pub mod core;
pub mod features;

use core::engine::spawner::{boot_cluaiz_engine, update_engine_settings};
use core::state::EngineState;
use features::chat::commands::{ffi_delete_session, ffi_fetch_history, ffi_send_message};
use features::code_editor::{
    fs_read_file, fs_write_file, fs_list_dir, fs_delete_path, fs_rename_path, fs_copy_path, fs_create_dir,
    start_fs_watcher, stop_fs_watcher
};
use tauri::Manager;

#[allow(dependency_on_unit_never_type_fallback)]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(EngineState::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            boot_cluaiz_engine,
            update_engine_settings,
            ffi_send_message,
            ffi_fetch_history,
            ffi_delete_session,
            fs_read_file,
            fs_write_file,
            fs_list_dir,
            fs_delete_path,
            fs_rename_path,
            fs_copy_path,
            fs_create_dir,
            start_fs_watcher,
            stop_fs_watcher
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| match event {
            tauri::RunEvent::Exit => {
                let state = app_handle.state::<EngineState>();
                if let Ok(mut child_lock) = state.inner().child_process.lock() {
                    if let Some(mut child) = child_lock.take() {
                        println!("🛑 Tauri App Exiting: Killing cluaiz Engine...");
                        let _ = child.kill();
                    }
                }
            }
            _ => {}
        });
}

// Forced rebuild to apply capabilities 2
