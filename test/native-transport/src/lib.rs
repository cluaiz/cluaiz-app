//! Tests compile the actual App native owners without loading Tauri, models or a daemon.
#[path = "../../../app/src-tauri/src/core/engine/native/client.rs"]
pub mod client;
#[path = "../../../app/src-tauri/src/core/engine/native/requests.rs"]
pub mod requests;
#[path = "../../../app/src-tauri/src/core/state.rs"]
pub mod state;

#[cfg(test)]
mod cli_acceptance {
    use super::client::{self, NativeRequest};
    use http_body_util::BodyExt;

    async fn send(
        endpoint: &str,
        token: &str,
        path: &str,
        payload: Option<serde_json::Value>,
    ) -> (u16, String) {
        let request = NativeRequest {
            method: if payload.is_some() { "POST" } else { "GET" }.into(),
            path: path.into(),
            headers: vec![("content-type".into(), "application/json".into())],
            body: payload
                .map(|value| serde_json::to_vec(&value).unwrap())
                .unwrap_or_default(),
        };
        let (response, _connection) = client::request(endpoint, token, request).await.unwrap();
        let status = response.status().as_u16();
        let body = response.into_body().collect().await.unwrap().to_bytes();
        (status, String::from_utf8(body.to_vec()).unwrap())
    }

    #[tokio::test]
    #[ignore = "Requires an explicitly supplied isolated native-only CLI owned by the acceptance runner"]
    async fn actual_cli_acceptance() {
        let endpoint =
            std::env::var("CLUAIZ_NATIVE_ACCEPT_ENDPOINT").expect("isolated native endpoint");
        let home = std::path::PathBuf::from(
            std::env::var("CLUAIZ_NATIVE_ACCEPT_HOME").expect("isolated native home"),
        );
        let token = std::fs::read_to_string(home.join("session.token")).unwrap();
        let (health, body) = send(&endpoint, &token, "/health", None).await;
        assert_eq!(health, 200);
        assert!(serde_json::from_str::<serde_json::Value>(&body).is_ok());
        let (unauthorized, _) = send(&endpoint, "wrong-test-token", "/health", None).await;
        assert_eq!(unauthorized, 401);
        let (models, body) = send(&endpoint, &token, "/v1/models", None).await;
        assert_eq!(models, 200);
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&body).unwrap()["data"]
                .as_array()
                .unwrap()
                .len(),
            0
        );
        let (ingest, body) = send(&endpoint, &token, "/v1/ingest", Some(serde_json::json!({
            "source":"data:text/plain;base64,SGVsbG8gZnJvbSBuYXRpdmUu", "output_controls":{"return_text":true}
        }))).await;
        assert_eq!(ingest, 200, "{body}");
        assert!(body.contains("Hello from native."), "{body}");
        println!(
            "native_cli: health=200 auth=401 models=200 installed=0 ingest=200 extracted_text=true"
        );
    }
}

#[cfg(test)]
mod tests {
    use super::{
        client::{self, NativeRequest, MAX_REQUEST_BYTES},
        state::PendingEngine,
    };
    use std::{
        process::{Command, Stdio},
        sync::{Arc, Mutex},
        time::{Duration, Instant},
    };

    pub fn request(path: &str) -> NativeRequest {
        NativeRequest {
            method: "GET".into(),
            path: path.into(),
            headers: vec![],
            body: vec![],
        }
    }
    pub fn error<T>(result: Result<T, String>) -> String {
        match result {
            Err(error) => error,
            Ok(_) => panic!("expected failure"),
        }
    }

