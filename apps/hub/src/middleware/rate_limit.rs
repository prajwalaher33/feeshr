//! Per-agent rate limiting middleware.
//!
//! Uses an in-memory sliding window counter. Authenticated agents get
//! 100 requests/minute; anonymous requests get 30/minute.

use axum::{
    body::Body,
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::Mutex;

/// Maximum requests per minute for authenticated agents.
const AGENT_RATE_LIMIT: usize = 100;
/// Maximum requests per minute for anonymous requests.
const ANON_RATE_LIMIT: usize = 30;
/// Window duration in seconds.
const WINDOW_SECONDS: u64 = 60;

/// Shared rate limiter state.
#[derive(Clone, Default)]
pub struct RateLimiter {
    windows: Arc<Mutex<HashMap<String, Vec<Instant>>>>,
}

impl RateLimiter {
    /// Create a new rate limiter.
    pub fn new() -> Self {
        Self::default()
    }

    /// Check if the given key is within its rate limit.
    /// Returns the number of remaining requests, or None if exceeded.
    async fn check(&self, key: &str, limit: usize) -> Option<usize> {
        let mut windows = self.windows.lock().await;
        let now = Instant::now();
        let cutoff = now - std::time::Duration::from_secs(WINDOW_SECONDS);

        let entries = windows.entry(key.to_string()).or_default();
        entries.retain(|t| *t > cutoff);

        if entries.len() >= limit {
            None
        } else {
            entries.push(now);
            Some(limit - entries.len())
        }
    }
}

/// Rate limiting middleware.
///
/// Limits requests per agent (or per IP for anonymous requests) using
/// an in-memory sliding window. Returns 429 with Retry-After header
/// when the limit is exceeded.
pub async fn rate_limit_middleware(
    request: Request<Body>,
    next: Next,
) -> Response {
    // Use a static limiter shared across all requests.
    static LIMITER: std::sync::OnceLock<RateLimiter> = std::sync::OnceLock::new();
    let limiter = LIMITER.get_or_init(RateLimiter::new);

    let agent_id = request
        .headers()
        .get("x-agent-id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let (key, limit) = match &agent_id {
        Some(id) => (format!("agent:{id}"), AGENT_RATE_LIMIT),
        None => ("anon".to_string(), ANON_RATE_LIMIT),
    };

    match limiter.check(&key, limit).await {
        Some(_remaining) => next.run(request).await,
        None => {
            let body = json!({
                "error": "Rate limit exceeded. Try again in 60 seconds.",
                "retry_after": WINDOW_SECONDS,
            });
            (
                StatusCode::TOO_MANY_REQUESTS,
                [("Retry-After", "60")],
                axum::Json(body),
            )
                .into_response()
        }
    }
}
