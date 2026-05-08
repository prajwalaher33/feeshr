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

use axum::extract::State;
use axum::response::Json;
use axum::{routing::get, routing::post, Router};
use serde::Deserialize;
use std::sync::Arc;
use std::time::Duration;
use storage::{validate_repo_id, RepoStorage};
use tokio::signal;
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::timeout::TimeoutLayer;
use tracing::info;

fn parse_env<T: std::str::FromStr>(name: &str, default: T) -> T {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse::<T>().ok())
        .unwrap_or(default)
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(std::env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string()))
        .init();

    let data_dir = std::env::var("GIT_DATA_DIR").unwrap_or_else(|_| "/data/repos".to_string());
    let storage = Arc::new(RepoStorage::new(&data_dir));
    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(8081);

    // Two-tier limits. The smart-HTTP pack routes (push, fetch, clone) need
    // big bodies and long deadlines — a packfile can be tens of MB and a
    // clone of a chunky repo legitimately runs for minutes. Everything else
    // (create-repo JSON, browse APIs, health) fits in a few KB and a few
    // seconds, so we keep the default tight to bound blast radius if a
    // misbehaving client hammers the wrong endpoint.
    let max_pack_bytes = parse_env::<usize>("MAX_PACK_BODY_BYTES", 200 * 1024 * 1024);
    let pack_timeout = Duration::from_secs(parse_env::<u64>("PACK_TIMEOUT_SECS", 600));
    let max_body_bytes = parse_env::<usize>("MAX_REQUEST_BODY_BYTES", 1024 * 1024);
    let request_timeout = Duration::from_secs(parse_env::<u64>("REQUEST_TIMEOUT_SECS", 30));

    // Pack routes (clone/fetch/push) — large bodies, long deadlines.
    let pack_routes = Router::new()
        .route("/repos/:id/git-upload-pack", post(server::upload_pack))
        .route("/repos/:id/git-receive-pack", post(server::receive_pack))
        .layer(RequestBodyLimitLayer::new(max_pack_bytes))
        .layer(TimeoutLayer::new(pack_timeout));

    // Everything else — small bodies, fast responses.
    let regular_routes = Router::new()
        .route("/health", get(health))
        .route("/repos", post(create_repo_endpoint))
        .route("/repos/:id/info/refs", get(server::info_refs))
        .route("/repos/:id/files", get(browse::list_files))
        .route("/repos/:id/file", get(browse::get_file))
        .route("/repos/:id/commits", get(browse::get_commits))
        .route("/repos/:id/diff", get(browse::get_diff))
        .layer(RequestBodyLimitLayer::new(max_body_bytes))
        .layer(TimeoutLayer::new(request_timeout));

    let app = Router::new()
        .merge(pack_routes)
        .merge(regular_routes)
        .with_state(storage);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port))
        .await
        .expect("Failed to bind port");

    info!(
        port = port,
        data_dir = %data_dir,
        max_pack_mb = max_pack_bytes / 1024 / 1024,
        pack_timeout_secs = pack_timeout.as_secs(),
        max_body_kb = max_body_bytes / 1024,
        request_timeout_secs = request_timeout.as_secs(),
        "Feeshr Git Server listening"
    );
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("Server error");

    info!("Git server shut down cleanly");
}

/// Wait for SIGTERM or SIGINT so axum can drain in-flight pushes/clones
/// instead of dropping them on a redeploy.
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
    // Reject path-traversal / weird repo ids before they touch the filesystem.
    if let Err(e) = validate_repo_id(&body.repo_id) {
        tracing::warn!(repo_id = %body.repo_id, error = %e, "Rejected create with invalid repo_id");
        return Err(axum::http::StatusCode::BAD_REQUEST);
    }

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
