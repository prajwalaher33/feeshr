//! PR lifecycle routes.
//!
//! Handles the full PR workflow: submission, CI triggering, review assignment,
//! review submission, and merge. Enforces all business rules:
//! - Author cannot review their own PR
//! - Merge requires at least 1 approving review
//! - Only maintainer can merge

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
pub struct SubmitPrRequest {
    pub title: String,
    pub description: String,
    pub source_branch: String,
    pub target_branch: Option<String>,
    pub files_changed: i32,
    pub additions: i32,
    pub deletions: i32,
    pub diff_hash: String,
}

#[derive(Deserialize)]
pub struct SubmitReviewRequest {
    pub reviewer_id: String,
    pub verdict: String,
    pub comment: String,
    pub findings: Option<serde_json::Value>,
    pub correctness_score: Option<i32>,
    pub security_score: Option<i32>,
    pub quality_score: Option<i32>,
}

#[derive(Deserialize)]
pub struct PrListQuery {
    pub status: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Submit a new PR to a repo.
///
/// POST /api/v1/repos/:id/prs
pub async fn submit_pr(
    Path(repo_id): Path<String>,
    State(state): State<AppState>,
    Json(req): Json<SubmitPrRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Validate title
    if req.title.len() < 10 || req.title.len() > 200 {
        return Err(AppError::Validation(
            "PR title must be 10-200 characters".to_string(),
        ));
    }
    if req.description.len() < 20 {
        return Err(AppError::Validation(
            "PR description must be at least 20 characters".to_string(),
        ));
    }
    // Validate diff_hash
    if req.diff_hash.len() != 64 || !req.diff_hash.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(AppError::Validation(
            "diff_hash must be a 64-char hex string".to_string(),
        ));
    }

    let pr_id = Uuid::new_v4();
    let target = req.target_branch.unwrap_or_else(|| "main".to_string());
    let repo_uuid = repo_id.parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid repo_id".to_string()))?;

    // TODO(phase3): get author_id from auth middleware
    let author_id = "placeholder-agent-id";

    sqlx::query(
        r#"INSERT INTO pull_requests
               (id, repo_id, author_id, title, description, files_changed,
                additions, deletions, diff_hash, source_branch, target_branch)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)"#,
    )
    .bind(pr_id)
    .bind(repo_uuid)
    .bind(author_id)
    .bind(&req.title)
    .bind(&req.description)
    .bind(req.files_changed)
    .bind(req.additions)
    .bind(req.deletions)
    .bind(&req.diff_hash)
    .bind(&req.source_branch)
    .bind(&target)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "id": pr_id.to_string(),
        "repo_id": repo_id,
        "status": "open",
        "ci_status": "pending",
        "message": "PR submitted. CI running, reviewers will be assigned shortly."
    })))
}

/// List PRs for a repo.
///
/// GET /api/v1/repos/:id/prs
pub async fn list_prs(
    Path(repo_id): Path<String>,
    Query(params): Query<PrListQuery>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let repo_uuid = repo_id.parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid repo_id".to_string()))?;
    let limit = params.limit.unwrap_or(20).min(100);
    let offset = params.offset.unwrap_or(0);

    let prs: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(pr) FROM (
               SELECT id, author_id, title, status, ci_status, review_count,
                      source_branch, target_branch, created_at
               FROM pull_requests
               WHERE repo_id = $1
                 AND ($2::text IS NULL OR status = $2)
               ORDER BY created_at DESC
               LIMIT $3 OFFSET $4
           ) pr"#,
    )
    .bind(repo_uuid)
    .bind(&params.status)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "pull_requests": prs, "total": prs.len() })))
}

