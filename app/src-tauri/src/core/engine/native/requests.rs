//! Bounded pull-based response ownership. An ID never authorizes another window.
use super::client::{self, NativeRequest};
use http_body_util::BodyExt;
use serde::Serialize;
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};
use tokio::sync::{mpsc, oneshot, Mutex as AsyncMutex};

pub const MAX_CHUNK_BYTES: usize = 64 * 1024;
pub const MAX_ACTIVE_REQUESTS: usize = 32;
const IDLE_RETENTION: Duration = Duration::from_secs(120);
const MAX_REQUEST_LIFETIME: Duration = Duration::from_secs(3600);

#[derive(Serialize)]
pub struct NativeHead {
    pub status: u16,
    pub headers: Vec<(String, String)>,
}
#[derive(Serialize)]
pub struct NativeChunk {
    pub data: Vec<u8>,
    pub done: bool,
}
type HeadReceiver = oneshot::Receiver<Result<NativeHead, String>>;
struct Slot {
    owner: String,
    created: Instant,
    last_read: Mutex<Instant>,
    headed: Arc<AtomicBool>,
    readers: AtomicUsize,
    failure: Arc<Mutex<Option<String>>>,
    head: AsyncMutex<Option<HeadReceiver>>,
    body: AsyncMutex<mpsc::Receiver<Result<Vec<u8>, String>>>,
    task: tokio::task::AbortHandle,
}
impl Drop for Slot {
    fn drop(&mut self) {
        self.task.abort();
    }
}
struct Reading(Arc<Slot>);
impl Drop for Reading {
    fn drop(&mut self) {
        if let Ok(mut time) = self.0.last_read.lock() {
            *time = Instant::now();
        }
        self.0.readers.fetch_sub(1, Ordering::Relaxed);
    }
}
#[derive(Default)]
pub struct NativeRequests {
    slots: Mutex<HashMap<String, Arc<Slot>>>,
}

