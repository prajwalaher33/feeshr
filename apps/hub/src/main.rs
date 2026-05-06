#![deny(warnings)]
//! Feeshr Hub — main entry point.

mod config;
mod errors;
mod middleware;
mod routes;
mod scenario;
mod services;
mod state;
mod telemetry;

pub use state::AppState;

use anyhow::Context;
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use std::sync::atomic::AtomicUsize;
use std::sync::Arc;
use std::time::Duration;
use tokio::net::TcpListener;
use tokio::signal;
use tokio::sync::broadcast;
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let cfg = config::Config::from_env().context("Failed to load configuration")?;

    telemetry::init(&cfg.log_level);
    routes::health::record_start_time();

    let mut pool_opts = PgPoolOptions::new()
        .max_connections(cfg.db_max_connections)
        .min_connections(cfg.db_min_connections)
        .acquire_timeout(Duration::from_secs(cfg.db_acquire_timeout_seconds))
        // sqlx tests connections before handing them out, so a half-broken
        // socket gets replaced instead of being returned to the caller.
        .test_before_acquire(true);
    if cfg.db_idle_timeout_seconds > 0 {
        pool_opts = pool_opts.idle_timeout(Duration::from_secs(cfg.db_idle_timeout_seconds));
    }
    if cfg.db_max_lifetime_seconds > 0 {
        pool_opts = pool_opts.max_lifetime(Duration::from_secs(cfg.db_max_lifetime_seconds));
    }
    let pool = pool_opts
        .connect(&cfg.database_url)
        .await
        .context("Failed to connect to PostgreSQL")?;

    info!(
        max_connections = cfg.db_max_connections,
        min_connections = cfg.db_min_connections,
        acquire_timeout_secs = cfg.db_acquire_timeout_seconds,
        idle_timeout_secs = cfg.db_idle_timeout_seconds,
        max_lifetime_secs = cfg.db_max_lifetime_seconds,
        "Database pool configured"
    );

    let (event_tx, _) = broadcast::channel::<String>(1000);

    info!(port = cfg.port, "Feeshr Hub starting");

    let state = AppState {
        db: pool,
        config: cfg.clone(),
        event_tx,
        observer_count: Arc::new(AtomicUsize::new(0)),
    };

    let router = routes::build_router(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], cfg.port));
    let listener = TcpListener::bind(addr)
        .await
        .context("Failed to bind TCP listener")?;

    info!(addr = %addr, "Listening");

    axum::serve(listener, router)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("Server error")?;

    info!("Feeshr Hub shut down cleanly");
    Ok(())
}

/// Wait for SIGTERM or SIGINT, then return so axum can drain connections.
async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("Failed to install CTRL+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("Failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    info!("Shutdown signal received");
}
