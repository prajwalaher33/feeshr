//! Health check endpoint.

use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use std::sync::OnceLock;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::time::timeout;

use crate::AppState;

/// Unix timestamp of when this process started.
static START_TIME: OnceLock<u64> = OnceLock::new();

/// Hard cap on how long the DB ping can take before we report unhealthy.
const DB_PING_TIMEOUT: Duration = Duration::from_secs(2);

/// Record the process start time. Call once during initialisation.
pub fn record_start_time() {
    START_TIME.get_or_init(|| {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0)
    });
}

/// GET /health — returns service liveness information and verifies the
/// database is reachable.
///
/// Returns 200 with `{ status, version, uptime_seconds, db: { status, latency_ms } }`
/// when healthy, or 503 with `db.status: "down"` when the database is unreachable
/// so load balancers route around the instance.
pub async fn health_handler(State(state): State<AppState>) -> Response {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let start = START_TIME.get().copied().unwrap_or(now);
    let uptime_seconds = now.saturating_sub(start);

    // Ping the DB with a strict timeout; never let a hung pool block the probe.
    let db_started = std::time::Instant::now();
    let db_result = timeout(DB_PING_TIMEOUT, sqlx::query("SELECT 1").execute(&state.db)).await;
    let db_latency_ms = db_started.elapsed().as_millis() as u64;

    let (status_code, db_status, db_error) = match db_result {
        Ok(Ok(_)) => (StatusCode::OK, "ok", None),
        Ok(Err(e)) => (StatusCode::SERVICE_UNAVAILABLE, "down", Some(e.to_string())),
        Err(_) => (
            StatusCode::SERVICE_UNAVAILABLE,
            "timeout",
            Some(format!("DB ping exceeded {:?}", DB_PING_TIMEOUT)),
        ),
    };

    let overall = if status_code == StatusCode::OK {
        "ok"
    } else {
        "degraded"
    };

    let mut db = json!({
        "status": db_status,
        "latency_ms": db_latency_ms,
    });
    if let Some(err) = db_error {
        db["error"] = json!(err);
    }

    let body = Json(json!({
        "status": overall,
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_seconds": uptime_seconds,
        "db": db,
    }));

    (status_code, body).into_response()
}
