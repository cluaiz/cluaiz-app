use std::path::{Path, PathBuf};
use tokio::fs::{self, OpenOptions};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

/// Dynamically locates the root storage directory for Cluaiz chat data.
/// Resolves cross-platform using `dirs::data_dir()` with fallback to `dirs::home_dir()`.
fn get_storage_root() -> Result<PathBuf, String> {
    let base = dirs::data_dir()
        .or_else(dirs::home_dir)
        .ok_or_else(|| "Could not locate standard data or home directory".to_string())?;
    Ok(base.join("cluaiz").join("data"))
}

/// Enforces strict session ID validation to completely eliminate directory traversal risks (e.g., `../../`).
fn validate_session_id(session_id: &str) -> Result<(), String> {
    let trimmed = session_id.trim();
    if trimmed.is_empty() || trimmed.len() > 128 {
        return Err("Invalid session ID length".to_string());
    }
    if !trimmed.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err(format!("Session ID '{}' contains disallowed characters", trimmed));
    }
    Ok(())
}

/// Sanitizes file names for stored binary assets (images, audio, docs).
fn sanitize_file_name(file_name: &str) -> Result<String, String> {
    let path = Path::new(file_name);
    let clean = path
        .file_name()
        .and_then(|f| f.to_str())
        .ok_or_else(|| "Invalid asset file name".to_string())?;

    if clean.is_empty() || clean.contains("..") {
        return Err("Unsafe asset file name detected".to_string());
    }
    Ok(clean.to_string())
}

/// Loads the sessions catalog cache. If missing or corrupted, automatically triggers
/// a self-healing rebuild by scanning session folders on disk.
#[tauri::command]
pub async fn storage_load_sessions_index() -> Result<String, String> {
    let root = get_storage_root()?;
    let index_path = root.join("sessions_index.json");

    if index_path.exists() {
        match fs::read_to_string(&index_path).await {
            Ok(content) => {
                if let Ok(_) = serde_json::from_str::<serde_json::Value>(&content) {
                    return Ok(content);
                } else {
                    eprintln!("⚠️ [Storage] sessions_index.json is malformed. Triggering self-healing rebuild...");
                }
            }
            Err(e) => {
                eprintln!("⚠️ [Storage] Failed reading sessions_index.json: {}. Triggering rebuild...", e);
            }
        }
    }

    // Rebuild index from folders
    rebuild_index_internal(&root).await
}

/// Atomically saves the sessions catalog index via temporary file + atomic rename.
#[tauri::command]
pub async fn storage_save_sessions_index(index_json: String) -> Result<(), String> {
    let root = get_storage_root()?;
    fs::create_dir_all(&root).await.map_err(|e| e.to_string())?;

    let index_path = root.join("sessions_index.json");
    let temp_path = root.join("sessions_index.json.tmp");

    // Write to temporary file first
    let mut file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&temp_path)
        .await
        .map_err(|e| format!("Failed to create temp index file: {}", e))?;

    file.write_all(index_json.as_bytes())
        .await
        .map_err(|e| format!("Failed to write temp index: {}", e))?;
    file.sync_all()
        .await
        .map_err(|e| format!("Failed to sync temp index: {}", e))?;
    drop(file);

    // Atomic replacement
    fs::rename(&temp_path, &index_path)
        .await
        .map_err(|e| format!("Failed to atomically rename index: {}", e))?;

    Ok(())
}

/// Loads individual session metadata.
#[tauri::command]
pub async fn storage_load_session_metadata(session_id: String) -> Result<String, String> {
    validate_session_id(&session_id)?;
    let root = get_storage_root()?;
    let meta_path = root.join("sessions").join(&session_id).join("session.json");

    if !meta_path.exists() {
        return Ok("".to_string());
    }

    fs::read_to_string(meta_path).await.map_err(|e| e.to_string())
}

/// Saves individual session metadata atomically.
#[tauri::command]
pub async fn storage_save_session_metadata(session_id: String, metadata_json: String) -> Result<(), String> {
    validate_session_id(&session_id)?;
    let root = get_storage_root()?;
    let session_dir = root.join("sessions").join(&session_id);
    fs::create_dir_all(&session_dir).await.map_err(|e| e.to_string())?;

    let meta_path = session_dir.join("session.json");
    let temp_path = session_dir.join("session.json.tmp");

    fs::write(&temp_path, metadata_json.as_bytes())
        .await
        .map_err(|e| format!("Failed writing metadata temp: {}", e))?;
    fs::rename(&temp_path, &meta_path)
        .await
        .map_err(|e| format!("Failed renaming metadata: {}", e))?;

    Ok(())
}

