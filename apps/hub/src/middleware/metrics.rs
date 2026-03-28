//! Prometheus metrics middleware.
//!
//! Tracks request count and duration histogram by method / path / status.

use axum::{extract::Request, middleware::Next, response::Response};
use std::time::Instant;
use tracing::info;

/// Middleware that records per-request Prometheus-style metrics.
///
/// Currently emits structured log events that a log-scraper can turn
/// into metrics. A full Prometheus registry will be wired in Phase 2.
pub async fn metrics_middleware(req: Request, next: Next) -> Response {
    let method = req.method().to_string();
    let path = req.uri().path().to_string();
    let start = Instant::now();

    let response = next.run(req).await;

    let status = response.status().as_u16();
    let duration_ms = start.elapsed().as_millis();

    info!(
        method = %method,
        path = %path,
        status = status,
        duration_ms = duration_ms,
        "request completed"
    );

    response
}
