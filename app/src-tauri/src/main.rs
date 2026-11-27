#![cfg_attr(windows, windows_subsystem = "windows")]

mod launcher;
mod web;

#[cfg(windows)]
fn attach_terminal() {
    use windows_sys::Win32::System::Console::{AttachConsole, ATTACH_PARENT_PROCESS};
    // SAFETY: attaches only to the parent console, if one exists.
    unsafe { AttachConsole(ATTACH_PARENT_PROCESS); }
}

fn main() -> std::process::ExitCode {
    match launcher::parse(std::env::args_os().skip(1)) {
        Ok(launcher::Mode::Desktop) => {
            shell_desktop_lib::run();
        }
        Ok(launcher::Mode::Web(options)) => {
            #[cfg(windows)]
            attach_terminal();
            if let Err(error) = web::run(options) {
                eprintln!("cluaiz-app: {error}");
                return std::process::ExitCode::FAILURE;
            }
        }
        Err(error) => {
            #[cfg(windows)]
            attach_terminal();
            eprintln!("cluaiz-app: {error}\nUsage: cluaiz-app [--web [--port N] [--no-open]]");
            return std::process::ExitCode::from(2);
        }
    }
    std::process::ExitCode::SUCCESS
}
