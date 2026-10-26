//! Test-only embedded WebView probe. No Engine, actual token or user profile.
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Mutex,
};
use tauri::{webview::WebviewBuilder, LogicalPosition, LogicalSize, Manager, WebviewUrl};

const HOST: &str = "main";
const GUEST: &str = "extension-probe";
const CHILD_LEFT: f64 = 220.0;
const CHILD_WIDTH: f64 = 600.0;
const CHILD_HEIGHT: f64 = 480.0;
const DEADLINE_SECONDS: u64 = 30;

#[derive(Default)]
struct ProbeState {
    host_calls: AtomicUsize,
    reports: Mutex<std::collections::BTreeMap<String, serde_json::Value>>,
}

#[tauri::command]
fn prototype_main_only(state: tauri::State<'_, ProbeState>) -> &'static str {
    state.host_calls.fetch_add(1, Ordering::SeqCst);
    "host-only-test-value"
}

#[tauri::command]
async fn prototype_report(
    app: tauri::AppHandle,
    webview: tauri::Webview,
    state: tauri::State<'_, ProbeState>,
    report: serde_json::Value,
) -> Result<(), String> {
    let caller = webview.label().to_string();
    if ![HOST, GUEST].contains(&caller.as_str()) || report["view"] != caller {
        return Err("Prototype caller/report mismatch".into());
    }
    let mut reports = state
        .reports
        .lock()
        .map_err(|_| "Prototype report lock failed")?;
    reports.insert(caller.clone(), report);
    if reports.len() != 2 {
        return Ok(());
    }
    let child = app.get_webview(GUEST).ok_or("Prototype child missing")?;
    let parent_matches = child.window().label() == HOST;
    let size = child.size().map_err(|error| error.to_string())?;
    let position = child.position().map_err(|error| error.to_string())?;
    let scale = child
        .window()
        .scale_factor()
        .map_err(|error| error.to_string())?;
    let host_calls = state.host_calls.load(Ordering::SeqCst);
    let host_allowed = reports[HOST]["allowed"] == true;
    let guest_blocked = reports[GUEST]["allowed"] == false
        && reports[GUEST]["rejected"]
            .as_str()
            .is_some_and(|value| value.contains("not allowed"));
    let bounds_match = (f64::from(position.x) / scale - CHILD_LEFT).abs() < 2.0
        && (f64::from(size.width) / scale - CHILD_WIDTH).abs() < 2.0
        && (f64::from(size.height) / scale - CHILD_HEIGHT).abs() < 2.0;
    let passed = parent_matches && bounds_match && host_calls == 1 && host_allowed && guest_blocked;
    println!(
        "EXTENSION_SURFACE_PROTOTYPE_RESULT={}",
        serde_json::json!({
            "passed": passed, "parentMatches": parent_matches, "boundsMatch": bounds_match,
            "hostCommandExecutions": host_calls, "hostAllowed": host_allowed,
            "guestBlocked": guest_blocked, "reports": *reports,
            "scope": "test-only Windows embedded WebView / test command ACL; not production guest isolation"
        })
    );
    drop(reports);
    app.exit(if passed { 0 } else { 1 });
    Ok(())
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let data = std::env::var_os("CLUAIZ_EXTENSION_PROTOTYPE_DATA")
        .ok_or("Set an owned CLUAIZ_EXTENSION_PROTOTYPE_DATA test directory")?;
    let data = std::fs::canonicalize(data)?;
    let app = tauri::Builder::default()
        .manage(ProbeState::default())
        .invoke_handler(tauri::generate_handler![
            prototype_main_only,
            prototype_report
        ])
        .setup(move |app| {
            tauri::WebviewWindowBuilder::new(app, HOST, WebviewUrl::App("index.html".into()))
                .visible(false)
                .inner_size(840.0, 500.0)
                .data_directory(data.join("host"))
                .build()?;
            let window = app.get_window(HOST).ok_or("Prototype parent missing")?;
            window.add_child(
                WebviewBuilder::new(GUEST, WebviewUrl::App("guest.html".into()))
                    .data_directory(data.join("guest")),
                LogicalPosition::new(CHILD_LEFT, 0.0),
                LogicalSize::new(CHILD_WIDTH, CHILD_HEIGHT),
            )?;
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(DEADLINE_SECONDS));
                eprintln!("EXTENSION_SURFACE_PROTOTYPE_TIMEOUT");
                handle.exit(2);
            });
            Ok(())
        })
        .build(tauri::generate_context!())?;
    app.run(|_, _| {});
    Ok(())
}