    #[test]
    fn request_validation_keeps_auth_and_framing_native_owned() {
        let mut input = request("/v1/models?detail=true");
        input.headers = vec![
            ("Authorization".into(), "Bearer attacker".into()),
            ("Host".into(), "foreign.example".into()),
            ("Transfer-Encoding".into(), "chunked".into()),
            ("Content-Length".into(), "999".into()),
            ("Accept".into(), "application/json".into()),
        ];
        let built = client::build_request(input, " native-token \n").unwrap();
        assert_eq!(built.uri().to_string(), "/v1/models?detail=true");
        assert_eq!(built.headers()["authorization"], "Bearer native-token");
        assert_eq!(built.headers()["host"], "cluaiz-native");
        assert_eq!(built.headers()["connection"], "close");
        assert_eq!(built.headers()["accept"], "application/json");
        assert!(!built.headers().contains_key("transfer-encoding"));
        assert!(!built.headers().contains_key("content-length"));
        for path in [
            "https://foreign.example/path",
            "//foreign.example/path",
            "relative/path",
            "/v1/models#fragment",
        ] {
            assert!(
                client::build_request(request(path), "token").is_err(),
                "{path}"
            );
        }
        let mut bad_header = request("/v1/models");
        bad_header
            .headers
            .push(("bad\r\nheader".into(), "value".into()));
        assert!(client::build_request(bad_header, "token").is_err());
        let mut bad_method = request("/v1/models");
        bad_method.method = "GET\r\nPOST".into();
        assert!(client::build_request(bad_method, "token").is_err());
    }

    #[test]
    fn oversized_request_is_rejected_before_any_connection() {
        let mut input = request("/v1/upload");
        input.body = vec![0; MAX_REQUEST_BYTES + 1];
        assert!(error(client::build_request(input, "token")).contains("128 MiB"));
    }

    #[test]
    #[ignore = "Bounded child process fixture, invoked only by the ownership test"]
    fn pending_child_fixture() {
        if std::env::var_os("CLUAIZ_NATIVE_TEST_CHILD").is_some() {
            std::thread::sleep(Duration::from_secs(15));
        }
    }

    #[test]
    fn cancelled_readiness_kills_its_child_and_committed_readiness_preserves_it() {
        fn child() -> std::process::Child {
            let mut command = Command::new(std::env::current_exe().unwrap());
            command
                .args(["--ignored", "--exact", "tests::pending_child_fixture"])
                .env("CLUAIZ_NATIVE_TEST_CHILD", "1")
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null());
            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                command.creation_flags(0x08000000);
            }
            command.spawn().unwrap()
        }
        let first = child();
        let pid = first.id();
        let process = Arc::new(Mutex::new(Some(first)));
        let before = Instant::now();
        drop(PendingEngine::new(process.clone(), pid));
        assert!(process.lock().unwrap().is_none());
        assert!(
            before.elapsed() < Duration::from_secs(5),
            "child must be killed, not awaited for its 15s fallback exit"
        );
        let second = child();
        let pid = second.id();
        *process.lock().unwrap() = Some(second);
        PendingEngine::new(process.clone(), pid).commit();
        let mut child = process
            .lock()
            .unwrap()
            .take()
            .expect("committed child is still owned");
        let alive = child.try_wait().unwrap().is_none();
        let _ = child.kill();
        let _ = child.wait();
        assert!(alive);
    }
}

#[cfg(all(test, windows))]
mod windows_pipe {
    use super::{
        client::{self},
        requests::{NativeRequests, MAX_ACTIVE_REQUESTS, MAX_CHUNK_BYTES},
        tests::{error, request},
    };
    use http_body_util::{combinators::UnsyncBoxBody, BodyExt, Full};
    use hyper::{
        body::{Body, Bytes, Frame, Incoming},
        service::service_fn,
        Request, Response,
    };
    use hyper_util::rt::TokioIo;
    use std::{
        convert::Infallible,
        future::Future,
        io,
        pin::Pin,
        sync::{Arc, Mutex},
        task::{Context, Poll},
        time::Duration,
    };
    use tokio::{
        io::{AsyncReadExt, AsyncWriteExt},
        net::windows::named_pipe::ServerOptions,
        sync::{mpsc, oneshot},
        task::{AbortHandle, JoinHandle},
    };

