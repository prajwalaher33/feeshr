//! Browse API — serves file tree and file contents for the Observer Window.
//!
//! These endpoints are used by the web UI to render repo pages with
//! file browsing, commit history, and diffs.

use crate::storage::{CommitSummary, RepoStorage};
use axum::{
    extract::{Path, Query, State},
    response::Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Query parameters for file listing.
#[derive(Deserialize)]
pub struct ListFilesQuery {
    /// Git ref to list (default: HEAD)
    #[serde(default = "default_ref")]
    pub git_ref: String,
    /// Subdirectory path (default: root)
    #[serde(default)]
    pub path: String,
}

fn default_ref() -> String {
    "HEAD".to_string()
}

/// Response for file listing.
#[derive(Serialize)]
pub struct ListFilesResponse {
    pub files: Vec<String>,
    pub git_ref: String,
    pub path: String,
}

/// Response for file contents.
#[derive(Serialize)]
pub struct FileContentsResponse {
    pub content: String,
    pub size_bytes: usize,
    pub encoding: String,
}

/// Response for commit history.
#[derive(Serialize)]
pub struct CommitHistoryResponse {
    pub commits: Vec<CommitSummary>,
    pub total: usize,
}

/// List files in a repo directory.
///
/// GET /repos/:repo_id/files?git_ref=HEAD&path=src/
pub async fn list_files(
    Path(repo_id): Path<String>,
    Query(params): Query<ListFilesQuery>,
    State(storage): State<Arc<RepoStorage>>,
) -> Result<Json<ListFilesResponse>, axum::http::StatusCode> {
    let files = storage
        .list_files(&repo_id, &params.git_ref, &params.path)
        .await
        .map_err(|_| axum::http::StatusCode::NOT_FOUND)?;

    Ok(Json(ListFilesResponse {
        files,
        git_ref: params.git_ref,
        path: params.path,
    }))
}

/// Query parameters for file content retrieval.
#[derive(Deserialize)]
pub struct GetFileQuery {
    /// Git ref to read from (default: HEAD)
    #[serde(default = "default_ref")]
    pub git_ref: String,
    /// Path to the file within the repo
    pub path: String,
}

/// Get file contents.
///
/// GET /repos/:repo_id/file?git_ref=HEAD&path=src/main.rs
pub async fn get_file(
    Path(repo_id): Path<String>,
    Query(params): Query<GetFileQuery>,
    State(storage): State<Arc<RepoStorage>>,
) -> Result<Json<FileContentsResponse>, axum::http::StatusCode> {
    let content_bytes = storage
        .get_file_contents(&repo_id, &params.git_ref, &params.path)
        .await
        .map_err(|_| axum::http::StatusCode::NOT_FOUND)?;

    let size_bytes = content_bytes.len();
    let (content, encoding) = match String::from_utf8(content_bytes) {
        Ok(text) => (text, "utf-8"),
        Err(e) => {
            use std::fmt::Write;
            let mut hex = String::new();
            for byte in e.into_bytes() {
                let _ = write!(hex, "{:02x}", byte);
            }
            (hex, "hex")
        }
    };

    Ok(Json(FileContentsResponse {
        content,
        size_bytes,
        encoding: encoding.to_string(),
    }))
}

/// Query parameters for commit history.
#[derive(Deserialize)]
pub struct CommitHistoryQuery {
    /// Maximum number of commits to return (capped at 100)
    #[serde(default = "default_limit")]
    pub limit: usize,
}

fn default_limit() -> usize {
    20
}

/// Get commit history.
///
/// GET /repos/:repo_id/commits?limit=20
pub async fn get_commits(
    Path(repo_id): Path<String>,
    Query(params): Query<CommitHistoryQuery>,
    State(storage): State<Arc<RepoStorage>>,
) -> Result<Json<CommitHistoryResponse>, axum::http::StatusCode> {
    let limit = params.limit.min(100);
    let commits = storage
        .get_commits(&repo_id, limit)
        .await
        .map_err(|_| axum::http::StatusCode::NOT_FOUND)?;

    let total = commits.len();
    Ok(Json(CommitHistoryResponse { commits, total }))
}
