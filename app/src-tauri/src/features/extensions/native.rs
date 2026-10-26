use super::{
    protocol,
    surfaces::{
        Bounds, Surface, SurfaceState, BRIDGE_EVENT, HOST_VIEW, MAX_BOOTSTRAP_BYTES,
        MAX_DOCUMENT_BYTES,
    },
};
use tauri::{
    webview::{NewWindowResponse, WebviewBuilder},
    Emitter, EventTarget, LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindowBuilder,
};

#[tauri::command]
pub async fn extension_surface_open(
    app: tauri::AppHandle,
    webview: tauri::Webview,
    html: String,
    bootstrap: String,
    bounds: Bounds,
    floating: Option<bool>,
    title: Option<String>,
) -> Result<String, String> {
    if webview.label() != HOST_VIEW {
        return Err("Only the main App can open extension surfaces".into());
    }
    bounds.validate()?;
    let floating = floating.unwrap_or(false);
    let title = title.unwrap_or_else(|| "Extension".into());
    if title.is_empty() || title.len() > 480 {
        return Err("Invalid extension window title".into());
    }
    if html.is_empty()
        || html.len() > MAX_DOCUMENT_BYTES
        || bootstrap.is_empty()
        || bootstrap.len() > MAX_BOOTSTRAP_BYTES
    {
        return Err("Extension document/bootstrap exceeds the supported size".into());
    }
    let label = format!("extension-{}", uuid::Uuid::new_v4().simple());
    let root = app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?
        .join("extension-views");
    std::fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    let profile = root.join(&label);
    app.state::<SurfaceState>().insert(
        label.clone(),
        Surface {
            owner: webview.label().into(),
            parent: webview.window().label().into(),
            html: html.into_bytes(),
            profile: profile.clone(),
            floating,
        },
    )?;
    let url = protocol::document_url(&label)?;
    let allowed_url = url.clone();
    let result = if floating {
        WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(url))
            .title(title)
            .inner_size(bounds.width, bounds.height)
            .min_inner_size(240.0, 160.0)
            .center()
            .data_directory(profile)
            .incognito(true)
            .initialization_script(bootstrap)
            .on_navigation(move |target| target == &allowed_url)
            .on_new_window(|_, _| NewWindowResponse::Deny)
            .on_download(|_, _| false)
            .build()
            .map(|_| ())
    } else {
        webview
            .window()
            .add_child(
                WebviewBuilder::new(&label, WebviewUrl::External(url))
                    .data_directory(profile)
                    .incognito(true)
                    .initialization_script(bootstrap)
                    .on_navigation(move |target| target == &allowed_url)
                    .on_new_window(|_, _| NewWindowResponse::Deny)
                    .on_download(|_, _| false),
                LogicalPosition::new(bounds.x, bounds.y),
                LogicalSize::new(bounds.width, bounds.height),
            )
            .map(|_| ())
    };
    if let Err(error) = result {
        let _ = close_surface(&app, &label);
        return Err(error.to_string());
    }
    Ok(label)
}

#[tauri::command]
pub async fn extension_surface_resize(
    app: tauri::AppHandle,
    webview: tauri::Webview,
    label: String,
    bounds: Bounds,
) -> Result<(), String> {
    bounds.validate()?;
    app.state::<SurfaceState>().owned(webview.label(), &label)?;
    app.get_webview(&label)
        .ok_or("Extension surface is closed")?
        .set_bounds(tauri::Rect {
            position: LogicalPosition::new(bounds.x, bounds.y).into(),
            size: LogicalSize::new(bounds.width, bounds.height).into(),
        })
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn extension_surface_close(
    app: tauri::AppHandle,
    webview: tauri::Webview,
    label: String,
) -> Result<(), String> {
    app.state::<SurfaceState>().owned(webview.label(), &label)?;
    close_surface(&app, &label)
}

pub fn close_surface(app: &tauri::AppHandle, label: &str) -> Result<(), String> {
    let Ok(surface) = app.state::<SurfaceState>().get(label) else {
        return Ok(());
    };
    if surface.floating {
        if let Some(window) = app.get_webview_window(label) {
            window.close().map_err(|error| error.to_string())?;
        }
    } else if let Some(child) = app.get_webview(label) {
        child.close().map_err(|error| error.to_string())?;
    }
    retire_surface(app, label)
}

/// Native X-close and host Stop share idempotent ledger/profile cleanup.
fn retire_surface(app: &tauri::AppHandle, label: &str) -> Result<(), String> {
    let Some(surface) = app.state::<SurfaceState>().remove(label)? else {
        return Ok(());
    };
    let _ = app.emit_to(
        EventTarget::webview(&surface.owner),
        BRIDGE_EVENT,
        serde_json::json!({ "label": label, "closed": true }),
    );
    let profile = surface.profile.clone();
    // Renderer shutdown can keep files open briefly. Delete only this owned profile.
    std::thread::spawn(move || {
        for delay in [100, 500, 1500] {
            std::thread::sleep(std::time::Duration::from_millis(delay));
            let (Ok(target), Some(parent)) = (profile.canonicalize(), profile.parent()) else {
                return;
            };
            let Ok(parent) = parent.canonicalize() else {
                return;
            };
            if target.parent() != Some(parent.as_path())
                || target.file_name() != profile.file_name()
                || !target
                    .file_name()
                    .is_some_and(|name| name.to_string_lossy().starts_with("extension-"))
            {
                return;
            }
            if std::fs::remove_dir_all(&target).is_ok() {
                return;
            }
        }
        eprintln!("Extension profile cleanup deferred: {}", profile.display());
    });
    Ok(())
}

pub fn window_destroyed(app: &tauri::AppHandle, label: &str) {
    close_owner(app, label);
    if app
        .state::<SurfaceState>()
        .get(label)
        .is_ok_and(|surface| surface.floating)
    {
        if let Err(error) = retire_surface(app, label) {
            eprintln!("Extension window retirement failed: {error}");
        }
    }
}

pub fn close_owner(app: &tauri::AppHandle, parent: &str) {
    let labels: Vec<String> = app
        .state::<SurfaceState>()
        .0
        .lock()
        .map(|values| {
            values
                .iter()
                .filter(|(_, surface)| surface.parent == parent)
                .map(|(label, _)| label.clone())
                .collect()
        })
        .unwrap_or_default();
    for label in labels {
        if let Err(error) = close_surface(app, &label) {
            eprintln!("Extension close failed: {error}");
        }
    }
}
