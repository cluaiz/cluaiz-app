use super::native::client::{self, NativeRequest};
use crate::core::state::{EngineState, NativeConfig, PendingEngine};
use std::{
    path::PathBuf,
    process::{Command, Stdio},
    time::Duration,
};
use tauri::{AppHandle, Manager};

const BOOT_TIMEOUT: Duration = Duration::from_secs(20);
const BOOT_POLL: Duration = Duration::from_millis(100);

/// Preserve workspace discovery; an explicit CLUAIZ_HOME takes precedence.
pub fn get_cluaiz_bin_path() -> Result<PathBuf, String> {
    if let Some(root) = std::env::var_os("CLUAIZ_HOME") {
        let bin = PathBuf::from(root).join("bin");
        if bin.join(engine_name()).is_file() {
            return Ok(bin);
        }
        return Err(
            "No compatible Engine executable exists in the explicit CLUAIZ_HOME/bin.".into(),
        );
    }
    let mut probe = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .or_else(|| std::env::current_dir().ok())
        .ok_or("Cannot resolve Engine search root.")?;
    loop {
        for candidate in [probe.join("cluaiz/.cluaiz/bin"), probe.join(".cluaiz/bin")] {
            if candidate.join(engine_name()).is_file() && !probe.ends_with("src-tauri") {
                return Ok(candidate);
            }
        }
        if !probe.pop() {
            break;
        }
    }
    let bin = dirs::home_dir()
        .ok_or("Cannot resolve home directory.")?
        .join(".cluaiz/bin");
    if bin.join(engine_name()).is_file() {
        return Ok(bin);
    }
    Err("Compatible Cluaiz Engine not found in CLUAIZ_HOME/bin or ~/.cluaiz/bin.".into())
}
fn engine_name() -> &'static str {
    if cfg!(windows) {
        "cluaiz.exe"
    } else {
        "cluaiz"
    }
}

fn native_config(bin: &std::path::Path) -> Result<NativeConfig, String> {
    let home = bin
        .parent()
        .ok_or("Engine bin has no home directory.")?
        .to_path_buf();
    let instance = uuid::Uuid::new_v4().simple().to_string();
    #[cfg(windows)]
    let endpoint = format!(r"\\.\pipe\cluaiz-{instance}");
    #[cfg(unix)]
    let endpoint = {
        let directory = home.join("ipc");
        use std::os::unix::fs::{DirBuilderExt, MetadataExt};
        if !directory.exists() {
            std::fs::DirBuilder::new()
                .mode(0o700)
                .create(&directory)
                .map_err(|e| e.to_string())?;
        }
        let metadata = std::fs::symlink_metadata(&directory).map_err(|e| e.to_string())?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() || metadata.mode() & 0o077 != 0 {
            return Err("Native socket directory must be private and cannot be a symlink.".into());
        }
        directory
            .join(format!("{instance}.sock"))
            .to_string_lossy()
            .into_owned()
    };
    #[cfg(not(any(windows, unix)))]
    let endpoint = {
        let _ = instance;
        return Err("Native Engine transport is unavailable on this platform.".into());
    };
    Ok(NativeConfig { endpoint, home })
}

async fn healthy(config: &NativeConfig) -> bool {
    let Ok(token) = std::fs::read_to_string(config.home.join("session.token")) else {
        return false;
    };
    let probe = NativeRequest {
        method: "GET".into(),
        path: "/health".into(),
        headers: vec![],
        body: vec![],
    };
    match tokio::time::timeout(
        client::CONNECT_TIMEOUT,
        client::request(&config.endpoint, &token, probe),
    )
    .await
    {
        Ok(Ok((response, _connection))) => response.status().is_success(),
        _ => false,
    }
}

async fn wait_ready(state: &EngineState, pid: u32, config: &NativeConfig) -> Result<(), String> {
    let deadline = tokio::time::Instant::now() + BOOT_TIMEOUT;
    loop {
        {
            let mut child = state
                .child_process
                .lock()
                .map_err(|_| "Engine process state is unavailable.")?;
            let child = child
                .as_mut()
                .filter(|child| child.id() == pid)
                .ok_or("Engine startup was cancelled.")?;
            if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
                return Err(format!("Engine exited before native readiness ({status}). A compatible Engine with --native-endpoint is required."));
            }
        }
        if healthy(config).await {
            return Ok(());
        }
        if tokio::time::Instant::now() >= deadline {
            return Err(
                "Engine native readiness timed out; no HTTP fallback was attempted.".into(),
            );
        }
        tokio::time::sleep(BOOT_POLL).await;
    }
}

