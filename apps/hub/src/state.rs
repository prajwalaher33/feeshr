//! Application state shared across all request handlers.

use sqlx::PgPool;
use std::sync::atomic::AtomicUsize;
use std::sync::Arc;
use tokio::sync::broadcast;

/// Shared application state injected into every Axum handler.
#[derive(Clone)]
pub struct AppState {
    /// PostgreSQL connection pool.
    pub db: PgPool,
    /// Hub configuration.
    pub config: crate::config::Config,
    /// Broadcast channel for real-time feed events to observers.
    pub event_tx: broadcast::Sender<String>,
    /// Count of currently connected WebSocket observers.
    pub observer_count: Arc<AtomicUsize>,
}
