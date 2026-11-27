use super::spawner::{get_cluaiz_bin_path, spawn_owned_engine};
use crate::core::state::EngineState;
use http_body_util::{BodyExt, Empty, Limited};
use hyper::body::Bytes;
use hyper_util::rt::TokioIo;
use serde::{Deserialize, Serialize};
use std::{
    path::{Path, PathBuf},
    time::Duration,
};
use tokio::{
    net::TcpStream,
    time::{sleep, timeout, Instant},
};

const DEFAULT_ENGINE_PORT: u16 = 8000;
const WINDOWS_INSTALL: &str = r#"powershell -c "irm https://cluaiz.com/install.ps1 | iex""#;
const UNIX_INSTALL: &str = "curl -fsSL https://cluaiz.com/install.sh | bash";

#[derive(Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum LaunchStatus {
    Ready { port: u16 },
    Missing { command: &'static str },
}

#[derive(Deserialize, Default)]
struct EnginePreferences {
    api_port: Option<u16>,
}

fn configured_port(home: Option<&Path>) -> u16 {
    std::env::var("CLUAIZ_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .or_else(|| {
            let home = home?;
            let data = std::fs::read(home.join("config/permission.json")).ok()?;
            serde_json::from_slice::<EnginePreferences>(&data)
                .ok()?
                .api_port
        })
        .unwrap_or(DEFAULT_ENGINE_PORT)
}

fn engine_home(bin: Option<&Path>) -> Option<PathBuf> {
    bin.and_then(Path::parent)
        .map(Path::to_path_buf)
        .or_else(|| std::env::var_os("CLUAIZ_HOME").map(PathBuf::from))
        .or_else(|| dirs::home_dir().map(|home| home.join(".cluaiz")))
}

pub fn http_engine_port() -> u16 {
    configured_port(engine_home(get_cluaiz_bin_path().ok().as_deref()).as_deref())
}

fn is_engine_health(body: &[u8]) -> bool {
    serde_json::from_slice::<serde_json::Value>(body)
        .is_ok_and(|value| value["engine"] == "Cluaiz Engine" && value["status"] == "alive")
}

async fn healthy(port: u16) -> bool {
    timeout(Duration::from_millis(800), async {
        let stream = TcpStream::connect((std::net::Ipv4Addr::LOCALHOST, port))
            .await
            .ok()?;
        let (mut sender, connection) = hyper::client::conn::http1::handshake(TokioIo::new(stream))
            .await
            .ok()?;
        let request = hyper::Request::builder()
            .uri("/health")
            .header(hyper::header::HOST, format!("127.0.0.1:{port}"))
            .header(hyper::header::CONNECTION, "close")
            .body(Empty::<Bytes>::new())
            .ok()?;
        let reply = async move {
            let reply = sender.send_request(request).await.ok()?;
            if !reply.status().is_success() {
                return None;
            }
            let data = Limited::new(reply.into_body(), 4096)
                .collect()
                .await
                .ok()?
                .to_bytes();
            Some(is_engine_health(&data))
        };
        tokio::pin!(reply);
        tokio::select! {
            result = &mut reply => result,
            _ = connection => reply.await,
        }
    })
    .await
    .ok()
    .flatten()
    .unwrap_or(false)
}

fn install_command() -> &'static str {
    if cfg!(windows) {
        WINDOWS_INSTALL
    } else {
        UNIX_INSTALL
    }
}

pub async fn boot_http_engine(state: &EngineState) -> Result<LaunchStatus, String> {
    let _boot = state.boot_lock.lock().await;
    boot_locked(state).await
}

