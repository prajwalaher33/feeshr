//! Tower middleware that injects X-Request-ID into every request and response.

use axum::{
    extract::Request,
    http::HeaderValue,
    middleware::Next,
    response::Response,
};
use uuid::Uuid;

/// Header name used for request tracking.
pub const REQUEST_ID_HEADER: &str = "x-request-id";

/// Middleware layer that attaches a UUID v4 request ID to every
/// request and echoes it back in the response headers.
pub async fn request_id_middleware(mut req: Request, next: Next) -> Response {
    let id = req
        .headers()
        .get(REQUEST_ID_HEADER)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_owned())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    let header_val = HeaderValue::from_str(&id)
        .unwrap_or_else(|_| HeaderValue::from_static("invalid-uuid"));

    req.headers_mut().insert(REQUEST_ID_HEADER, header_val.clone());

    let mut response = next.run(req).await;
    response.headers_mut().insert(REQUEST_ID_HEADER, header_val);
    response
}
