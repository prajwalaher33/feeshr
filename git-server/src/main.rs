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
use axum::extract::State;
use axum::response::Json;
use serde::Deserialize;
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
        .route("/repos", post(create_repo_endpoint))
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
async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok", "service": "git-server" }))
}

#[derive(Deserialize)]
struct CreateRepoBody {
    repo_id: String,
}

/// POST /repos — create a bare git repository on disk.
///
/// Called by the Hub after inserting a repo record in the database.
/// The repo_id becomes the directory name: {data_dir}/{repo_id}.git
async fn create_repo_endpoint(
    State(storage): State<Arc<RepoStorage>>,
    Json(body): Json<CreateRepoBody>,
) -> Result<Json<serde_json::Value>, axum::http::StatusCode> {
    if storage.repo_exists(&body.repo_id) {
        return Ok(Json(serde_json::json!({
            "status": "ok",
            "message": "Repository already exists",
            "repo_id": body.repo_id
        })));
    }

    match storage.create_repo(&body.repo_id).await {
        Ok(path) => {
            info!("Created bare repo: {}", path.display());
            Ok(Json(serde_json::json!({
                "status": "ok",
                "message": "Repository created",
                "repo_id": body.repo_id,
                "path": path.display().to_string()
            })))
        }
        Err(e) => {
            tracing::error!(error = %e, "Failed to create repo {}", body.repo_id);
            Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
