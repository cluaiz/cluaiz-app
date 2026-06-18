use tauri::State;
use std::io::Write;
use crate::core::state::EngineState;

#[tauri::command]
pub async fn ffi_send_message(state: State<'_, EngineState>, message: String) -> Result<(), String> {
    println!("⚡ [FFI] Writing to IPC Pipe: {}", message);
    
    #[cfg(windows)]
    {
        use tokio::io::AsyncWriteExt;
        let mut tx_lock = state.pipe_tx.lock().await;
        if let Some(tx) = tx_lock.as_mut() {
            let payload = format!("{}\n", message);
            if let Err(e) = tx.write_all(payload.as_bytes()).await {
                return Err(format!("Failed to write to engine IPC: {}", e));
            }
            Ok(())
        } else {
            Err("Engine IPC is not booted!".into())
        }
    }
    
    #[cfg(not(windows))]
    Err("Named Pipes are only supported on Windows".into())
}

#[tauri::command]
pub async fn ffi_fetch_history(state: State<'_, EngineState>) -> Result<String, String> {
    println!("⚡ [FFI] Fetching chat history via CDQL...");
    // For now, return an empty JSON array until the engine's CDQL parser is ready to return history.
    Ok("[]".to_string())
}

#[tauri::command]
pub async fn ffi_delete_session(state: State<'_, EngineState>, session_id: String) -> Result<(), String> {
    println!("⚡ [FFI] Deleting session {} via CDQL IPC...", session_id);
    
    #[cfg(windows)]
    {
        use tokio::io::AsyncWriteExt;
        let mut tx_lock = state.pipe_tx.lock().await;
        if let Some(tx) = tx_lock.as_mut() {
            // Note: FFI bridge expects JSON payload for MODEL_RM etc, or custom CDQL
            let payload = format!("//CDQL_DELETE_SESSION {}\n", session_id);
            if let Err(e) = tx.write_all(payload.as_bytes()).await {
                return Err(format!("Failed to write to engine IPC: {}", e));
            }
            Ok(())
        } else {
            Err("Engine IPC is not booted!".into())
        }
    }

    #[cfg(not(windows))]
    Err("Named Pipes are only supported on Windows".into())
}
