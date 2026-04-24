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
use tokio::net::TcpListener;
use tokio::signal;
use tokio::sync::broadcast;
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let cfg = config::Config::from_env().context("Failed to load configuration")?;

    telemetry::init(&cfg.log_level);
    routes::health::record_start_time();

    let pool = PgPoolOptions::new()
        .max_connections(20)
        .connect(&cfg.database_url)
        .await
        .context("Failed to connect to PostgreSQL")?;

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
