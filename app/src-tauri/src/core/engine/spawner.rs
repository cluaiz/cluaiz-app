use tauri::{AppHandle, Emitter, Manager};
use std::path::PathBuf;
use crate::core::state::EngineState;

/// Locates the `.cluaiz/bin` directory where the production engine lives
pub fn get_cluaiz_bin_path() -> Result<PathBuf, String> {
    let exe_name = if cfg!(windows) { "cluaiz.exe" } else { "cluaiz" };

    // 1. Dynamic probing: walk up directory tree from current executable or working directory
    let mut probe_start = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));

    loop {
        // Multi-repo layout: check sibling cluaiz/.cluaiz/bin
        let ws_bin = probe_start.join("cluaiz").join(".cluaiz").join("bin");
        if ws_bin.join(exe_name).exists() {
            return Ok(ws_bin);
        }
        // Direct .cluaiz/bin, skipping desktop subfolder
        let direct_bin = probe_start.join(".cluaiz").join("bin");
        if direct_bin.join(exe_name).exists() && !probe_start.ends_with("src-tauri") {
            return Ok(direct_bin);
        }
        if let Some(parent) = probe_start.parent() {
            probe_start = parent.to_path_buf();
        } else {
            break;
        }
    }

    // 2. Fallback: OS user home directory (~/.cluaiz/bin)
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let bin_path = home.join(".cluaiz").join("bin");
    if bin_path.join(exe_name).exists() {
        return Ok(bin_path);
    }

    Err(format!("cluaiz system binary '{}' not found in workspace or {:?}", exe_name, bin_path))
}

fn spawn_ipc_stream_listener<R>(app: AppHandle, mut rx: R)
where
    R: tokio::io::AsyncReadExt + Unpin + Send + 'static,
{
    tokio::spawn(async move {
        let mut buf = vec![0; 8192];
        let mut line_buffer = String::new();
        loop {
            match rx.read(&mut buf).await {
                Ok(0) => {
                    println!("⚠️ [FFI] Engine IPC Stream Closed.");
                    break;
                }
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buf[..n]);

                    let is_system_json = chunk.trim().starts_with('{') && 
                        (chunk.contains("\"status\"") || 
                         chunk.contains("\"permissions\"") || 
                         chunk.contains("\"system_optimization\"") ||
                         chunk.contains("\"hardware_snapshot\""));

                    if is_system_json {
                        let _ = app.emit("engine_sys_response", chunk.to_string());
                        continue;
                    }

                    line_buffer.push_str(&chunk);

                    while let Some(newline_idx) = line_buffer.find('\n') {
                        let line = line_buffer[..newline_idx].trim().to_string();
                        line_buffer.drain(..=newline_idx);

                        if line.is_empty() { continue; }

                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                            if let Some(msg_type) = json.get("type").and_then(|t| t.as_str()) {
                                if msg_type == "token" {
                                    if let Some(thinking) = json.get("thinking").and_then(|t| t.as_str()) {
                                        let _ = app.emit("engine_thinking", thinking.to_string());
                                    } else if let Some(content) = json.get("content").and_then(|c| c.as_str()) {
                                        let _ = app.emit("engine_token", content.to_string());
                                    }
                                } else if msg_type == "done" {
                                    let _ = app.emit("engine_done", "true".to_string());
                                } else if msg_type == "error" {
                                    let _ = app.emit("engine_error", json.get("error").unwrap_or(&serde_json::Value::Null).to_string());
                                }
                            } else if json.get("status").is_some() || json.get("permissions").is_some() || json.get("system_optimization").is_some() {
                                let _ = app.emit("engine_sys_response", line);
                            } else {
                                let _ = app.emit("engine_stream_token", line);
                            }
                        } else {
                            if line.starts_with('{') {
                                let _ = app.emit("engine_sys_response", line);
                            } else {
                                let _ = app.emit("engine_stream_token", line);
                            }
                        }
                    }
                }
                Err(e) => {
                    println!("❌ [FFI] IPC Read Error: {}", e);
                    break;
                }
            }
        }
    });
}

