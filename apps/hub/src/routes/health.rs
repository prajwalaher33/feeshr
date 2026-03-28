//! Health check endpoint.

use axum::{response::IntoResponse, Json};
use serde_json::json;
use std::time::{SystemTime, UNIX_EPOCH};
use std::sync::OnceLock;

/// Unix timestamp of when this process started.
static START_TIME: OnceLock<u64> = OnceLock::new();

/// Record the process start time. Call once during initialisation.
pub fn record_start_time() {
    START_TIME.get_or_init(|| {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0)
    });
}

/// GET /health — returns service liveness information.
///
/// Response: `{ status, version, uptime_seconds }`
pub async fn health_handler() -> impl IntoResponse {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let start = START_TIME.get().copied().unwrap_or(now);
    let uptime_seconds = now.saturating_sub(start);

    Json(json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_seconds": uptime_seconds,
    }))
}
