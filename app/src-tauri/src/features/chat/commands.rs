//! Legacy names; real chat requests use the shared native API transport.
#[tauri::command]
pub async fn ffi_send_message(message: String) -> Result<(), String> {
    let _ = message;
    Err("Legacy raw-pipe chat is unsupported. Use the chat completion API through native transport.".into())
}
#[tauri::command]
pub async fn ffi_fetch_history() -> Result<String, String> {
    super::storage::storage_load_sessions_index().await
}
#[tauri::command]
pub async fn ffi_delete_session(session_id: String) -> Result<(), String> {
    super::storage::storage_delete_session(session_id).await
}
