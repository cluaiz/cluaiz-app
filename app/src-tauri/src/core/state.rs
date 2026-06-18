use std::sync::Mutex;
use std::process::Child;
use tokio::sync::Mutex as AsyncMutex;

#[cfg(windows)]
use tokio::net::windows::named_pipe::NamedPipeClient;
#[cfg(windows)]
use tokio::io::WriteHalf;

pub struct EngineState {
    pub child_process: Mutex<Option<Child>>,
    #[cfg(windows)]
    pub pipe_tx: AsyncMutex<Option<WriteHalf<NamedPipeClient>>>,
}

impl Default for EngineState {
    fn default() -> Self {
        Self {
            child_process: Mutex::new(None),
            #[cfg(windows)]
            pipe_tx: AsyncMutex::new(None),
        }
    }
}
