fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&["prototype_report", "prototype_main_only"]),
    ))
    .expect("prototype permission manifest could not build");
}
