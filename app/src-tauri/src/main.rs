mod launcher;
mod web;

fn main() -> std::process::ExitCode {
    match launcher::parse(std::env::args_os().skip(1)) {
        Ok(launcher::Mode::Desktop) => {
            // A console subsystem lets Windows shells wait for --web and deliver Ctrl+C.
            // SAFETY: detaches only this process from its console without changing its parent.
            #[cfg(all(windows, not(debug_assertions)))]
            unsafe { windows_sys::Win32::System::Console::FreeConsole(); }
            shell_desktop_lib::run();
        }
        Ok(launcher::Mode::Web(options)) => {
            if let Err(error) = web::run(options) {
                eprintln!("cluaiz-app: {error}");
                return std::process::ExitCode::FAILURE;
            }
        }
        Err(error) => {
            eprintln!("cluaiz-app: {error}\nUsage: cluaiz-app [--web [--port N] [--no-open]]");
            return std::process::ExitCode::from(2);
        }
    }
    std::process::ExitCode::SUCCESS
}
