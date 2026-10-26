//! App-owned document surfaces and UI package persistence; inference stays in existing services.
#[cfg(desktop)]
mod packages;
#[cfg(desktop)]
pub use packages::{extension_package_commit, extension_package_read, extension_packages_list};
#[cfg(desktop)]
mod bridge;
#[cfg(desktop)]
mod native;
#[cfg(desktop)]
mod protocol;
#[cfg(desktop)]
mod surfaces;
#[cfg(desktop)]
pub(crate) use surfaces::HOST_VIEW;
#[cfg(desktop)]
pub use bridge::{extension_guest_message, extension_host_message};
#[cfg(desktop)]
pub use native::{
    close_owner, window_destroyed, extension_surface_close, extension_surface_open, extension_surface_resize,
};

pub fn configure(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    #[cfg(desktop)]
    {
        builder
            .manage(surfaces::SurfaceState::default())
            .register_uri_scheme_protocol(protocol::SCHEME, protocol::document)
    }
    #[cfg(not(desktop))]
    {
        builder
    }
}

#[cfg(not(desktop))]
mod unavailable {
    #[tauri::command]
    pub async fn extension_packages_list() -> Result<(), String> { Err("Native extension packages are unavailable on this platform".into()) }
    #[tauri::command]
    pub async fn extension_package_read() -> Result<(), String> { Err("Native extension packages are unavailable on this platform".into()) }
    #[tauri::command]
    pub async fn extension_package_commit() -> Result<(), String> { Err("Native extension packages are unavailable on this platform".into()) }
    #[tauri::command]
    pub async fn extension_surface_open() -> Result<String, String> {
        Err("Desktop extension surfaces are unavailable on this platform".into())
    }
    #[tauri::command]
    pub async fn extension_surface_resize() -> Result<(), String> {
        Err("Desktop extension surfaces are unavailable on this platform".into())
    }
    #[tauri::command]
    pub async fn extension_surface_close() -> Result<(), String> {
        Err("Desktop extension surfaces are unavailable on this platform".into())
    }
    #[tauri::command]
    pub fn extension_guest_message() -> Result<(), String> {
        Err("Desktop extension surfaces are unavailable on this platform".into())
    }
    #[tauri::command]
    pub fn extension_host_message() -> Result<(), String> {
        Err("Desktop extension surfaces are unavailable on this platform".into())
    }
    pub fn close_owner(_: &tauri::AppHandle, _: &str) {}
    pub fn window_destroyed(_: &tauri::AppHandle, _: &str) {}
}
#[cfg(not(desktop))]
pub use unavailable::*;
