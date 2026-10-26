use serde::Deserialize;
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

pub const MAX_DOCUMENT_BYTES: usize = 16 * 1024 * 1024;
pub const MAX_BOOTSTRAP_BYTES: usize = 64 * 1024;
pub const MAX_MESSAGE_BYTES: usize = 3 * 1024 * 1024;
const MAX_SURFACES: usize = 4;
pub const HOST_VIEW: &str = "main";
pub const BRIDGE_EVENT: &str = "cluaiz-extension-message";

#[derive(Clone, Copy, Deserialize)]
pub struct Bounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}
impl Bounds {
    pub fn validate(&self) -> Result<(), String> {
        const MAX_COORDINATE: f64 = 32768.0;
        if [self.x, self.y, self.width, self.height]
            .iter()
            .any(|n| !n.is_finite() || *n < 0.0 || *n > MAX_COORDINATE)
            || self.width < 1.0
            || self.height < 1.0
        {
            return Err("Invalid extension surface bounds".into());
        }
        Ok(())
    }
}
pub struct Surface {
    pub owner: String,
    pub parent: String,
    pub html: Vec<u8>,
    pub profile: std::path::PathBuf,
    pub floating: bool,
}
#[derive(Default)]
pub struct SurfaceState(pub Mutex<HashMap<String, Arc<Surface>>>);
impl SurfaceState {
    pub fn insert(&self, id: String, surface: Surface) -> Result<(), String> {
        let mut values = self
            .0
            .lock()
            .map_err(|_| "Extension surface state unavailable")?;
        if values.len() >= MAX_SURFACES {
            return Err("Too many open extension surfaces".into());
        }
        values.insert(id, Arc::new(surface));
        Ok(())
    }
    pub fn get(&self, id: &str) -> Result<Arc<Surface>, String> {
        self.0
            .lock()
            .map_err(|_| "Extension surface state unavailable")?
            .get(id)
            .cloned()
            .ok_or_else(|| "Extension surface is closed".into())
    }
    pub fn owned(&self, caller: &str, id: &str) -> Result<Arc<Surface>, String> {
        let surface = self.get(id)?;
        if caller != surface.owner {
            return Err("Extension surface belongs to another host".into());
        }
        Ok(surface)
    }
    pub fn remove(&self, id: &str) -> Result<Option<Arc<Surface>>, String> {
        Ok(self
            .0
            .lock()
            .map_err(|_| "Extension surface state unavailable")?
            .remove(id))
    }
}

pub fn validate_message(message: &str) -> Result<(), String> {
    if message.len() > MAX_MESSAGE_BYTES {
        return Err("Extension bridge message too large".into());
    }
    let value: serde_json::Value =
        serde_json::from_str(message).map_err(|_| "Invalid extension bridge JSON")?;
    if !value.is_object() {
        return Err("Extension bridge expects an object".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bounds_and_message_limits_reject_invalid_input() {
        assert!(Bounds {
            x: f64::NAN,
            y: 0.0,
            width: 20.0,
            height: 20.0
        }
        .validate()
        .is_err());
        assert!(validate_message("[]").is_err());
        assert!(validate_message(&"x".repeat(MAX_MESSAGE_BYTES + 1)).is_err());
        assert!(validate_message("{\"v\":1,\"type\":\"hello\"}").is_ok());
    }
    #[test]
    fn surface_ownership_is_not_taken_from_guest_input() {
        let state = SurfaceState::default();
        state
            .insert(
                "extension-one".into(),
                Surface {
                    owner: "main".into(),
                    parent: "main".into(),
                    html: vec![],
                    profile: "unused-test-profile".into(),
                    floating: false,
                },
            )
            .unwrap();
        assert!(state.owned("extension-two", "extension-one").is_err());
        assert!(state.owned("main", "extension-one").is_ok());
        assert!(state.remove("extension-one").unwrap().is_some());
        assert!(state.get("extension-one").is_err());
    }
}
