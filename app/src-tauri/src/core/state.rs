use std::process::Child;
use std::sync::{Arc, Mutex};
#[derive(Clone)]
pub struct NativeConfig {
    pub endpoint: String,
    pub home: std::path::PathBuf,
}

pub struct EngineState {
    pub child_process: Arc<Mutex<Option<Child>>>,
    pub native_config: Mutex<Option<NativeConfig>>,
    pub boot_lock: tokio::sync::Mutex<()>,
    #[cfg(windows)]
    pub process_job: Mutex<Option<std::os::windows::io::OwnedHandle>>,
}

impl Default for EngineState {
    fn default() -> Self {
        Self {
            child_process: Arc::new(Mutex::new(None)),
            native_config: Mutex::new(None),
            boot_lock: tokio::sync::Mutex::new(()),
            #[cfg(windows)]
            process_job: Mutex::new(None),
        }
    }
}

/// A cancelled/failed readiness future cannot leave its just-spawned Engine behind.
pub struct PendingEngine {
    process: Arc<Mutex<Option<Child>>>,
    pid: u32,
    ready: bool,
}
impl PendingEngine {
    pub fn new(process: Arc<Mutex<Option<Child>>>, pid: u32) -> Self {
        Self {
            process,
            pid,
            ready: false,
        }
    }
    pub fn commit(mut self) {
        self.ready = true;
    }
}
impl Drop for PendingEngine {
    fn drop(&mut self) {
        if self.ready {
            return;
        }
        if let Ok(mut process) = self.process.lock() {
            if process.as_ref().is_some_and(|child| child.id() == self.pid) {
                if let Some(mut child) = process.take() {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        }
    }
}
