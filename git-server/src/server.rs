//! Smart HTTP git protocol handler.
//!
//! Implements the git smart HTTP protocol so agents can clone, push,
//! and fetch repos over HTTP. Only the maintainer can push to main —
//! enforced by the pre-receive hook in hooks.rs.
//!
//! Endpoints:
//!   GET  /repos/:id/info/refs?service=git-{upload,receive}-pack
//!   POST /repos/:id/git-upload-pack    (fetch/clone)
//!   POST /repos/:id/git-receive-pack   (push)

use axum::{
    body::Body,
    extract::{Path, Query},
    http::StatusCode,
    response::Response,
};
use serde::Deserialize;
use tokio::process::Command;

/// Query parameters for git info/refs endpoint.
#[derive(Deserialize)]
pub struct InfoRefsQuery {
    pub service: String,
}

/// Handle git info/refs (used by clone and fetch).
///
/// GET /repos/:id/info/refs?service=git-upload-pack
pub async fn info_refs(
    Path(repo_id): Path<String>,
    Query(params): Query<InfoRefsQuery>,
) -> Response<Body> {
    let data_dir = std::env::var("GIT_DATA_DIR").unwrap_or_else(|_| "/data/repos".to_string());
    let repo_path = format!("{}/{}.git", data_dir, repo_id);

    let service = &params.service;
    if service != "git-upload-pack" && service != "git-receive-pack" {
        return Response::builder()
            .status(StatusCode::BAD_REQUEST)
            .body(Body::empty())
            .unwrap_or_default();
    }

    let output = match Command::new(service)
        .args(["--stateless-rpc", "--advertise-refs", &repo_path])
        .output()
        .await
    {
        Ok(o) => o,
        Err(_) => return Response::builder()
            .status(StatusCode::INTERNAL_SERVER_ERROR)
            .body(Body::empty())
            .unwrap_or_default(),
    };

    let pkt_line = format!("# service={}\n", service);
    let pkt_len = pkt_line.len() + 4;
    let header = format!("{:04x}{}", pkt_len, pkt_line);
    let mut body = format!("{}0000", header).into_bytes();
    body.extend_from_slice(&output.stdout);

    Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", format!("application/x-{}-advertisement", service))
        .header("Cache-Control", "no-cache")
        .body(Body::from(body))
        .unwrap_or_default()
}

/// Handle git-upload-pack (fetch/clone data).
///
/// POST /repos/:id/git-upload-pack
pub async fn upload_pack(
    Path(repo_id): Path<String>,
    body: axum::body::Bytes,
) -> Response<Body> {
    run_git_pack("git-upload-pack", &repo_id, body.to_vec()).await
}

/// Handle git-receive-pack (push data).
///
/// POST /repos/:id/git-receive-pack
pub async fn receive_pack(
    Path(repo_id): Path<String>,
    body: axum::body::Bytes,
) -> Response<Body> {
    run_git_pack("git-receive-pack", &repo_id, body.to_vec()).await
}

/// Run a git pack service (upload-pack or receive-pack) against a repo.
///
/// # Arguments
/// * `service` - The git service binary name
/// * `repo_id` - UUID of the repo
/// * `input` - Raw request body bytes
async fn run_git_pack(service: &str, repo_id: &str, input: Vec<u8>) -> Response<Body> {
    let data_dir = std::env::var("GIT_DATA_DIR").unwrap_or_else(|_| "/data/repos".to_string());
    let repo_path = format!("{}/{}.git", data_dir, repo_id);

    let mut child = match tokio::process::Command::new(service)
        .args(["--stateless-rpc", &repo_path])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
    {
        Ok(c) => c,
        Err(_) => return Response::builder()
            .status(StatusCode::INTERNAL_SERVER_ERROR)
            .body(Body::empty())
            .unwrap_or_default(),
    };

    if let Some(stdin) = child.stdin.take() {
        use tokio::io::AsyncWriteExt;
        let mut stdin = stdin;
        let _ = stdin.write_all(&input).await;
    }

    let output = match child.wait_with_output().await {
        Ok(o) => o,
        Err(_) => return Response::builder()
            .status(StatusCode::INTERNAL_SERVER_ERROR)
            .body(Body::empty())
            .unwrap_or_default(),
    };

    Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", format!("application/x-{}-result", service))
        .header("Cache-Control", "no-cache")
        .body(Body::from(output.stdout))
        .unwrap_or_default()
}
