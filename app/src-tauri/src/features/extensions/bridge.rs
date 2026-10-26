use super::surfaces::{validate_message, SurfaceState, BRIDGE_EVENT};
use tauri::{Emitter, EventTarget, Manager};

/// Guest supplies a message, never its claimed sender/owner/surface identity.
#[tauri::command]
pub fn extension_guest_message(
    app: tauri::AppHandle,
    webview: tauri::Webview,
    message: String,
) -> Result<(), String> {
    validate_message(&message)?;
    let surface = app.state::<SurfaceState>().get(webview.label())?;
    app.emit_to(
        EventTarget::webview(&surface.owner),
        BRIDGE_EVENT,
        serde_json::json!({ "label": webview.label(), "message": message }),
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn extension_host_message(
    app: tauri::AppHandle,
    webview: tauri::Webview,
    label: String,
    message: String,
) -> Result<(), String> {
    validate_message(&message)?;
    app.state::<SurfaceState>().owned(webview.label(), &label)?;
    let child = app
        .get_webview(&label)
        .ok_or("Extension surface is closed")?;
    let argument = serde_json::to_string(&message).map_err(|error| error.to_string())?;
    // Only an owner-checked bridge message reaches the child's fixed receiver.
    child
        .eval(format!("window.__CLUAIZ_EXTENSION_DELIVER__({argument})"))
        .map_err(|error| error.to_string())
}
