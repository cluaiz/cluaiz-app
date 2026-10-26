//! Desktop window lifetime, not a daemon or a new Engine lifecycle owner.
#[cfg(desktop)]
mod desktop {
    use crate::{
        core::engine::native::requests::NativeRequests,
        features::extensions::{self, HOST_VIEW},
    };
    use serde::Serialize;
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    };
    use tauri::{
        menu::{Menu, MenuItem},
        tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
        Manager,
    };

    const SHOW: &str = "cluaiz.desktop.show";
    const QUIT: &str = "cluaiz.desktop.quit";
    #[derive(Default)]
    pub struct DesktopLifecycle {
        enabled: AtomicBool,
        ready: AtomicBool,
        quitting: AtomicBool,
        error: Mutex<Option<String>>,
    }
    impl DesktopLifecycle {
        fn should_hide(&self, label: &str) -> bool {
            label == HOST_VIEW
                && self.enabled.load(Ordering::SeqCst)
                && self.ready.load(Ordering::SeqCst)
                && !self.quitting.load(Ordering::SeqCst)
        }
        fn configure(&self, enabled: bool) -> Result<(), String> {
            if self.quitting.load(Ordering::SeqCst) {
                return Err("Cluaiz is quitting".into());
            }
            if enabled && !self.ready.load(Ordering::SeqCst) {
                return Err("Background mode requires an available system tray".into());
            }
            self.enabled.store(enabled, Ordering::SeqCst);
            Ok(())
        }
    }
    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    pub struct DesktopStatus {
        background_enabled: bool,
        tray_ready: bool,
        main_visible: bool,
        quitting: bool,
        error: Option<String>,
    }
    fn admit(label: &str) -> Result<(), String> {
        if label != HOST_VIEW {
            return Err("Only the main App can control desktop lifetime".into());
        }
        Ok(())
    }
    fn status(app: &tauri::AppHandle) -> Result<DesktopStatus, String> {
        let state = app.state::<DesktopLifecycle>();
        let main = app
            .get_webview_window(HOST_VIEW)
            .ok_or("Main window is unavailable")?;
        let error = state
            .error
            .lock()
            .map_err(|_| "Desktop lifetime state unavailable")?
            .clone();
        Ok(DesktopStatus {
            background_enabled: state.enabled.load(Ordering::SeqCst),
            tray_ready: state.ready.load(Ordering::SeqCst),
            main_visible: main.is_visible().map_err(|error| error.to_string())?,
            quitting: state.quitting.load(Ordering::SeqCst),
            error,
        })
    }
    pub fn show_main(app: &tauri::AppHandle) -> Result<(), String> {
        let main = app
            .get_webview_window(HOST_VIEW)
            .ok_or("Main window is unavailable")?;
        main.show()
            .and_then(|_| main.unminimize())
            .and_then(|_| main.set_focus())
            .map_err(|error| error.to_string())
    }
    pub fn quit(app: &tauri::AppHandle) {
        if app
            .state::<DesktopLifecycle>()
            .quitting
            .swap(true, Ordering::SeqCst)
        {
            return;
        }
        extensions::close_owner(app, HOST_VIEW);
        app.state::<NativeRequests>().cancel_owner(HOST_VIEW);
        // RunEvent::Exit retains the existing owned Engine child cleanup.
        app.exit(0);
    }
    pub fn configure(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
        builder.manage(DesktopLifecycle::default())
    }
    pub fn setup(app: &tauri::AppHandle) {
        let installed = (|| -> Result<(), Box<dyn std::error::Error>> {
            let show = MenuItem::with_id(app, SHOW, "Show Cluaiz", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, QUIT, "Quit Cluaiz", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit_item])?;
            let icon = app
                .default_window_icon()
                .cloned()
                .ok_or("Default tray icon is unavailable")?;
            TrayIconBuilder::with_id("cluaiz.desktop.tray")
                .icon(icon)
                .tooltip("Cluaiz")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    SHOW => {
                        if let Err(error) = show_main(app) {
                            eprintln!("Could not restore Cluaiz: {error}");
                        }
                    }
                    QUIT => quit(app),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if matches!(
                        event,
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        }
                    ) {
                        if let Err(error) = show_main(tray.app_handle()) {
                            eprintln!("Could not restore Cluaiz: {error}");
                        }
                    }
                })
                .build(app)?;
            Ok(())
        })();
        let state = app.state::<DesktopLifecycle>();
        match installed {
            Ok(()) => state.ready.store(true, Ordering::SeqCst),
            Err(error) => {
                eprintln!("System tray unavailable; close-to-tray disabled: {error}");
                if let Ok(mut stored) = state.error.lock() {
                    *stored = Some(error.to_string());
                }
            }
        }
    }
    pub fn window_event(window: &tauri::Window, event: &tauri::WindowEvent) {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            if window
                .state::<DesktopLifecycle>()
                .should_hide(window.label())
            {
                api.prevent_close();
                if let Err(error) = window.hide() {
                    eprintln!("Could not hide Cluaiz; main window retained: {error}");
                }
            }
        }
    }
    #[tauri::command]
    pub fn desktop_lifecycle_status(
        app: tauri::AppHandle,
        webview: tauri::Webview,
    ) -> Result<DesktopStatus, String> {
        admit(webview.label())?;
        status(&app)
    }
    #[tauri::command]
    pub fn desktop_set_background(
        app: tauri::AppHandle,
        webview: tauri::Webview,
        enabled: bool,
    ) -> Result<DesktopStatus, String> {
        admit(webview.label())?;
        app.state::<DesktopLifecycle>().configure(enabled)?;
        status(&app)
    }
    #[tauri::command]
    pub fn desktop_show_main(app: tauri::AppHandle, webview: tauri::Webview) -> Result<(), String> {
        admit(webview.label())?;
        show_main(&app)
    }
    #[tauri::command]
    pub fn desktop_quit(app: tauri::AppHandle, webview: tauri::Webview) -> Result<(), String> {
        admit(webview.label())?;
        quit(&app);
        Ok(())
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        #[test]
        fn close_policy_requires_ready_tray_enable_and_main() {
            let state = DesktopLifecycle::default();
            assert!(!state.should_hide(HOST_VIEW));
            assert!(state.configure(true).is_err());
            state.ready.store(true, Ordering::SeqCst);
            state.configure(true).unwrap();
            assert!(state.should_hide(HOST_VIEW));
            assert!(!state.should_hide("extension-owned"));
            state.configure(false).unwrap();
            assert!(!state.should_hide(HOST_VIEW));
            state.configure(true).unwrap();
            state.quitting.store(true, Ordering::SeqCst);
            assert!(!state.should_hide(HOST_VIEW));
            assert!(state.configure(true).is_err());
        }
        #[test]
        fn guest_cannot_admit_itself_as_main() {
            assert!(admit(HOST_VIEW).is_ok());
            assert!(admit("extension-owned").is_err());
            assert!(admit("").is_err());
        }
    }
}
#[cfg(desktop)]
pub use desktop::*;
#[cfg(not(desktop))]
mod unavailable {
    pub fn configure(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
        builder
    }
    pub fn setup(_: &tauri::AppHandle) {}
    pub fn window_event(_: &tauri::Window, _: &tauri::WindowEvent) {}
    #[tauri::command]
    pub fn desktop_lifecycle_status() -> Result<(), String> {
        Err("Desktop lifetime is unavailable on this platform".into())
    }
    #[tauri::command]
    pub fn desktop_set_background() -> Result<(), String> {
        Err("Desktop lifetime is unavailable on this platform".into())
    }
    #[tauri::command]
    pub fn desktop_show_main() -> Result<(), String> {
        Err("Desktop lifetime is unavailable on this platform".into())
    }
    #[tauri::command]
    pub fn desktop_quit() -> Result<(), String> {
        Err("Desktop lifetime is unavailable on this platform".into())
    }
}
#[cfg(not(desktop))]
pub use unavailable::*;
