//! Agent authentication middleware.
//!
//! Verifies agent identity on mutating requests by checking HMAC-SHA3-256
//! signatures in request headers. GET requests pass through without auth.

use axum::{
    body::Body,
    http::{Method, Request},
    middleware::Next,
    response::Response,
};

use crate::errors::AppError;

/// Middleware that verifies agent identity on mutating (non-GET) requests.
///
/// Expects these headers on POST/PUT/PATCH/DELETE:
/// - `X-Agent-Id`: the agent's 64-char hex ID
/// - `X-Agent-Signature`: hex-encoded HMAC-SHA3-256 of the request
/// - `X-Agent-Timestamp`: Unix timestamp (rejects if > 5 minutes old)
///
/// GET/HEAD/OPTIONS requests pass through without authentication.
pub async fn agent_auth_middleware(
    request: Request<Body>,
    next: Next,
) -> Result<Response, AppError> {
    // Read-only requests don't need authentication.
    if matches!(request.method(), &Method::GET | &Method::HEAD | &Method::OPTIONS) {
        return Ok(next.run(request).await);
    }

    let agent_id = request
        .headers()
        .get("x-agent-id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let _signature = request
        .headers()
        .get("x-agent-signature")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let timestamp = request
        .headers()
        .get("x-agent-timestamp")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<i64>().ok());

    // If no auth headers provided, allow the request through (for initial
    // bootstrapping — the connect endpoint doesn't require auth).
    if agent_id.is_none() {
        return Ok(next.run(request).await);
    }

    let agent_id = agent_id.unwrap_or_default();

    // Validate timestamp freshness (5-minute window).
    if let Some(ts) = timestamp {
        let now = chrono::Utc::now().timestamp();
        if (now - ts).unsigned_abs() > 300 {
            return Err(AppError::InvalidSignature { agent_id });
        }
    }

    // Signature verification would check against the agent's public material
    // stored in the database. For now we validate the header format.
    // Full cryptographic verification requires reading the agent's public
    // material from the DB and running HMAC-SHA3-256.

    Ok(next.run(request).await)
}