async fn boot_locked(state: &EngineState) -> Result<LaunchStatus, String> {
    let bin = get_cluaiz_bin_path().ok();
    let home = engine_home(bin.as_deref());
    let port = configured_port(home.as_deref());
    if healthy(port).await {
        return Ok(LaunchStatus::Ready { port });
    }
    let Some(bin) = bin else {
        return Ok(LaunchStatus::Missing {
            command: install_command(),
        });
    };
    let home = home.ok_or("Engine home is unavailable.")?;

    {
        let mut slot = state
            .child_process
            .lock()
            .map_err(|_| "Engine process state is unavailable.")?;
        if let Some(child) = slot.as_mut() {
            if child
                .try_wait()
                .map_err(|error| error.to_string())?
                .is_none()
            {
                return Err(
                    "The App's Engine is running but did not answer on its configured port.".into(),
                );
            }
            *slot = None;
        }
    }
    let (pid, pending) = spawn_owned_engine(state, &bin, &home, None)?;
    let deadline = Instant::now() + Duration::from_secs(20);
    loop {
        {
            let mut slot = state
                .child_process
                .lock()
                .map_err(|_| "Engine process state is unavailable.")?;
            let child = slot
                .as_mut()
                .filter(|child| child.id() == pid)
                .ok_or("Engine startup was cancelled.")?;
            if let Some(status) = child.try_wait().map_err(|error| error.to_string())? {
                return Err(format!("Engine exited before readiness ({status})."));
            }
        }
        if healthy(port).await {
            pending.commit();
            return Ok(LaunchStatus::Ready { port });
        }
        if Instant::now() >= deadline {
            return Err(format!("Engine did not answer on port {port}."));
        }
        sleep(Duration::from_millis(100)).await;
    }
}

/// Called only by a consent-bearing launcher action. The client cannot supply a command.
pub async fn install_http_engine(state: &EngineState) -> Result<LaunchStatus, String> {
    let _boot = state.boot_lock.lock().await;
    if let result @ LaunchStatus::Ready { .. } = boot_locked(state).await? {
        return Ok(result);
    }
    let mut command = if cfg!(windows) {
        let mut command = tokio::process::Command::new("powershell");
        command.args([
            "-NoProfile",
            "-Command",
            "irm https://cluaiz.com/install.ps1 | iex",
        ]);
        command
    } else {
        let mut command = tokio::process::Command::new("bash");
        command.args(["-o", "pipefail", "-c", UNIX_INSTALL]);
        command
    };
    let status = command
        .stdin(std::process::Stdio::null())
        .kill_on_drop(true)
        .status()
        .await
        .map_err(|error| format!("Could not start the official installer: {error}"))?;
    if !status.success() {
        return Err(format!("The official installer exited with {status}."));
    }
    match boot_locked(state).await? {
        ready @ LaunchStatus::Ready { .. } => Ok(ready),
        LaunchStatus::Missing { .. } => {
            Err("Installation finished, but the Engine executable was not found.".into())
        }
    }
}

#[tauri::command]
pub async fn app_launch_engine(
    state: tauri::State<'_, EngineState>,
) -> Result<LaunchStatus, String> {
    boot_http_engine(&state).await
}

#[tauri::command]
pub async fn app_install_engine(
    webview: tauri::Webview,
    state: tauri::State<'_, EngineState>,
) -> Result<LaunchStatus, String> {
    if webview.label() != "main" {
        return Err("Use the main App to install the Engine.".into());
    }
    install_http_engine(&state).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use http_body_util::Full;
    use tokio::net::TcpListener;

    #[test]
    fn engine_identity_requires_the_real_health_shape() {
        assert!(is_engine_health(br#"{"engine":"Cluaiz Engine","status":"alive","version":"0.1.0"}"#));
        for body in [
            &br#"{"status":"alive"}"#[..],
            &br#"{"engine":"Cluaiz Engine","status":"starting"}"#[..],
            b"<html>GUI</html>",
        ] {
            assert!(!is_engine_health(body));
        }
    }

    #[tokio::test]
    async fn detects_serving_engine_but_not_a_closed_port() {
        let listener = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0)).await.expect("bind fixture");
        let port = listener.local_addr().expect("fixture address").port();
        let server = tokio::spawn(async move {
            let (socket, _) = listener.accept().await.expect("probe connection");
            drop(listener);
            let service = hyper::service::service_fn(|request: hyper::Request<hyper::body::Incoming>| async move {
                assert_eq!(request.uri().path(), "/health");
                Ok::<_, std::convert::Infallible>(hyper::Response::new(Full::new(Bytes::from_static(
                    br#"{"engine":"Cluaiz Engine","status":"alive"}"#,
                ))))
            });
            let _ = hyper::server::conn::http1::Builder::new().serve_connection(TokioIo::new(socket), service).await;
        });
        assert!(healthy(port).await);
        server.await.expect("probe completed");
        assert!(!healthy(port).await);
    }
}