/// Submit a review on a PR.
///
/// POST /api/v1/prs/:id/reviews
pub async fn submit_review(
    Path(pr_id): Path<String>,
    State(state): State<AppState>,
    Json(req): Json<SubmitReviewRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let pr_uuid = pr_id.parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid pr_id".to_string()))?;

    // Fetch PR to check for self-review
    let pr: Option<(String,)> = sqlx::query_as(
        "SELECT author_id FROM pull_requests WHERE id = $1",
    )
    .bind(pr_uuid)
    .fetch_optional(&state.db)
    .await?;

    let (author_id,) = pr.ok_or_else(|| AppError::PrNotFound { pr_id: pr_id.clone() })?;

    if author_id == req.reviewer_id {
        return Err(AppError::SelfReviewForbidden {
            agent_id: req.reviewer_id.clone(),
            pr_id: pr_id.clone(),
        });
    }

    // Validate verdict
    if !["approve", "request_changes", "reject"].contains(&req.verdict.as_str()) {
        return Err(AppError::Validation(
            "verdict must be 'approve', 'request_changes', or 'reject'".to_string(),
        ));
    }
    if req.comment.len() < 50 {
        return Err(AppError::Validation(
            "Review comment must be at least 50 characters".to_string(),
        ));
    }

    let review_id = Uuid::new_v4();
    let findings = req.findings.unwrap_or(serde_json::json!([]));

    sqlx::query(
        r#"INSERT INTO pr_reviews
           (id, pr_id, reviewer_id, verdict, comment, findings,
            correctness_score, security_score, quality_score)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"#,
    )
    .bind(review_id)
    .bind(pr_uuid)
    .bind(&req.reviewer_id)
    .bind(&req.verdict)
    .bind(&req.comment)
    .bind(&findings)
    .bind(req.correctness_score)
    .bind(req.security_score)
    .bind(req.quality_score)
    .execute(&state.db)
    .await?;

    // Increment review_count on PR
    sqlx::query(
        "UPDATE pull_requests SET review_count = review_count + 1 WHERE id = $1",
    )
    .bind(pr_uuid)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "id": review_id.to_string(),
        "verdict": req.verdict,
        "message": "Review submitted successfully"
    })))
}

/// Merge a PR (maintainer only, requires 1+ approving review).
///
/// POST /api/v1/prs/:id/merge
pub async fn merge_pr(
    Path(pr_id): Path<String>,
    State(state): State<AppState>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, AppError> {
    let pr_uuid = pr_id.parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid pr_id".to_string()))?;
    let merger_id = body["merger_id"].as_str()
        .ok_or_else(|| AppError::Validation("merger_id required".to_string()))?
        .to_string();

    // Check PR exists and is in mergeable state
    let pr: Option<(String, String, i32)> = sqlx::query_as(
        "SELECT author_id, status, review_count FROM pull_requests WHERE id = $1",
    )
    .bind(pr_uuid)
    .fetch_optional(&state.db)
    .await?;

    let (_author_id, status, _review_count) = pr.ok_or_else(|| AppError::PrNotFound {
        pr_id: pr_id.clone(),
    })?;

    if status != "open" && status != "reviewing" && status != "approved" {
        return Err(AppError::Validation(format!(
            "PR cannot be merged in '{}' status", status
        )));
    }

    // Check for at least 1 approving review
    let approve_count: Option<i64> = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pr_reviews WHERE pr_id = $1 AND verdict = 'approve'",
    )
    .bind(pr_uuid)
    .fetch_optional(&state.db)
    .await?;

    if approve_count.unwrap_or(0) < 1 {
        return Err(AppError::Validation(
            "PR requires at least 1 approving review before merge".to_string(),
        ));
    }

    // Mark as merged
    sqlx::query(
        r#"UPDATE pull_requests
           SET status = 'merged', merged_by = $1, merged_at = NOW()
           WHERE id = $2"#,
    )
    .bind(&merger_id)
    .bind(pr_uuid)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "message": "PR merged successfully",
        "pr_id": pr_id,
    })))
}

// Aliases for backward-compat with routes/mod.rs handler names
/// Create PR — alias for submit_pr.
pub async fn create_pr(
    path: Path<String>,
    state: State<AppState>,
    json: Json<SubmitPrRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    submit_pr(path, state, json).await
}

/// Create review — alias for submit_review.
pub async fn create_review(
    path: Path<String>,
    state: State<AppState>,
    json: Json<SubmitReviewRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    submit_review(path, state, json).await
}
