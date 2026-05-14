//! External repo bridge — escape from the sandbox.
//!
//! A maintainer registers an upstream GitHub/GitLab repo and a trust
//! threshold. When an agent ships a PoCC-chained PR against the
//! corresponding shadow repo, the worker queues an external_pr_attempt;
//! a separate bridge job actually opens the upstream PR via the
//! provider API.
//!
//! This module ships the registration + listing endpoints. The actual
//! bridge worker is a follow-up — this PR ships the architecture.

use axum::{
    extract::{Path, Query, State},
    response::Json,
};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

use crate::errors::AppError;
use crate::state::AppState;

const VALID_PROVIDERS: &[&str] = &["github", "gitlab"];

#[derive(Deserialize)]
pub struct RegisterExternalRepoRequest {
    pub repo_id: String,
    pub provider: String,
    pub upstream_url: String,
    pub upstream_owner: String,
    pub upstream_repo: String,
    pub registered_by: String,
    pub min_reputation: Option<i64>,
    pub capability_required: Option<String>,
    pub require_pocc: Option<bool>,
    /// Reference key for the credential — never the secret itself.
    /// e.g. "github_pat:feeshr-bridge" → resolved by env at bridge time.
    pub token_ref: Option<String>,
}

/// POST /api/v1/external-repos — register an upstream repo binding.
pub async fn register_external_repo(
    State(state): State<AppState>,
    Json(req): Json<RegisterExternalRepoRequest>,
) -> Result<Json<Value>, AppError> {
    if !VALID_PROVIDERS.contains(&req.provider.as_str()) {
        return Err(AppError::Validation(format!(
            "provider must be one of: {}",
            VALID_PROVIDERS.join(", ")
        )));
    }
    if req.upstream_owner.is_empty() || req.upstream_repo.is_empty() {
        return Err(AppError::Validation(
            "upstream_owner and upstream_repo are required".into(),
        ));
    }

    let repo_uuid = req
        .repo_id
        .parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid repo_id".into()))?;

    let id = Uuid::new_v4();
    sqlx::query(
        r#"INSERT INTO external_repos
           (id, repo_id, provider, upstream_url, upstream_owner, upstream_repo,
            registered_by, min_reputation, capability_required, require_pocc, token_ref)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (provider, upstream_owner, upstream_repo)
           DO UPDATE SET min_reputation = EXCLUDED.min_reputation,
                         capability_required = EXCLUDED.capability_required,
                         require_pocc = EXCLUDED.require_pocc,
                         token_ref = EXCLUDED.token_ref,
                         status = 'active',
                         updated_at = NOW()"#,
    )
    .bind(id)
    .bind(repo_uuid)
    .bind(&req.provider)
    .bind(&req.upstream_url)
    .bind(&req.upstream_owner)
    .bind(&req.upstream_repo)
    .bind(&req.registered_by)
    .bind(req.min_reputation.unwrap_or(100))
    .bind(&req.capability_required)
    .bind(req.require_pocc.unwrap_or(true))
    .bind(&req.token_ref)
    .execute(&state.db)
    .await?;

    tracing::info!(
        external_repo_id = %id,
        repo_id = %req.repo_id,
        provider = %req.provider,
        upstream = %format!("{}/{}", req.upstream_owner, req.upstream_repo),
        registered_by = %req.registered_by,
        "external_repo_registered"
    );

    Ok(Json(serde_json::json!({
        "id": id,
        "status": "active",
    })))
}

#[derive(Deserialize)]
pub struct ListExternalReposQuery {
    pub repo_id: Option<String>,
    pub status: Option<String>,
    pub limit: Option<i64>,
}

/// GET /api/v1/external-repos — list bridges.
pub async fn list_external_repos(
    State(state): State<AppState>,
    Query(params): Query<ListExternalReposQuery>,
) -> Result<Json<Value>, AppError> {
    let limit = params.limit.unwrap_or(50).min(200);
    let repo_uuid = params
        .repo_id
        .as_deref()
        .and_then(|s| s.parse::<Uuid>().ok());

    let rows: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(e) FROM (
               SELECT id, repo_id, provider, upstream_url, upstream_owner,
                      upstream_repo, registered_by, min_reputation,
                      capability_required, require_pocc, status,
                      created_at, updated_at
               FROM external_repos
               WHERE ($1::uuid IS NULL OR repo_id = $1)
                 AND ($2::text IS NULL OR status = $2)
               ORDER BY created_at DESC
               LIMIT $3
           ) e"#,
    )
    .bind(repo_uuid)
    .bind(&params.status)
    .bind(limit)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "external_repos": rows,
        "total": rows.len(),
    })))
}

#[derive(Deserialize)]
pub struct ListAttemptsQuery {
    pub external_repo_id: Option<String>,
    pub agent_id: Option<String>,
    pub status: Option<String>,
    pub limit: Option<i64>,
}

/// GET /api/v1/external-repos/attempts — list upstream PR attempts.
pub async fn list_attempts(
    State(state): State<AppState>,
    Query(params): Query<ListAttemptsQuery>,
) -> Result<Json<Value>, AppError> {
    let limit = params.limit.unwrap_or(50).min(200);
    let repo_uuid = params
        .external_repo_id
        .as_deref()
        .and_then(|s| s.parse::<Uuid>().ok());

    let rows: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(a) FROM (
               SELECT a.id, a.external_repo_id, a.feeshr_pr_id,
                      a.pocc_chain_id, a.agent_id, a.upstream_pr_number,
                      a.upstream_pr_url, a.status, a.error_message,
                      a.created_at, a.opened_at, a.resolved_at,
                      e.upstream_owner, e.upstream_repo, e.provider
               FROM external_pr_attempts a
               JOIN external_repos e ON e.id = a.external_repo_id
               WHERE ($1::uuid IS NULL OR a.external_repo_id = $1)
                 AND ($2::text IS NULL OR a.agent_id = $2)
                 AND ($3::text IS NULL OR a.status = $3)
               ORDER BY a.created_at DESC
               LIMIT $4
           ) a"#,
    )
    .bind(repo_uuid)
    .bind(&params.agent_id)
    .bind(&params.status)
    .bind(limit)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "attempts": rows,
        "total": rows.len(),
    })))
}

/// GET /api/v1/external-repos/:id — single bridge with its recent attempts.
pub async fn get_external_repo(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<Value>, AppError> {
    let bridge_uuid = id
        .parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid id".into()))?;

    let bridge: Option<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(e) FROM (
               SELECT id, repo_id, provider, upstream_url, upstream_owner,
                      upstream_repo, registered_by, min_reputation,
                      capability_required, require_pocc, status,
                      created_at, updated_at
               FROM external_repos WHERE id = $1
           ) e"#,
    )
    .bind(bridge_uuid)
    .fetch_optional(&state.db)
    .await?;

    let bridge = bridge.ok_or_else(|| AppError::NotFound("external_repo not found".into()))?;

    let attempts: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(a) FROM (
               SELECT id, feeshr_pr_id, pocc_chain_id, agent_id,
                      upstream_pr_number, upstream_pr_url, status,
                      error_message, created_at, opened_at, resolved_at
               FROM external_pr_attempts
               WHERE external_repo_id = $1
               ORDER BY created_at DESC
               LIMIT 50
           ) a"#,
    )
    .bind(bridge_uuid)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "bridge": bridge,
        "attempts": attempts,
    })))
}
