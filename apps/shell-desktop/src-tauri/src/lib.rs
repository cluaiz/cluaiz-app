use tauri::{AppHandle, Emitter, Manager};
use std::path::PathBuf;
use std::sync::Mutex;
use std::process::{Child, ChildStdin};
use std::io::{BufReader, Write, Read};

struct EngineState {
    child_process: Mutex<Option<Child>>,
    stdin: Mutex<Option<ChildStdin>>,
}

/// Locates the `~/.cluaiz/bin` directory where the production engine lives
fn get_cluaiz_bin_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let bin_path = home.join(".cluaiz").join("bin");
    if !bin_path.exists() {
        return Err(format!("Cluaize system not found at {:?}", bin_path));
    }
    Ok(bin_path)
}

#[tauri::command]
async fn boot_cluaiz_engine(app: AppHandle, state: tauri::State<'_, EngineState>) -> Result<String, String> {
    let bin_dir = get_cluaiz_bin_path()?;
    let exe_path = bin_dir.join("cluaiz.exe");

    if !exe_path.exists() {
        return Err(format!("Engine executable not found at {:?}", exe_path));
    }

    // First check if already running in this Tauri state
    {
        let child_lock = state.child_process.lock().unwrap();
        if child_lock.is_some() {
            println!("✅ Engine is already running in background. Skipping duplicate boot.");
            return Ok("Engine already running".to_string());
        }
    }

    println!("🚀 [FFI] Booting Cluaize Engine at: {:?}", exe_path);
    
    let mut cmd = std::process::Command::new(&exe_path);
    
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.stdout(std::process::Stdio::piped());
    cmd.stdin(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::null()); // Ignore stderr for now to avoid freezing

    match cmd.spawn() {
        Ok(mut child) => {
            println!("✅ Engine spawned with PID: {}", child.id());
            let pid = child.id();
            
            let stdin = child.stdin.take().expect("Failed to open stdin");
            let stdout = child.stdout.take().expect("Failed to open stdout");

            let mut process_lock = state.child_process.lock().unwrap();
            *process_lock = Some(child);
            let mut stdin_lock = state.stdin.lock().unwrap();
            *stdin_lock = Some(stdin);

            // Spawn background thread to stream stdout
            let app_clone = app.clone();
            std::thread::spawn(move || {
                let mut reader = BufReader::new(stdout);
                let mut buffer = [0u8; 64];
                while let Ok(n) = reader.read(&mut buffer) {
                    if n == 0 { break; } // EOF
                    let chunk = String::from_utf8_lossy(&buffer[..n]).to_string();
                    let _ = app_clone.emit("engine_stream_token", chunk);
                }
            });

            Ok(format!("Engine Booted: {}", pid))
        },
        Err(e) => {
            Err(format!("Failed to spawn engine: {}", e))
        }
    }
}

#[tauri::command]
async fn ffi_send_message(app: tauri::AppHandle, state: tauri::State<'_, EngineState>, message: String) -> Result<(), String> {
    println!("⚡ [FFI] Writing to memory buffer: {}", message);
    
    let mut stdin_lock = state.stdin.lock().unwrap();
    if let Some(stdin) = stdin_lock.as_mut() {
        let payload = format!("{}\n", message);
        if let Err(e) = stdin.write_all(payload.as_bytes()) {
            return Err(format!("Failed to write to engine: {}", e));
        }
        let _ = stdin.flush();

        Ok(())
    } else {
        Err("Engine is not booted!".into())
    }
}

#[tauri::command]
async fn ffi_fetch_history(state: tauri::State<'_, EngineState>) -> Result<String, String> {
    println!("⚡ [FFI] Fetching chat history via CDQL...");
    // For now, return an empty JSON array until the engine's CDQL parser is ready to return history.
    Ok("[]".to_string())
}

#[tauri::command]
async fn ffi_delete_session(state: tauri::State<'_, EngineState>, session_id: String) -> Result<(), String> {
    println!("⚡ [FFI] Deleting session {} via CDQL...", session_id);
    let mut stdin_lock = state.stdin.lock().unwrap();
    if let Some(stdin) = stdin_lock.as_mut() {
        let payload = format!("//CDQL_DELETE_SESSION {}\n", session_id);
        if let Err(e) = stdin.write_all(payload.as_bytes()) {
            return Err(format!("Failed to write to engine: {}", e));
        }
        let _ = stdin.flush();
        Ok(())
    } else {
        Err("Engine is not booted!".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(EngineState { 
            child_process: Mutex::new(None),
            stdin: Mutex::new(None),
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            boot_cluaiz_engine,
            ffi_send_message,
            ffi_fetch_history,
            ffi_delete_session
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| match event {
            tauri::RunEvent::Exit => {
                let state = app_handle.state::<EngineState>();
                if let Ok(mut child_lock) = state.inner().child_process.lock() {
                    if let Some(mut child) = child_lock.take() {
                        println!("🛑 Tauri App Exiting: Killing Cluaize Engine...");
                        let _ = child.kill();
                    }
                }
            }
            _ => {}
        });
}