impl NativeRequests {
    pub fn start(
        &self,
        owner: &str,
        endpoint: String,
        token: String,
        request: NativeRequest,
    ) -> Result<String, String> {
        let mut slots = self
            .slots
            .lock()
            .map_err(|_| "Native request state is unavailable.")?;
        slots.retain(|_, slot| {
            let keep = slot.created.elapsed() < MAX_REQUEST_LIFETIME
                && (!slot.headed.load(Ordering::Relaxed)
                    || slot.readers.load(Ordering::Relaxed) > 0
                    || slot
                        .last_read
                        .lock()
                        .map(|time| time.elapsed() < IDLE_RETENTION)
                        .unwrap_or(false));
            if !keep {
                if let Ok(mut failure) = slot.failure.lock() {
                    *failure = Some("Native request expired.".into());
                }
                slot.task.abort();
            }
            keep
        });
        if slots.len() >= MAX_ACTIVE_REQUESTS {
            return Err(
                "Native request limit reached; close or cancel an existing response.".into(),
            );
        }
        let id = uuid::Uuid::new_v4().simple().to_string();
        let (head_tx, head_rx) = oneshot::channel();
        let (body_tx, body_rx) = mpsc::channel(1);
        let headed = Arc::new(AtomicBool::new(false));
        let failure = Arc::new(Mutex::new(None));
        let worker_headed = headed.clone();
        let worker_failure = failure.clone();
        let task = tokio::spawn(async move {
            let operation = async {
                match client::request(&endpoint, &token, request).await {
                    Err(error) => {
                        let _ = head_tx.send(Err(error));
                    }
                    Ok((response, _connection)) => {
                        let head = NativeHead {
                            status: response.status().as_u16(),
                            headers: response
                                .headers()
                                .iter()
                                .filter_map(|(name, value)| {
                                    value
                                        .to_str()
                                        .ok()
                                        .map(|v| (name.to_string(), v.to_string()))
                                })
                                .collect(),
                        };
                        if head_tx.send(Ok(head)).is_err() {
                            return;
                        }
                        worker_headed.store(true, Ordering::Relaxed);
                        let mut body = response.into_body();
                        while let Some(frame) = body.frame().await {
                            match frame {
                                Err(error) => {
                                    let _ = body_tx.send(Err(error.to_string())).await;
                                    break;
                                }
                                Ok(frame) => {
                                    if let Ok(data) = frame.into_data() {
                                        for chunk in data.chunks(MAX_CHUNK_BYTES) {
                                            match tokio::time::timeout(
                                                IDLE_RETENTION,
                                                body_tx.send(Ok(chunk.to_vec())),
                                            )
                                            .await
                                            {
                                                Ok(Ok(())) => {}
                                                _ => {
                                                    if let Ok(mut failure) = worker_failure.lock() {
                                                        *failure = Some(
                                                            "Native response reader expired."
                                                                .into(),
                                                        );
                                                    }
                                                    return;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            };
            if tokio::time::timeout(MAX_REQUEST_LIFETIME, operation)
                .await
                .is_err()
            {
                if let Ok(mut failure) = worker_failure.lock() {
                    *failure = Some("Native request lifetime exceeded.".into());
                }
            }
        });
        slots.insert(
            id.clone(),
            Arc::new(Slot {
                owner: owner.into(),
                created: Instant::now(),
                last_read: Mutex::new(Instant::now()),
                headed,
                readers: AtomicUsize::new(0),
                failure,
                head: AsyncMutex::new(Some(head_rx)),
                body: AsyncMutex::new(body_rx),
                task: task.abort_handle(),
            }),
        );
        Ok(id)
    }
    fn owned(&self, owner: &str, id: &str) -> Result<Arc<Slot>, String> {
        let slots = self
            .slots
            .lock()
            .map_err(|_| "Native request state is unavailable.")?;
        let slot = slots
            .get(id)
            .filter(|slot| slot.owner == owner)
            .ok_or("Native request is unavailable for this window.")?
            .clone();
        if let Ok(mut time) = slot.last_read.lock() {
            *time = Instant::now();
        }
        Ok(slot)
    }
    pub async fn head(&self, owner: &str, id: &str) -> Result<NativeHead, String> {
        let slot = self.owned(owner, id)?;
        slot.readers.fetch_add(1, Ordering::Relaxed);
        let _reading = Reading(slot.clone());
        let receiver = slot
            .head
            .lock()
            .await
            .take()
            .ok_or("Native response headers already consumed.")?;
        match receiver.await {
            Ok(Ok(head)) => Ok(head),
            Ok(Err(error)) => {
                self.remove(owner, id, None)?;
                Err(error)
            }
            Err(error) => {
                self.remove(owner, id, None)?;
                Err(format!("Native response failed before headers: {error}"))
            }
        }
    }
    pub async fn read(&self, owner: &str, id: &str) -> Result<NativeChunk, String> {
        let slot = self.owned(owner, id)?;
        slot.readers.fetch_add(1, Ordering::Relaxed);
        let _reading = Reading(slot.clone());
        let next = slot.body.lock().await.recv().await;
        match next {
            Some(Ok(data)) => Ok(NativeChunk { data, done: false }),
            Some(Err(error)) => {
                self.remove(owner, id, None)?;
                Err(error)
            }
            None => {
                self.remove(owner, id, None)?;
                if let Some(error) = slot
                    .failure
                    .lock()
                    .map_err(|_| "Native response state is unavailable.")?
                    .clone()
                {
                    return Err(error);
                }
                Ok(NativeChunk {
                    data: vec![],
                    done: true,
                })
            }
        }
    }
    pub fn cancel(&self, owner: &str, id: &str) -> Result<bool, String> {
        self.remove(owner, id, Some("Native request cancelled."))
    }
    fn remove(&self, owner: &str, id: &str, reason: Option<&str>) -> Result<bool, String> {
        let mut slots = self
            .slots
            .lock()
            .map_err(|_| "Native request state is unavailable.")?;
        if slots.get(id).is_some_and(|slot| slot.owner == owner) {
            if let Some(slot) = slots.remove(id) {
                if let Some(reason) = reason {
                    if let Ok(mut failure) = slot.failure.lock() {
                        *failure = Some(reason.into());
                    }
                }
                slot.task.abort();
            }
            return Ok(true);
        }
        Ok(false)
    }
    pub fn cancel_owner(&self, owner: &str) {
        if let Ok(mut slots) = self.slots.lock() {
            slots.retain(|_, slot| {
                if slot.owner == owner {
                    if let Ok(mut failure) = slot.failure.lock() {
                        *failure = Some("Native host window closed.".into());
                    }
                    slot.task.abort();
                    return false;
                }
                true
            });
        }
    }
}
