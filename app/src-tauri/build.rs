include!("commands.rs");

macro_rules! build_permissions {
    (main [$($main:ident),*] guest [$($guest:ident),*]) => {
        fn main() -> Result<(), Box<dyn std::error::Error>> {
            println!("cargo:rerun-if-changed=commands.rs");
            let directory = std::path::PathBuf::from(std::env::var("OUT_DIR")?).join("app-permissions");
            std::fs::create_dir_all(&directory)?;
            let allowed = [$(stringify!($main)),*].map(|name| format!("\"{name}\"")).join(", ");
            std::fs::write(directory.join("main.toml"), format!(
                "[[permission]]\nidentifier = \"main-app-commands\"\ndescription = \"Existing host operations, main WebView only.\"\ncommands.allow = [{allowed}]\n"
            ))?;
            // Build-process allocation lives until tauri-build finishes reading the pattern.
            let pattern: &'static str = Box::leak(directory.join("*.toml").to_string_lossy().into_owned().into_boxed_str());
            tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
                tauri_build::AppManifest::new()
                    .commands(&[$(stringify!($main)),*, $(stringify!($guest)),*])
                    .permissions_path_pattern(pattern),
            ))?;
            Ok(())
        }
    };
}
app_commands!(build_permissions);
