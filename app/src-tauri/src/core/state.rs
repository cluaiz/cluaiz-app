use std::sync::Mutex;
use std::process::Child;
use tokio::sync::Mutex as AsyncMutex;
use tokio::io::WriteHalf;

#[cfg(windows)]
use tokio::net::windows::named_pipe::NamedPipeClient;

#[cfg(unix)]
use tokio::net::UnixStream;

pub enum IpcWriter {
    #[cfg(windows)]
    NamedPipe(WriteHalf<NamedPipeClient>),
    #[cfg(unix)]
    Unix(WriteHalf<UnixStream>),
}

pub struct EngineState {
    pub child_process: Mutex<Option<Child>>,
    pub pipe_tx: AsyncMutex<Option<IpcWriter>>,
}

impl Default for EngineState {
    fn default() -> Self {
        Self {
            child_process: Mutex::new(None),
            pipe_tx: AsyncMutex::new(None),
        }
    }
}
