use std::ffi::OsString;

const DEFAULT_WEB_PORT: u16 = 1420;
pub const RESERVED_ENGINE_PORT: u16 = 8000;

#[derive(Debug, PartialEq, Eq)]
pub struct WebOptions {
    pub port: u16,
    pub open: bool,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Mode {
    Desktop,
    Web(WebOptions),
}

pub fn parse(args: impl IntoIterator<Item = OsString>) -> Result<Mode, &'static str> {
    let mut args = args.into_iter();
    let Some(first) = args.next() else { return Ok(Mode::Desktop); };
    if first != "--web" {
        return Err("Expected --web as the first argument.");
    }

    let mut port = None;
    let mut open = true;
    while let Some(arg) = args.next() {
        match arg.to_str() {
            Some("--port") if port.is_none() => {
                let value = args.next().and_then(|value| value.into_string().ok())
                    .and_then(|value| value.parse::<u16>().ok()).filter(|value| *value >= 1024)
                    .ok_or("--port requires a number from 1024 to 65535.")?;
                port = Some(value);
            }
            Some("--no-open") if open => open = false,
            _ => return Err("Unknown or repeated web option."),
        }
    }
    Ok(Mode::Web(WebOptions { port: port.unwrap_or(DEFAULT_WEB_PORT), open }))
}