#[tauri::command]
pub async fn boot_cluaiz_engine(app: AppHandle) -> Result<String, String> {
    let state = app.state::<EngineState>();
    let _boot = state.boot_lock.lock().await;
    let running = {
        let mut process = state
            .child_process
            .lock()
            .map_err(|_| "Engine process state is unavailable.")?;
        let running = match process.as_mut() {
            Some(child) => child.try_wait().map_err(|e| e.to_string())?.is_none(),
            None => false,
        };
        if !running {
            *process = None;
        }
        running
    };
    if running {
        let config = state
            .native_config
            .lock()
            .map_err(|_| "Engine connection state is unavailable.")?
            .clone()
            .ok_or("Engine process exists without a ready native connection.")?;
        return if healthy(&config).await {
            Ok("Native Engine is ready.".into())
        } else {
            Err("Owned Engine is running but its native connection is unavailable.".into())
        };
    }
    *state
        .native_config
        .lock()
        .map_err(|_| "Engine connection state is unavailable.")? = None;
    let bin = get_cluaiz_bin_path()?;
    let config = native_config(&bin)?;
    let mut command = Command::new(bin.join(engine_name()));
    command
        .arg("serve")
        .arg("--native-endpoint")
        .arg(&config.endpoint)
        .env("CLUAIZ_HOME", &config.home)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    let pid = {
        let mut process = state
            .child_process
            .lock()
            .map_err(|_| "Engine process state is unavailable.")?;
        let child = command
            .spawn()
            .map_err(|e| format!("Cannot start Engine: {e}"))?;
        let pid = child.id();
        *process = Some(child);
        pid
    };
    let pending = PendingEngine::new(state.child_process.clone(), pid);
    #[cfg(windows)]
    {
        *state
            .process_job
            .lock()
            .map_err(|_| "Engine job state is unavailable.")? = own_windows_job(pid);
    }
    wait_ready(&state, pid, &config).await?;
    *state
        .native_config
        .lock()
        .map_err(|_| "Engine connection state is unavailable.")? = Some(config);
    pending.commit();
    Ok(format!("Native Engine ready (PID {pid})."))
}

/// Preserve Windows process-tree cleanup from the previous launcher, with owned handles.
#[cfg(windows)]
fn own_windows_job(pid: u32) -> Option<std::os::windows::io::OwnedHandle> {
    use std::os::windows::io::{FromRawHandle, OwnedHandle};
    use windows_sys::Win32::{
        Foundation::CloseHandle,
        System::{JobObjects::*, Threading::*},
    };
    // SAFETY: every created/opened handle is checked; ownership is transferred once or closed below.
    unsafe {
        let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if job.is_null() {
            return None;
        }
        let owned = OwnedHandle::from_raw_handle(job);
        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        if SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &info as *const _ as *const _,
            std::mem::size_of_val(&info) as u32,
        ) == 0
        {
            return None;
        }
        let process = OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, 0, pid);
        if process.is_null() {
            return None;
        }
        let assigned = AssignProcessToJobObject(job, process);
        CloseHandle(process);
        if assigned == 0 {
            return None;
        }
        Some(owned)
    }
}

/// Legacy name retained; waits for an actual API reply instead of a successful socket write.
#[tauri::command]
pub async fn update_engine_settings(
    app: AppHandle,
    payload: serde_json::Value,
) -> Result<String, String> {
    let state = app.state::<EngineState>();
    let config = state
        .native_config
        .lock()
        .map_err(|_| "Engine connection state is unavailable.")?
        .clone()
        .ok_or("Native Engine is not connected.")?;
    let token =
        std::fs::read_to_string(config.home.join("session.token")).map_err(|e| e.to_string())?;
    let input = NativeRequest {
        method: "POST".into(),
        path: "/v1/system/permission".into(),
        headers: vec![("content-type".into(), "application/json".into())],
        body: serde_json::to_vec(&payload).map_err(|e| e.to_string())?,
    };
    let (response, _connection) = client::request(&config.endpoint, &token, input).await?;
    let status = response.status();
    use http_body_util::BodyExt;
    let body = response
        .into_body()
        .collect()
        .await
        .map_err(|e| e.to_string())?
        .to_bytes();
    if !status.is_success() {
        return Err(format!(
            "Engine rejected settings ({status}): {}",
            String::from_utf8_lossy(&body)
        ));
    }
    String::from_utf8(body.to_vec()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_session_token() -> Result<String, String> {
    let home = get_cluaiz_bin_path()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .or_else(|| std::env::var_os("CLUAIZ_HOME").map(PathBuf::from))
        .or_else(|| dirs::home_dir().map(|p| p.join(".cluaiz")))
        .ok_or("Cannot resolve Engine home.")?;
    let token = std::fs::read_to_string(home.join("session.token"))
        .map_err(|_| "Engine session token is unavailable.")?;
    if token.trim().is_empty() {
        return Err("Engine session token is empty.".into());
    }
    Ok(token.trim().into())
}
