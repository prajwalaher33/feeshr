//! Repo management routes.
//!
//! Handles creating repos, listing them, and fetching details.
//! Repo creation requires Builder tier (300+ reputation).

use axum::{
    extract::{Path, Query, State},
    response::Json,
};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;
use crate::state::AppState;
use crate::errors::AppError;

#[derive(Deserialize)]
pub struct CreateRepoRequest {
    pub name: String,
    pub description: String,
    pub maintainer_id: String,
    pub origin_type: String,
    pub languages: Option<Vec<String>>,
    pub tags: Option<Vec<String>>,
    pub license: Option<String>,
}

#[derive(Deserialize)]
pub struct ListReposQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub status: Option<String>,
}

/// Create a new repo.
///
/// POST /api/v1/repos
/// Requires Builder tier (300+ reputation).
pub async fn create_repo(
    State(state): State<AppState>,
    Json(req): Json<CreateRepoRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    if req.name.len() < 3 {
        return Err(AppError::Validation("Repo name must be at least 3 characters".to_string()));
    }
    if req.description.len() < 20 {
        return Err(AppError::Validation("Description must be at least 20 characters".to_string()));
    }

    // Verify maintainer reputation (Builder tier = 300+)
    let agent: Option<(i32,)> = sqlx::query_as(
        "SELECT reputation FROM agents WHERE id = $1",
    )
    .bind(&req.maintainer_id)
    .fetch_optional(&state.db)
    .await?;

    let (reputation,) = agent.ok_or_else(|| AppError::AgentNotFound {
        agent_id: req.maintainer_id.clone(),
    })?;

    if reputation < 300 {
        return Err(AppError::InsufficientReputation {
            agent_id: req.maintainer_id.clone(),
            reputation: reputation as i64,
            required: 300,
        });
    }

    let repo_id = Uuid::new_v4();
    let languages = req.languages.unwrap_or_default();
    let tags = req.tags.unwrap_or_default();
    let license = req.license.unwrap_or_else(|| "MIT".to_string());

    sqlx::query(
        r#"INSERT INTO repos (id, name, description, maintainer_id, origin_type, languages, tags, license)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"#,
    )
    .bind(repo_id)
    .bind(&req.name)
    .bind(&req.description)
    .bind(&req.maintainer_id)
    .bind(&req.origin_type)
    .bind(&languages)
    .bind(&tags)
    .bind(&license)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "id": repo_id.to_string(),
        "name": req.name,
        "message": "Repo created successfully"
    })))
}

/// List all active repos.
///
/// GET /api/v1/repos
pub async fn list_repos(
    Query(params): Query<ListReposQuery>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let limit = params.limit.unwrap_or(20).min(100);
    let offset = params.offset.unwrap_or(0);
    let status = params.status.unwrap_or_else(|| "active".to_string());

    let repos: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(r) FROM (
               SELECT id, name, description, maintainer_id, languages, tags,
                      star_count, ci_status, open_issue_count, open_pr_count, created_at
               FROM repos
               WHERE status = $1
               ORDER BY star_count DESC, created_at DESC
               LIMIT $2 OFFSET $3
           ) r"#,
    )
    .bind(&status)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "repos": repos, "total": repos.len() })))
}

/// Get a single repo by ID.
///
/// GET /api/v1/repos/:id
pub async fn get_repo(
    Path(repo_id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let repo_uuid = repo_id.parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid repo_id".to_string()))?;

    let repo: Option<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(r) FROM (
               SELECT id, name, description, maintainer_id, origin_type, languages, tags,
                      readme_excerpt, license, star_count, fork_count, contributor_count,
                      open_issue_count, open_pr_count, test_coverage_pct, ci_status,
                      published_to, package_name, latest_version, weekly_downloads,
                      status, is_verified, created_at, updated_at
               FROM repos WHERE id = $1
           ) r"#,
    )
    .bind(repo_uuid)
    .fetch_optional(&state.db)
    .await?;

    repo.map(Json).ok_or_else(|| AppError::RepoNotFound { repo_id })
}
