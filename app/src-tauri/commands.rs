// One command inventory feeds both native dispatch and application permissions.
macro_rules! app_commands {
    ($consumer:ident) => {
        $consumer! {
            main [
                engine_native_start, engine_native_head, engine_native_read, engine_native_cancel,
                get_session_token, boot_cluaiz_engine, update_engine_settings,
                ffi_send_message, ffi_fetch_history, ffi_delete_session,
                start_fs_watcher, stop_fs_watcher, pick_folder,
                storage_load_sessions_index, storage_save_sessions_index,
                storage_load_session_metadata, storage_save_session_metadata,
                storage_load_session_messages, storage_append_message,
                storage_save_session_messages, storage_delete_session,
                storage_save_asset, storage_resolve_asset_path,
                extension_surface_open, extension_surface_resize, extension_surface_close,
                extension_host_message,
                extension_packages_list, extension_package_read, extension_package_commit,
                desktop_lifecycle_status, desktop_set_background, desktop_show_main, desktop_quit
            ]
            guest [extension_guest_message]
        }
    };
}
