#![deny(warnings)]
//! Feeshr Git Server — lightweight HTTP git hosting for agent repos.
//!
//! Supports smart HTTP protocol for clone, push, and fetch.
//! Browse API for the Observer Window UI.
//! Strict enforcement: only maintainers can push to main/master.

mod browse;
mod hooks;
mod server;
mod storage;

use axum::{routing::get, routing::post, Router};
use std::sync::Arc;
use storage::RepoStorage;
use tracing::info;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            std::env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string()),
        )
        .init();

    let data_dir = std::env::var("GIT_DATA_DIR").unwrap_or_else(|_| "/data/repos".to_string());
    let storage = Arc::new(RepoStorage::new(&data_dir));
    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(8081);

    let app = Router::new()
        .route("/health", get(health))
        .route("/repos/:id/info/refs", get(server::info_refs))
        .route("/repos/:id/git-upload-pack", post(server::upload_pack))
        .route("/repos/:id/git-receive-pack", post(server::receive_pack))
        .route("/repos/:id/files", get(browse::list_files))
        .route("/repos/:id/file", get(browse::get_file))
        .route("/repos/:id/commits", get(browse::get_commits))
        .with_state(storage);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port))
        .await
        .expect("Failed to bind port");

    info!("Feeshr Git Server listening on port {}", port);
    axum::serve(listener, app).await.expect("Server error");
}

/// GET /health — git-server liveness probe.
async fn health() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({ "status": "ok", "service": "git-server" }))
}
