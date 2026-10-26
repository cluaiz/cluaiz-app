use super::surfaces::SurfaceState;
use tauri::{
    http::{header, Request, Response, StatusCode},
    Manager, UriSchemeContext,
};

pub const SCHEME: &str = "cluaiz-extension";
pub const DOCUMENT_CSP: &str = "default-src 'none'; script-src data:; style-src 'unsafe-inline' data:; img-src data: blob:; font-src data:; media-src data: blob:; connect-src ipc: http://ipc.localhost; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

/// A single immutable developer document, addressed by the native caller's label.
/// No package path or filesystem asset is resolved by this scheme.
pub fn document(
    context: UriSchemeContext<'_, tauri::Wry>,
    request: Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    let label = context.webview_label();
    let expected = format!("/{label}/index.html");
    let surface = context.app_handle().state::<SurfaceState>().get(label);
    let allowed = request.method() == "GET" && request.uri().path() == expected && surface.is_ok();
    let mut response = Response::new(if allowed {
        surface.map(|item| item.html.clone()).unwrap_or_default()
    } else {
        Vec::new()
    });
    *response.status_mut() = if allowed {
        StatusCode::OK
    } else {
        StatusCode::FORBIDDEN
    };
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        header::HeaderValue::from_static("text/html; charset=utf-8"),
    );
    response.headers_mut().insert(
        header::CONTENT_SECURITY_POLICY,
        header::HeaderValue::from_static(DOCUMENT_CSP),
    );
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        header::HeaderValue::from_static("no-store"),
    );
    response.headers_mut().insert(
        header::X_CONTENT_TYPE_OPTIONS,
        header::HeaderValue::from_static("nosniff"),
    );
    response
}

pub fn document_url(label: &str) -> Result<tauri::Url, String> {
    #[cfg(windows)]
    let value = format!("http://{SCHEME}.localhost/{label}/index.html");
    #[cfg(not(windows))]
    let value = format!("{SCHEME}://localhost/{label}/index.html");
    value
        .parse()
        .map_err(|_| "Invalid native extension URL".into())
}