    type TestBody = UnsyncBoxBody<Bytes, io::Error>;
    fn full(data: impl Into<Bytes>) -> TestBody {
        Full::new(data.into())
            .map_err(|never| match never {})
            .boxed_unsync()
    }
    struct StreamBody {
        receiver: mpsc::Receiver<Result<Frame<Bytes>, io::Error>>,
        dropped: Option<oneshot::Sender<()>>,
    }
    impl Body for StreamBody {
        type Data = Bytes;
        type Error = io::Error;
        fn poll_frame(
            mut self: Pin<&mut Self>,
            context: &mut Context<'_>,
        ) -> Poll<Option<Result<Frame<Bytes>, io::Error>>> {
            self.receiver.poll_recv(context)
        }
    }
    impl Drop for StreamBody {
        fn drop(&mut self) {
            if let Some(sender) = self.dropped.take() {
                let _ = sender.send(());
            }
        }
    }
    struct Fixture {
        endpoint: String,
        accept: JoinHandle<()>,
        connections: Arc<Mutex<Vec<AbortHandle>>>,
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            self.accept.abort();
            for connection in self.connections.lock().unwrap().drain(..) {
                connection.abort();
            }
        }
    }
    fn fixture<F, Fut>(handler: F) -> Fixture
    where
        F: Fn(Request<Incoming>) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Response<TestBody>> + Send + 'static,
    {
        let endpoint = format!(r"\\.\pipe\cluaiz-test-{}", uuid::Uuid::new_v4().simple());
        let first = ServerOptions::new()
            .first_pipe_instance(true)
            .create(&endpoint)
            .unwrap();
        let connections = Arc::new(Mutex::new(Vec::new()));
        let handles = connections.clone();
        let address = endpoint.clone();
        let handler = Arc::new(handler);
        let accept = tokio::spawn(async move {
            let mut pipe = first;
            loop {
                pipe.connect().await.unwrap();
                let connected = pipe;
                pipe = ServerOptions::new().create(&address).unwrap();
                let handler = handler.clone();
                let connection = tokio::spawn(async move {
                    let service = service_fn(move |request| {
                        let handler = handler.clone();
                        async move { Ok::<_, Infallible>(handler(request).await) }
                    });
                    let _ = hyper::server::conn::http1::Builder::new()
                        .serve_connection(TokioIo::new(connected), service)
                        .await;
                });
                handles.lock().unwrap().push(connection.abort_handle());
            }
        });
        Fixture {
            endpoint,
            accept,
            connections,
        }
    }
    async fn bounded<T>(future: impl Future<Output = T>) -> T {
        tokio::time::timeout(Duration::from_secs(3), future)
            .await
            .expect("fixture operation timed out")
    }
    struct Peer {
        path: String,
        frames: mpsc::Sender<Result<Frame<Bytes>, io::Error>>,
        dropped: oneshot::Receiver<()>,
    }
    fn streaming() -> (Fixture, mpsc::UnboundedReceiver<Peer>) {
        let (peers, receiver) = mpsc::unbounded_channel();
        let server = fixture(move |request| {
            let peers = peers.clone();
            async move {
                let (sender, frames) = mpsc::channel(2);
                let (drop_tx, drop_rx) = oneshot::channel();
                peers
                    .send(Peer {
                        path: request.uri().path().into(),
                        frames: sender,
                        dropped: drop_rx,
                    })
                    .unwrap();
                Response::builder()
                    .header("content-type", "text/event-stream")
                    .body(
                        StreamBody {
                            receiver: frames,
                            dropped: Some(drop_tx),
                        }
                        .boxed_unsync(),
                    )
                    .unwrap()
            }
        });
        (server, receiver)
    }
    fn start(manager: &NativeRequests, server: &Fixture, owner: &str, path: &str) -> String {
        manager
            .start(
                owner,
                server.endpoint.clone(),
                "host-token".into(),
                request(path),
            )
            .unwrap()
    }

    #[tokio::test]
    async fn actual_pipe_preserves_headers_binary_and_bounded_manager_chunks() {
        let payload: Vec<u8> = (0..(MAX_CHUNK_BYTES * 3 + 17))
            .map(|i| (i % 251) as u8)
            .collect();
        let expected = payload.clone();
        let (seen, mut received) = mpsc::unbounded_channel();
        let server = fixture(move |request| {
            let payload = payload.clone();
            let seen = seen.clone();
            async move {
                let token = request.headers()["authorization"]
                    .to_str()
                    .unwrap()
                    .to_string();
                let body = request.into_body().collect().await.unwrap().to_bytes();
                seen.send((token, body.to_vec())).unwrap();
                Response::builder()
                    .status(206)
                    .header("content-type", "application/octet-stream")
                    .header("x-source", "native-pipe")
                    .body(full(payload))
                    .unwrap()
            }
        });
        let manager = NativeRequests::default();
        let mut input = request("/binary");
        input.method = "POST".into();
        input.body = vec![0, 255, 128];
        let id = manager
            .start("main", server.endpoint.clone(), "host-token".into(), input)
            .unwrap();
        let head = bounded(manager.head("main", &id)).await.unwrap();
        assert_eq!(head.status, 206);
        assert!(head
            .headers
            .contains(&("x-source".into(), "native-pipe".into())));
        assert_eq!(
            bounded(received.recv()).await.unwrap(),
            ("Bearer host-token".into(), vec![0, 255, 128])
        );
        let mut actual = Vec::new();
        loop {
            let chunk = bounded(manager.read("main", &id)).await.unwrap();
            assert!(chunk.data.len() <= MAX_CHUNK_BYTES);
            actual.extend(chunk.data);
            if chunk.done {
                break;
            }
        }
        assert_eq!(actual, expected);
        assert!(
            !manager.cancel("main", &id).unwrap(),
            "normal EOF already releases its slot"
        );
    }

    #[tokio::test]
    async fn pending_read_cancel_is_failure_and_wrong_owner_cannot_read_or_cancel() {
        let (server, mut peers) = streaming();
        let manager = Arc::new(NativeRequests::default());
        let id = start(&manager, &server, "main", "/pending");
        bounded(manager.head("main", &id)).await.unwrap();
        let _peer = bounded(peers.recv()).await.unwrap();
        assert!(error(manager.head("other", &id).await).contains("this window"));
        assert!(error(manager.read("other", &id).await).contains("this window"));
        assert!(!manager.cancel("other", &id).unwrap());
        let owned = manager.clone();
        let read_id = id.clone();
        let mut pending = tokio::spawn(async move { owned.read("main", &read_id).await });
        assert!(
            tokio::time::timeout(Duration::from_millis(20), &mut pending)
                .await
                .is_err()
        );
        assert!(manager.cancel("main", &id).unwrap());
        assert!(error(bounded(pending).await.unwrap()).contains("cancelled"));
        assert!(!manager.cancel("main", &id).unwrap());
    }

    #[tokio::test]
    async fn closing_one_owner_does_not_cancel_another_owners_stream() {
        let (server, mut peers) = streaming();
        let manager = Arc::new(NativeRequests::default());
        let a = start(&manager, &server, "main", "/a");
        bounded(manager.head("main", &a)).await.unwrap();
        let peer_a = bounded(peers.recv()).await.unwrap();
        let b = start(&manager, &server, "second", "/b");
        bounded(manager.head("second", &b)).await.unwrap();
        let peer_b = bounded(peers.recv()).await.unwrap();
        let owned = manager.clone();
        let id = a.clone();
        let mut pending = tokio::spawn(async move { owned.read("main", &id).await });
        assert!(
            tokio::time::timeout(Duration::from_millis(20), &mut pending)
                .await
                .is_err()
        );
        manager.cancel_owner("main");
        assert!(error(bounded(pending).await.unwrap()).contains("window closed"));
        assert_eq!(peer_a.path, "/a");
        assert_eq!(peer_b.path, "/b");
        peer_b
            .frames
            .send(Ok(Frame::data(Bytes::from_static(b"data: alive\n\n"))))
            .await
            .unwrap();
        let chunk = bounded(manager.read("second", &b)).await.unwrap();
        assert_eq!(chunk.data, b"data: alive\n\n");
        assert!(!chunk.done);
        assert!(manager.cancel("second", &b).unwrap());
    }

    #[tokio::test]
    async fn connection_guard_drop_closes_only_its_connection() {
        let (server, mut peers) = streaming();
        let (a, guard_a) = bounded(client::request(&server.endpoint, "token", request("/a")))
            .await
            .unwrap();
        let peer_a = bounded(peers.recv()).await.unwrap();
        let (b, guard_b) = bounded(client::request(&server.endpoint, "token", request("/b")))
            .await
            .unwrap();
        let peer_b = bounded(peers.recv()).await.unwrap();
        drop(a);
        drop(guard_a);
        let _ = peer_a
            .frames
            .send(Ok(Frame::data(Bytes::from_static(b"closed"))))
            .await;
        bounded(peer_a.dropped).await.unwrap();
        peer_b
            .frames
            .send(Ok(Frame::data(Bytes::from_static(b"still-open"))))
            .await
            .unwrap();
        let mut body_b = b.into_body();
        assert_eq!(
            bounded(body_b.frame())
                .await
                .unwrap()
                .unwrap()
                .into_data()
                .unwrap(),
            Bytes::from_static(b"still-open")
        );
        drop(body_b);
        drop(guard_b);
    }

    #[tokio::test]
    async fn failed_native_connect_is_explicit_and_manager_capacity_is_bounded() {
        let result = client::request("http://127.0.0.1:8000", "token", request("/health")).await;
        assert!(error(result).contains("local Windows named pipe"));
        let manager = NativeRequests::default();
        let endpoint = format!(r"\\.\pipe\cluaiz-missing-{}", uuid::Uuid::new_v4().simple());
        let mut ids = Vec::new();
        for _ in 0..MAX_ACTIVE_REQUESTS {
            ids.push(
                manager
                    .start("main", endpoint.clone(), "token".into(), request("/health"))
                    .unwrap(),
            );
        }
        assert!(
            error(manager.start("main", endpoint.clone(), "token".into(), request("/health")))
                .contains("limit reached")
        );
        manager.cancel_owner("main");
        let id = manager
            .start("main", endpoint, "token".into(), request("/health"))
            .unwrap();
        assert!(error(bounded(manager.head("main", &id)).await).contains("connection failed"));
    }

    #[tokio::test]
    async fn truncated_http_body_over_pipe_is_error_not_clean_eof() {
        let endpoint = format!(
            r"\\.\pipe\cluaiz-truncate-{}",
            uuid::Uuid::new_v4().simple()
        );
        let pipe = ServerOptions::new()
            .first_pipe_instance(true)
            .create(&endpoint)
            .unwrap();
        let writer = tokio::spawn(async move {
            pipe.connect().await.unwrap();
            let mut pipe = pipe;
            let mut request = [0; 4096];
            pipe.read(&mut request).await.unwrap();
            pipe.write_all(
                b"HTTP/1.1 200 OK\r\nContent-Length: 10\r\nConnection: close\r\n\r\nabc",
            )
            .await
            .unwrap();
            pipe.flush().await.unwrap();
        });
        let manager = NativeRequests::default();
        let id = manager
            .start("main", endpoint, "token".into(), request("/truncated"))
            .unwrap();
        bounded(manager.head("main", &id)).await.unwrap();
        let mut saw_error = false;
        for _ in 0..3 {
            match bounded(manager.read("main", &id)).await {
                Err(_) => {
                    saw_error = true;
                    break;
                }
                Ok(chunk) => assert!(!chunk.done, "truncation must not become successful EOF"),
            }
        }
        assert!(saw_error);
        bounded(writer).await.unwrap();
    }
}
