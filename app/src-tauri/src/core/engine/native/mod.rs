pub mod client;
pub mod requests;

use crate::core::state::EngineState;
use requests::{NativeChunk, NativeHead, NativeRequests};
use tauri::{State, Webview};

fn host_webview(webview: &Webview) -> Result<&str, String> {
    // A window containing an extension child is no longer a WebviewWindow.
    // Bind ownership to Tauri's actual caller, never to its shared parent window.
    if webview.label() != "main" {
        return Err("Native Engine transport is restricted to the host WebView.".into());
    }
    Ok(webview.label())
}

#[tauri::command]
pub async fn engine_native_start(
    webview: Webview,
    state: State<'_, EngineState>,
    requests: State<'_, NativeRequests>,
    request: client::NativeRequest,
) -> Result<String, String> {
    let owner = host_webview(&webview)?;
    let config = state.native_config.lock().map_err(|_| "Engine connection state is unavailable.")?
        .clone().ok_or("Native Engine is not connected. Start a compatible Engine or select explicit HTTP mode.")?;
    let token = std::fs::read_to_string(config.home.join("session.token"))
        .map_err(|_| "Native Engine session token is unavailable.")?;
    requests.start(owner, config.endpoint, token, request)
}

#[tauri::command]
pub async fn engine_native_head(
    webview: Webview,
    requests: State<'_, NativeRequests>,
    id: String,
) -> Result<NativeHead, String> {
    requests.head(host_webview(&webview)?, &id).await
}
#[tauri::command]
pub async fn engine_native_read(
    webview: Webview,
    requests: State<'_, NativeRequests>,
    id: String,
) -> Result<NativeChunk, String> {
    requests.read(host_webview(&webview)?, &id).await
}
#[tauri::command]
pub fn engine_native_cancel(
    webview: Webview,
    requests: State<'_, NativeRequests>,
    id: String,
) -> Result<bool, String> {
    requests.cancel(host_webview(&webview)?, &id)
}
