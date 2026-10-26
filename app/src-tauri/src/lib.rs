pub mod core;
pub mod features;
include!("../commands.rs");

use core::engine::native::{
    engine_native_cancel, engine_native_head, engine_native_read, engine_native_start,
    requests::NativeRequests,
};
use core::engine::spawner::{boot_cluaiz_engine, get_session_token, update_engine_settings};
use core::state::EngineState;
use features::chat::commands::{ffi_delete_session, ffi_fetch_history, ffi_send_message};
use features::chat::storage::{
    storage_append_message, storage_delete_session, storage_load_session_messages,
    storage_load_session_metadata, storage_load_sessions_index, storage_resolve_asset_path,
    storage_save_asset, storage_save_session_messages, storage_save_session_metadata,
    storage_save_sessions_index,
};
use features::code_editor::{pick_folder, start_fs_watcher, stop_fs_watcher};
use features::extensions::{
    extension_guest_message, extension_host_message, extension_surface_close,
    extension_surface_open, extension_surface_resize,
    extension_packages_list, extension_package_read, extension_package_commit,
};
use tauri::Manager;
use features::desktop_lifecycle::{desktop_lifecycle_status, desktop_set_background, desktop_show_main, desktop_quit};

macro_rules! native_handler {
    (main [$($main:ident),*] guest [$($guest:ident),*]) => {
        tauri::generate_handler![$($main),*, $($guest),*]
    };
}

#[allow(dependency_on_unit_never_type_fallback)]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    features::desktop_lifecycle::configure(features::extensions::configure(tauri::Builder::default()))
        .manage(EngineState::default())
        .manage(NativeRequests::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(app_commands!(native_handler))
        .setup(|app| { features::desktop_lifecycle::setup(app.handle()); Ok(()) })
        .on_window_event(|window, event| {
            features::desktop_lifecycle::window_event(window, event);
            if matches!(event, tauri::WindowEvent::Destroyed) {
                features::extensions::window_destroyed(window.app_handle(), window.label());
                window
                    .state::<NativeRequests>()
                    .cancel_owner(window.label());
            }
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
                        let _ = child.wait();
                    }
                }
            }
            _ => {}
        });
}
