use tauri::{AppHandle, Emitter, Manager};
use std::path::PathBuf;
use std::io::{BufReader, Read};
use crate::core::state::EngineState;

/// Locates the `~/.cluaize/bin` directory where the production engine lives
pub fn get_cluaiz_bin_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let bin_path = home.join(".cluaize").join("bin");
    if !bin_path.exists() {
        return Err(format!("Cluaize system not found at {:?}", bin_path));
    }
    Ok(bin_path)
}

#[tauri::command]
pub async fn boot_cluaiz_engine(app: AppHandle) -> Result<String, String> {
    let state = app.state::<EngineState>();
    let bin_dir = get_cluaiz_bin_path()?;
    
    let exe_path = bin_dir.join("cluaize.exe");

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
    cmd.arg("serve");
    
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
            
            #[cfg(target_os = "windows")]
            {
                use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
                use windows_sys::Win32::System::JobObjects::{
                    AssignProcessToJobObject, CreateJobObjectW, SetInformationJobObject,
                    JobObjectExtendedLimitInformation, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
                    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
                };
                use windows_sys::Win32::System::Threading::{OpenProcess, PROCESS_ALL_ACCESS};
                
                unsafe {
                    let job: HANDLE = CreateJobObjectW(std::ptr::null(), std::ptr::null());
                    if job != 0 as HANDLE {
                        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
                        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                        
                        SetInformationJobObject(
                            job,
                            JobObjectExtendedLimitInformation,
                            &info as *const _ as *const _,
                            std::mem::size_of_val(&info) as u32,
                        );
                        
                        let process_handle = OpenProcess(PROCESS_ALL_ACCESS, 0, pid);
                        if process_handle != 0 as HANDLE {
                            let assign_res = AssignProcessToJobObject(job, process_handle);
                            if assign_res == 0 {
                                println!("⚠️ Job grouping failed (process may detach in Task Manager)");
                            } else {
                                println!("✅ Engine rigidly grouped under Tauri App in Task Manager.");
                            }
                            CloseHandle(process_handle);
                        }
                    }
                }
            }
            
            {
                let mut process_lock = state.child_process.lock().unwrap();
                *process_lock = Some(child);
            }

            // Connect to Native Named Pipe with retries (Engine might take up to 15s to load ML models)
            #[cfg(windows)]
            {
                use tokio::net::windows::named_pipe::ClientOptions;
                use tokio::io::{AsyncReadExt, AsyncWriteExt};

                let mut client_opt = None;
                for _ in 0..15 {
                    match ClientOptions::new().open(r"\\.\pipe\cluaize_engine_pipe") {
                        Ok(c) => {
                            client_opt = Some(c);
                            break;
                        }
                        Err(_) => {
                            // Wait 1 second and retry
                            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                        }
                    }
                }

                if let Some(client) = client_opt {
                    println!("✅ [FFI] Connected to Engine Named Pipe!");
                    let (mut rx, mut tx) = tokio::io::split(client);
                    
                    // Save tx to state for sending messages
                    {
                        let mut tx_lock = state.pipe_tx.lock().await;
                        *tx_lock = Some(tx);
                    }

                    // Spawn background listener to stream tokens
                    let app_clone = app.clone();
                    tokio::spawn(async move {
                        let mut buf = vec![0; 4096];
                        loop {
                            match rx.read(&mut buf).await {
                                Ok(0) => {
                                    println!("⚠️ [FFI] Engine IPC Stream Closed.");
                                    break;
                                }
                                Ok(n) => {
                                    let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                                    let _ = app_clone.emit("engine_stream_token", chunk);
                                }
                                Err(e) => {
                                    println!("❌ [FFI] IPC Read Error: {}", e);
                                    break;
                                }
                            }
                        }
                    });

                    // Preload logic is now handled natively by the Engine via Permission.json
                    // No need to send the SYSTEM_PROFILE_SETUP command from Tauri.
                } else {
                    println!("❌ [FFI] Failed to connect to Engine Pipe after 15 seconds!");
                }
            }

            Ok(format!("Engine Booted: {}", pid))
        },
        Err(e) => {
            println!("❌ [FFI] Failed to spawn engine: {}", e);
            Err(format!("Failed to spawn engine: {}", e))
        }
    }
}

#[tauri::command]
pub async fn update_engine_settings(app: AppHandle, payload: serde_json::Value) -> Result<String, String> {
    let state = app.state::<EngineState>();
    
    let mut tx_lock = state.pipe_tx.lock().await;
    if let Some(tx) = tx_lock.as_mut() {
        use tokio::io::AsyncWriteExt;
        let command_str = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
        
        match tx.write_all(command_str.as_bytes()).await {
            Ok(_) => Ok("Settings command sent via FFI IPC".to_string()),
            Err(e) => Err(format!("Failed to write to pipe: {}", e))
        }
    } else {
        Err("Engine FFI Pipe not connected".to_string())
    }
}
