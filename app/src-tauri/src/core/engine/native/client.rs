//! Request-owned HTTP/1 framing over OS IPC. No TCP connector or endpoint fallback.
use http_body_util::Full;
use hyper::{body::Bytes, Request, Response};
use hyper_util::rt::TokioIo;
use serde::Deserialize;
use tokio::io::{AsyncRead, AsyncWrite};

pub const MAX_REQUEST_BYTES: usize = 128 * 1024 * 1024;
pub const CONNECT_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(5);

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NativeRequest {
    pub method: String,
    pub path: String,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

pub struct ConnectionGuard(tokio::task::JoinHandle<()>);
impl Drop for ConnectionGuard {
    fn drop(&mut self) {
        self.0.abort();
    }
}
trait LocalIo: AsyncRead + AsyncWrite + Unpin + Send {}
impl<T: AsyncRead + AsyncWrite + Unpin + Send> LocalIo for T {}

pub fn build_request(input: NativeRequest, token: &str) -> Result<Request<Full<Bytes>>, String> {
    if input.body.len() > MAX_REQUEST_BYTES {
        return Err("Native request exceeds the 128 MiB bridge budget.".into());
    }
    let uri: hyper::Uri = input.path.parse().map_err(|_| "Invalid native API path.")?;
    if !input.path.starts_with('/')
        || input.path.starts_with("//")
        || input.path.contains('#')
        || uri.scheme().is_some()
        || uri.authority().is_some()
    {
        return Err("Native requests require an API-relative path.".into());
    }
    let method =
        hyper::Method::from_bytes(input.method.as_bytes()).map_err(|_| "Invalid native method.")?;
    let mut builder = Request::builder().method(method).uri(uri);
    for (name, value) in input.headers {
        // Host and framing/authentication are owned by the native connector.
        if [
            "authorization",
            "host",
            "connection",
            "content-length",
            "transfer-encoding",
            "upgrade",
            "proxy-authorization",
            "proxy-connection",
            "expect",
            "te",
            "trailer",
        ]
        .contains(&name.to_ascii_lowercase().as_str())
        {
            continue;
        }
        builder = builder.header(name, value);
    }
    builder
        .header("host", "cluaiz-native")
        .header("connection", "close")
        .header("authorization", format!("Bearer {}", token.trim()))
        .body(Full::new(Bytes::from(input.body)))
        .map_err(|e| e.to_string())
}

async fn connect(endpoint: &str) -> Result<Box<dyn LocalIo>, String> {
    #[cfg(windows)]
    {
        if !endpoint.starts_with(r"\\.\pipe\") {
            return Err("Expected a local Windows named pipe.".into());
        }
        let deadline = tokio::time::Instant::now() + CONNECT_TIMEOUT;
        loop {
            match tokio::net::windows::named_pipe::ClientOptions::new().open(endpoint) {
                Ok(stream) => return Ok(Box::new(stream)),
                Err(error)
                    if error.raw_os_error() == Some(231)
                        && tokio::time::Instant::now() < deadline =>
                {
                    tokio::time::sleep(std::time::Duration::from_millis(20)).await;
                }
                Err(error) => return Err(format!("Native Engine connection failed: {error}")),
            }
        }
    }
    #[cfg(unix)]
    {
        tokio::net::UnixStream::connect(endpoint)
            .await
            .map(|io| Box::new(io) as Box<dyn LocalIo>)
            .map_err(|error| format!("Native Engine connection failed: {error}"))
    }
    #[cfg(not(any(windows, unix)))]
    {
        let _ = endpoint;
        Err("Native Engine transport is unavailable on this platform.".into())
    }
}

pub async fn request(
    endpoint: &str,
    token: &str,
    input: NativeRequest,
) -> Result<(Response<hyper::body::Incoming>, ConnectionGuard), String> {
    let request = build_request(input, token)?;
    let stream = tokio::time::timeout(CONNECT_TIMEOUT, connect(endpoint))
        .await
        .map_err(|_| "Native Engine connection timed out.")??;
    let (mut sender, connection) = hyper::client::conn::http1::handshake(TokioIo::new(stream))
        .await
        .map_err(|e| e.to_string())?;
    let guard = ConnectionGuard(tokio::spawn(async move {
        let _ = connection.await;
    }));
    let response = sender
        .send_request(request)
        .await
        .map_err(|e| e.to_string())?;
    Ok((response, guard))
}