#[tauri::command]
pub async fn boot_cluaiz_engine(app: AppHandle) -> Result<String, String> {
    let state = app.state::<EngineState>();
    let bin_dir = get_cluaiz_bin_path()?;
    
    let exe_name = if cfg!(windows) { "cluaiz.exe" } else { "cluaiz" };
    let exe_path = bin_dir.join(exe_name);

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

    println!("🚀 [FFI] Booting cluaiz Engine at: {:?}", exe_path);
    let mut cmd = std::process::Command::new(&exe_path);
    cmd.arg("serve");
    
    // Explicitly bind canonical .cluaiz root dynamically
    if let Some(cluaiz_root) = bin_dir.parent() {
        cmd.env("cluaiz_HOME", cluaiz_root);
    }
    
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
        Ok(child) => {
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
            // Connect to Native IPC (Named Pipe on Windows, Unix Socket on Unix)
            #[cfg(windows)]
            {
                use tokio::net::windows::named_pipe::ClientOptions;

                let mut client_opt = None;
                for _ in 0..15 {
                    match ClientOptions::new().open(r"\\.\pipe\cluaiz_engine_pipe") {
                        Ok(c) => {
                            client_opt = Some(c);
                            break;
                        }
                        Err(_) => {
                            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                        }
                    }
                }

                if let Some(client) = client_opt {
                    println!("✅ [FFI] Connected to Engine Named Pipe!");
                    let (rx, tx) = tokio::io::split(client);
                    
                    {
                        let mut tx_lock = state.pipe_tx.lock().await;
                        *tx_lock = Some(crate::core::state::IpcWriter::NamedPipe(tx));
                    }

                    spawn_ipc_stream_listener(app.clone(), rx);
                } else {
                    println!("❌ [FFI] Failed to connect to Engine Pipe after 15 seconds!");
                }
            }

            #[cfg(unix)]
            {
                use tokio::net::UnixStream;

                let sock_path = dirs::home_dir()
                    .map(|h| h.join(".cluaiz").join("engine.sock"))
                    .unwrap_or_else(|| PathBuf::from("/tmp/cluaiz_engine.sock"));

                let mut stream_opt = None;
                for _ in 0..15 {
                    match UnixStream::connect(&sock_path).await {
                        Ok(s) => {
                            stream_opt = Some(s);
                            break;
                        }
                        Err(_) => {
                            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                        }
                    }
                }

                if let Some(stream) = stream_opt {
                    println!("✅ [FFI] Connected to Engine Unix Domain Socket!");
                    let (rx, tx) = tokio::io::split(stream);
                    
                    {
                        let mut tx_lock = state.pipe_tx.lock().await;
                        *tx_lock = Some(crate::core::state::IpcWriter::Unix(tx));
                    }

                    spawn_ipc_stream_listener(app.clone(), rx);
                } else {
                    println!("❌ [FFI] Failed to connect to Engine Unix Socket after 15 seconds!");
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

/// Dynamically resolves the core engine HTTP host and port
pub fn get_engine_api_endpoint() -> (String, u16) {
    // 1. Env vars take precedence
    let env_host = std::env::var("cluaiz_HOST").or_else(|_| std::env::var("CLUAIZ_HOST")).ok();
    let env_port = std::env::var("cluaiz_PORT")
        .or_else(|_| std::env::var("CLUAIZ_PORT"))
        .or_else(|_| std::env::var("CLUAIZ_API_PORT"))
        .ok()
        .and_then(|p| p.parse::<u16>().ok());

    if let (Some(h), Some(p)) = (env_host.as_ref(), env_port) {
        return (h.clone(), p);
    }

    // 2. Read permission.json from active .cluaiz engine directory
    let candidate_dirs = [
        get_cluaiz_bin_path().ok().and_then(|p| p.parent().map(|r| r.to_path_buf())),
        dirs::home_dir().map(|h| h.join(".cluaiz")),
    ];

    for root_opt in candidate_dirs.iter().flatten() {
        let perm_path = root_opt.join("engine").join("config").join("permission.json");
        if perm_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&perm_path) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    let host = env_host.clone().unwrap_or_else(|| {
                        json.get("api_host")
                            .and_then(|v| v.as_str())
                            .unwrap_or("127.0.0.1")
                            .to_string()
                    });
                    let port = env_port.unwrap_or_else(|| {
                        json.get("api_port")
                            .and_then(|v| v.as_u64())
                            .map(|p| p as u16)
                            .unwrap_or(8080)
                    });
                    return (host, port);
                }
            }
        }
    }

    (env_host.unwrap_or_else(|| "127.0.0.1".to_string()), env_port.unwrap_or(8080))
}

#[tauri::command]
pub async fn update_engine_settings(app: AppHandle, payload: serde_json::Value) -> Result<String, String> {
    let state = app.state::<EngineState>();
    
    {
        let mut tx_lock = state.pipe_tx.lock().await;
        if let Some(tx) = tx_lock.as_mut() {
            use tokio::io::AsyncWriteExt;
            let command_str = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
            
            let write_res = match tx {
                #[cfg(windows)]
                crate::core::state::IpcWriter::NamedPipe(p) => p.write_all(command_str.as_bytes()).await,
                #[cfg(unix)]
                crate::core::state::IpcWriter::Unix(u) => u.write_all(command_str.as_bytes()).await,
            };

            match write_res {
                Ok(_) => return Ok("Settings command sent via FFI IPC".to_string()),
                Err(e) => return Err(format!("Failed to write to IPC: {}", e)),
            }
        }
    }

    // Universal Fallback: Fast loopback TCP to dynamic Engine REST API
    use tokio::io::AsyncWriteExt;
    let (host, port) = get_engine_api_endpoint();
    let addr = format!("{}:{}", host, port);
    if let Ok(mut stream) = tokio::net::TcpStream::connect(&addr).await {
        let body = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
        let req = format!(
            "POST /v1/system/permission HTTP/1.1\r\nHost: {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            addr,
            body.len(),
            body
        );
        let _ = stream.write_all(req.as_bytes()).await;
        return Ok("Settings updated via loopback REST".to_string());
    }

    Err("Engine IPC or REST bridge not connected".to_string())
}

#[tauri::command]
pub fn get_session_token() -> Result<String, String> {
    // 1. Dynamic probe: check canonical workspace engine directory
    if let Ok(bin_dir) = get_cluaiz_bin_path() {
        if let Some(root) = bin_dir.parent() {
            let candidate = root.join("session.token");
            if candidate.exists() {
                if let Ok(token) = std::fs::read_to_string(&candidate) {
                    let trimmed = token.trim();
                    if !trimmed.is_empty() {
                        return Ok(trimmed.to_string());
                    }
                }
            }
        }
    }
    // 2. Standard OS home directory: ~/.cluaiz/session.token (Cross-Platform)
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let token_path = home.join(".cluaiz").join("session.token");
    if token_path.exists() {
        std::fs::read_to_string(token_path)
            .map(|t| t.trim().to_string())
            .map_err(|e| e.to_string())
    } else {
        Err("session.token not found".to_string())
    }
}
