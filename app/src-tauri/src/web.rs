use crate::launcher::{WebOptions, RESERVED_ENGINE_PORT};
use http_body_util::Full;
use hyper::body::{Bytes, Incoming};
use hyper::{header, service::service_fn, Method, Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use shell_desktop_lib::core::{engine::launch, state::EngineState};
use std::{convert::Infallible, io, sync::Arc};
use tokio::net::TcpListener;

async fn bind(port: u16, engine_port: u16) -> io::Result<TcpListener> {
    for candidate in port..=u16::MAX {
        if candidate == RESERVED_ENGINE_PORT || candidate == engine_port {
            continue;
        }
        match TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, candidate)).await {
            Ok(listener) => return Ok(listener),
            Err(error) if error.kind() == io::ErrorKind::AddrInUse => continue,
            Err(error) => return Err(error),
        }
    }
    Err(io::Error::new(
        io::ErrorKind::AddrInUse,
        "No free web port remains.",
    ))
}

fn content_type(path: &str) -> &'static str {
    match path.rsplit_once('.').map(|(_, ext)| ext) {
        Some("html") => "text/html; charset=utf-8",
        Some("js" | "mjs") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("json" | "map") => "application/json",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        Some("ico") => "image/x-icon",
        Some("woff") => "font/woff",
        Some("woff2") => "font/woff2",
        Some("wasm") => "application/wasm",
        _ => "application/octet-stream",
    }
}

fn response(
    request: Request<Incoming>,
    host: &str,
    context: &tauri::Context<tauri::Wry>,
) -> Response<Full<Bytes>> {
    if request
        .headers()
        .get(header::HOST)
        .and_then(|value| value.to_str().ok())
        != Some(host)
    {
        let mut reply = Response::new(Full::default());
        *reply.status_mut() = StatusCode::MISDIRECTED_REQUEST;
        return reply;
    }
    if !matches!(*request.method(), Method::GET | Method::HEAD) {
        let mut reply = Response::new(Full::default());
        *reply.status_mut() = StatusCode::METHOD_NOT_ALLOWED;
        return reply;
    }

    let path = request.uri().path();
    let path = if path == "/" { "/index.html" } else { path };
    let assets = context.assets();
    let asset = assets
        .get(&path.into())
        .map(|body| (path, body))
        .or_else(|| {
            let navigation = request
                .headers()
                .get(header::ACCEPT)
                .and_then(|value| value.to_str().ok())
                .is_some_and(|value| value.contains("text/html"));
            if !navigation
                || path
                    .rsplit('/')
                    .next()
                    .is_some_and(|segment| segment.contains('.'))
            {
                return None;
            }
            assets
                .get(&"/index.html".into())
                .map(|body| ("/index.html", body))
        });
    let Some((path, asset)) = asset else {
        let mut reply = Response::new(Full::default());
        *reply.status_mut() = StatusCode::NOT_FOUND;
        return reply;
    };
    let size = asset.len();
    let body = if request.method() == Method::HEAD {
        Bytes::new()
    } else {
        Bytes::from(asset.into_owned())
    };
    Response::builder()
        .header(header::CONTENT_TYPE, content_type(path))
        .header(header::CONTENT_LENGTH, size)
        .header("x-content-type-options", "nosniff")
        .body(Full::new(body))
        .expect("embedded asset headers are static or numeric")
}

async fn dispatch(
    request: Request<Incoming>,
    host: &str,
    context: &tauri::Context<tauri::Wry>,
    engine: &EngineState,
) -> Response<Full<Bytes>> {
    if request.uri().path() != "/__cluaiz/engine" {
        return response(request, host, context);
    }
    let trusted_host = request
        .headers()
        .get(header::HOST)
        .and_then(|value| value.to_str().ok())
        == Some(host);
    let origin = format!("http://{host}");
    let consent = request
        .headers()
        .get(header::ORIGIN)
        .and_then(|value| value.to_str().ok())
        == Some(origin.as_str())
        && request
            .headers()
            .get("x-cluaiz-install")
            .is_some_and(|value| value == "confirmed");
    let result = match *request.method() {
        Method::GET if trusted_host => launch::boot_http_engine(engine).await,
        Method::POST if trusted_host && consent => launch::install_http_engine(engine).await,
        _ => {
            return Response::builder()
                .status(StatusCode::FORBIDDEN)
                .body(Full::default())
                .expect("static response status")
        }
    };
    let (status, body) = match result {
        Ok(status) => (StatusCode::OK, serde_json::json!(status)),
        Err(message) => (
            StatusCode::SERVICE_UNAVAILABLE,
            serde_json::json!({ "error": message }),
        ),
    };
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::CACHE_CONTROL, "no-store")
        .body(Full::new(Bytes::from(body.to_string())))
        .expect("static response headers")
}

#[tokio::main]
pub async fn run(options: WebOptions) -> Result<(), Box<dyn std::error::Error>> {
    let context: tauri::Context<tauri::Wry> = tauri::generate_context!();
    if context.assets().get(&"/index.html".into()).is_none() {
        return Err("No embedded UI. Build the App with its custom-protocol feature.".into());
    }
    let listener = bind(options.port, launch::http_engine_port()).await?;
    let host = Arc::new(listener.local_addr()?.to_string());
    let engine = Arc::new(EngineState::default());
    let startup = engine.clone();
    tokio::spawn(async move {
        let _ = launch::boot_http_engine(&startup).await;
    });
    let url = format!("http://{host}");
    println!("Cluaiz App listening on {url}");
    if options.open {
        if let Err(error) = tauri_plugin_opener::open_url(&url, None::<&str>) {
            eprintln!("Could not open the browser: {error}");
        }
    }
    let context = Arc::new(context);
    let shutdown = tokio::signal::ctrl_c();
    tokio::pin!(shutdown);
    loop {
        tokio::select! {
            result = &mut shutdown => {
                engine.stop_owned();
                return Ok(result?);
            },
            result = listener.accept() => {
                let (socket, _) = result?;
                let host = host.clone();
                let context = context.clone();
                let engine = engine.clone();
                tokio::spawn(async move {
                    let service = service_fn(|request| async {
                        Ok::<_, Infallible>(dispatch(request, &host, &context, &engine).await)
                    });
                    let _ = hyper::server::conn::http1::Builder::new()
                        .serve_connection(TokioIo::new(socket), service).await;
                });
            }
        }
    }
}