/// Loads messages from messages.jsonl.
/// Guarantees safe recovery from partial or corrupted tail lines (e.g. from sudden power-loss).
#[tauri::command]
pub async fn storage_load_session_messages(
    session_id: String,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<String>, String> {
    validate_session_id(&session_id)?;
    let root = get_storage_root()?;
    let jsonl_path = root.join("sessions").join(&session_id).join("messages.jsonl");

    if !jsonl_path.exists() {
        return Ok(Vec::new());
    }

    let file = fs::File::open(&jsonl_path)
        .await
        .map_err(|e| format!("Failed to open messages.jsonl: {}", e))?;
    let reader = BufReader::new(file);
    let mut lines = reader.lines();

    let mut valid_messages = Vec::new();
    let mut line_num = 0;

    while let Some(line) = lines.next_line().await.map_err(|e| e.to_string())? {
        line_num += 1;
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        // Safe tail recovery: discard incomplete or corrupt JSON without failing
        match serde_json::from_str::<serde_json::Value>(trimmed) {
            Ok(_) => {
                valid_messages.push(trimmed.to_string());
            }
            Err(parse_err) => {
                eprintln!(
                    "⚠️ [Storage Safe Recovery] Discarding malformed line {} in session '{}': {}",
                    line_num, session_id, parse_err
                );
            }
        }
    }

    // Apply offset and limit if specified
    let start = offset.unwrap_or(0);
    if start >= valid_messages.len() {
        return Ok(Vec::new());
    }

    let end = if let Some(lim) = limit {
        std::cmp::min(start + lim, valid_messages.len())
    } else {
        valid_messages.len()
    };

    Ok(valid_messages[start..end].to_vec())
}

/// Appends an atomic completed message turn to messages.jsonl.
#[tauri::command]
pub async fn storage_append_message(session_id: String, message_json: String) -> Result<(), String> {
    validate_session_id(&session_id)?;
    let root = get_storage_root()?;
    let session_dir = root.join("sessions").join(&session_id);
    fs::create_dir_all(&session_dir).await.map_err(|e| e.to_string())?;

    let jsonl_path = session_dir.join("messages.jsonl");
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&jsonl_path)
        .await
        .map_err(|e| format!("Failed to open messages.jsonl for appending: {}", e))?;

    let payload = format!("{}\n", message_json.trim());
    file.write_all(payload.as_bytes())
        .await
        .map_err(|e| format!("Failed to append message: {}", e))?;
    file.flush()
        .await
        .map_err(|e| format!("Failed to flush message: {}", e))?;

    Ok(())
}

/// Atomically overwrites messages.jsonl with a complete updated list of messages.
/// Used when messages are modified in-place (reactions, stars, pins, deletions).
#[tauri::command]
pub async fn storage_save_session_messages(session_id: String, messages_jsonl: String) -> Result<(), String> {
    validate_session_id(&session_id)?;
    let root = get_storage_root()?;
    let session_dir = root.join("sessions").join(&session_id);
    fs::create_dir_all(&session_dir).await.map_err(|e| e.to_string())?;

    let jsonl_path = session_dir.join("messages.jsonl");
    let temp_path = session_dir.join("messages.jsonl.tmp");

    fs::write(&temp_path, messages_jsonl.as_bytes())
        .await
        .map_err(|e| format!("Failed to write temp messages.jsonl: {}", e))?;

    fs::rename(&temp_path, &jsonl_path)
        .await
        .map_err(|e| format!("Failed to atomically rename messages.jsonl: {}", e))?;

    Ok(())
}

/// Deletes a session directory and all its stored messages and binary assets.
#[tauri::command]
pub async fn storage_delete_session(session_id: String) -> Result<(), String> {
    validate_session_id(&session_id)?;
    let root = get_storage_root()?;
    let session_dir = root.join("sessions").join(&session_id);

    if session_dir.exists() {
        fs::remove_dir_all(&session_dir)
            .await
            .map_err(|e| format!("Failed to delete session directory: {}", e))?;
    }

    Ok(())
}

/// Saves raw binary asset bytes directly to the session's assets/ directory.
/// Returns the relative path reference (e.g. "assets/image.png").
#[tauri::command]
pub async fn storage_save_asset(
    session_id: String,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    validate_session_id(&session_id)?;
    let safe_name = sanitize_file_name(&file_name)?;

    let root = get_storage_root()?;
    let assets_dir = root.join("sessions").join(&session_id).join("assets");
    fs::create_dir_all(&assets_dir).await.map_err(|e| e.to_string())?;

    let target_path = assets_dir.join(&safe_name);
    fs::write(&target_path, bytes)
        .await
        .map_err(|e| format!("Failed writing binary asset {}: {}", safe_name, e))?;

    Ok(format!("assets/{}", safe_name))
}

/// Resolves an asset's relative path to its absolute filesystem path.
#[tauri::command]
pub async fn storage_resolve_asset_path(
    session_id: String,
    relative_path: String,
) -> Result<String, String> {
    validate_session_id(&session_id)?;
    let root = get_storage_root()?;
    let clean_rel = relative_path.replace("..", "").replace('\\', "/");
    let full_path = root.join("sessions").join(&session_id).join(clean_rel);

    Ok(full_path.to_string_lossy().to_string())
}

/// Scans session directories to build a new `sessions_index.json` catalog.
async fn rebuild_index_internal(root: &Path) -> Result<String, String> {
    let sessions_dir = root.join("sessions");
    let mut sessions = Vec::new();

    if sessions_dir.exists() {
        let mut entries = fs::read_dir(&sessions_dir)
            .await
            .map_err(|e| format!("Failed reading sessions dir: {}", e))?;

        while let Some(entry) = entries.next_entry().await.map_err(|e| e.to_string())? {
            let path = entry.path();
            if path.is_dir() {
                let meta_path = path.join("session.json");
                if meta_path.exists() {
                    if let Ok(meta_raw) = fs::read_to_string(&meta_path).await {
                        if let Ok(meta_json) = serde_json::from_str::<serde_json::Value>(&meta_raw) {
                            sessions.push(meta_json);
                        }
                    }
                }
            }
        }
    }

    let catalog = serde_json::json!({
        "version": 1,
        "lastActiveSessionId": null,
        "sessions": sessions
    });

    let catalog_str = catalog.to_string();
    let index_path = root.join("sessions_index.json");
    let _ = fs::write(index_path, catalog_str.as_bytes()).await;

    Ok(catalog_str)
}
