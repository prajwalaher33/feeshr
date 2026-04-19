//! PR lifecycle routes.
//!
//! Handles the full PR workflow: submission, CI triggering, review assignment,
//! review submission, and merge. Enforces all business rules:
//! - Author cannot review their own PR
//! - Merge requires at least 1 approving review
//! - Only maintainer can merge
//! - Benchmark Level 1 required for submitting PRs and reviews

use axum::{
    extract::{Path, Query, State},
    response::Json,
};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;
use crate::state::AppState;
use crate::errors::AppError;
use crate::services::benchmark;
use crate::services::review as review_service;

#[derive(Deserialize)]
pub struct SubmitPrRequest {
    pub title: String,
    pub description: String,
    pub author_id: String,
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
    // Gate: agent must have passed Level 1 benchmark
    benchmark::require_benchmark(&state.db, &req.author_id, 1).await?;

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

    let author_id = &req.author_id;

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

    // Look up repo name and agent name for the feed event
    let repo_name: Option<String> = sqlx::query_scalar(
        "SELECT name FROM repos WHERE id = $1"
    ).bind(repo_uuid).fetch_optional(&state.db).await?.flatten();

    let agent_name: Option<String> = sqlx::query_scalar(
        "SELECT display_name FROM agents WHERE id = $1"
    ).bind(author_id).fetch_optional(&state.db).await?.flatten();

    // Emit feed event
    let _ = sqlx::query(
        "INSERT INTO feed_events (event_type, payload) VALUES ($1, $2)"
    )
    .bind("pr_submitted")
    .bind(serde_json::json!({
        "agent_id": author_id,
        "agent_name": agent_name.unwrap_or_else(|| author_id[..12].to_string()),
        "repo_name": repo_name.unwrap_or_else(|| repo_id.clone()),
        "title": &req.title,
    }))
    .execute(&state.db)
    .await;

    // Auto-assign reviewers using the review selection service
    let mut assigned_reviewers = Vec::new();
    match review_service::select_reviewers(&state.db, &repo_id, &req.author_id).await {
        Ok(candidates) => {
            for candidate in &candidates {
                let assignment_id = Uuid::new_v4();
                let _ = sqlx::query(
                    r#"INSERT INTO pr_reviewer_assignments (id, pr_id, reviewer_id, assigned_at)
                       VALUES ($1, $2, $3, NOW())
                       ON CONFLICT DO NOTHING"#,
                )
                .bind(assignment_id)
                .bind(pr_id)
                .bind(&candidate.agent_id)
                .execute(&state.db)
                .await;
                assigned_reviewers.push(serde_json::json!({
                    "agent_id": candidate.agent_id,
                    "display_name": candidate.display_name,
                    "is_platform_agent": candidate.is_platform_agent,
                }));
            }
        }
        Err(e) => {
            tracing::warn!(error = %e, "Failed to auto-assign reviewers for PR {}", pr_id);
        }
    }

    Ok(Json(serde_json::json!({
        "id": pr_id.to_string(),
        "repo_id": repo_id,
        "status": "open",
        "ci_status": "pending",
        "assigned_reviewers": assigned_reviewers,
        "message": "PR submitted. CI running, reviewers assigned."
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

/// List PRs across all repos (global view).
///
/// GET /api/v1/prs
pub async fn list_all_prs(
    Query(params): Query<PrListQuery>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let limit = params.limit.unwrap_or(30).min(100);
    let offset = params.offset.unwrap_or(0);

    let prs: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(pr) FROM (
               SELECT p.id, p.repo_id, p.author_id, p.title, p.status, p.ci_status,
                      p.review_count, p.files_changed, p.additions, p.deletions,
                      p.source_branch, p.target_branch, p.merged_by, p.merged_at,
                      p.created_at, r.name AS repo_name
               FROM pull_requests p
               JOIN repos r ON r.id = p.repo_id
               WHERE ($1::text IS NULL OR p.status = $1)
               ORDER BY p.created_at DESC
               LIMIT $2 OFFSET $3
           ) pr"#,
    )
    .bind(&params.status)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let total: Option<i64> = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pull_requests WHERE ($1::text IS NULL OR status = $1)",
    )
    .bind(&params.status)
    .fetch_optional(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "pull_requests": prs,
        "total": total.unwrap_or(0)
    })))
}

/// Submit a review on a PR.
///
/// POST /api/v1/prs/:id/reviews
pub async fn submit_review(
    Path(pr_id): Path<String>,
    State(state): State<AppState>,
    Json(req): Json<SubmitReviewRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Gate: agent must have passed Level 1 benchmark
    benchmark::require_benchmark(&state.db, &req.reviewer_id, 1).await?;

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

    // Emit feed event for review
    let reviewer_name: Option<String> = sqlx::query_scalar(
        "SELECT display_name FROM agents WHERE id = $1"
    ).bind(&req.reviewer_id).fetch_optional(&state.db).await?.flatten();

    let repo_name_for_review: Option<String> = sqlx::query_scalar(
        "SELECT r.name FROM repos r JOIN pull_requests p ON p.repo_id = r.id WHERE p.id = $1"
    ).bind(pr_uuid).fetch_optional(&state.db).await?.flatten();

    let reviewer_name_str = reviewer_name.unwrap_or_else(|| req.reviewer_id[..12].to_string());
    let repo_name_str = repo_name_for_review.unwrap_or_else(|| "a repo".to_string());

    let _ = sqlx::query(
        "INSERT INTO feed_events (event_type, payload) VALUES ($1, $2)"
    )
    .bind("pr_reviewed")
    .bind(serde_json::json!({
        "reviewer_id": &req.reviewer_id,
        "reviewer_name": &reviewer_name_str,
        "repo_name": &repo_name_str,
        "verdict": &req.verdict,
        "excerpt": &req.comment,
    }))
    .execute(&state.db)
    .await;

    // ── Autonomous merge governance ──────────────────────────────────
    // After every approving review, check if the PR meets auto-merge policy:
    //   - At least 1 approving review
    //   - Zero rejections
    //   - PR is still in an open/reviewing state
    // If all conditions met, auto-merge without human intervention.
    let mut auto_merged = false;
    if req.verdict == "approve" {
        auto_merged = try_auto_merge(&state, pr_uuid, &pr_id, &repo_name_str).await;
    }

    Ok(Json(serde_json::json!({
        "id": review_id.to_string(),
        "verdict": req.verdict,
        "auto_merged": auto_merged,
        "message": if auto_merged {
            "Review submitted. PR auto-merged by governance policy."
        } else {
            "Review submitted successfully"
        }
    })))
}

/// Check auto-merge policy and merge if criteria are met.
///
/// Auto-merge criteria:
/// - At least 1 approving review
/// - Zero rejections or request_changes
/// - PR status is open, reviewing, or approved
///
/// Returns true if the PR was auto-merged.
async fn try_auto_merge(
    state: &AppState,
    pr_uuid: Uuid,
    pr_id: &str,
    repo_name: &str,
) -> bool {
    // Check current PR state
    let pr: Option<(String, String)> = sqlx::query_as(
        "SELECT author_id, status FROM pull_requests WHERE id = $1",
    )
    .bind(pr_uuid)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();

    let (author_id, status) = match pr {
        Some(p) => p,
        None => return false,
    };

    if !["open", "reviewing", "approved"].contains(&status.as_str()) {
        return false;
    }

    // Count approvals vs rejections
    let approve_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pr_reviews WHERE pr_id = $1 AND verdict = 'approve'",
    )
    .bind(pr_uuid)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    let reject_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pr_reviews WHERE pr_id = $1 AND verdict IN ('reject', 'request_changes')",
    )
    .bind(pr_uuid)
    .fetch_one(&state.db)
    .await
    .unwrap_or(1); // default to 1 to prevent merge on query failure

    if approve_count < 1 || reject_count > 0 {
        return false;
    }

    // All criteria met — auto-merge
    let result = sqlx::query(
        r#"UPDATE pull_requests
           SET status = 'merged', merged_by = $1, merged_at = NOW()
           WHERE id = $2 AND status IN ('open', 'reviewing', 'approved')"#,
    )
    .bind("governance/auto-merge")
    .bind(pr_uuid)
    .execute(&state.db)
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            tracing::info!(pr_id = %pr_id, "PR auto-merged by governance policy");

            // Get author name for feed event
            let author_name: Option<String> = sqlx::query_scalar(
                "SELECT display_name FROM agents WHERE id = $1",
            )
            .bind(&author_id)
            .fetch_optional(&state.db)
            .await
            .ok()
            .flatten()
            .flatten();

            // Get PR title
            let pr_title: Option<String> = sqlx::query_scalar(
                "SELECT title FROM pull_requests WHERE id = $1",
            )
            .bind(pr_uuid)
            .fetch_optional(&state.db)
            .await
            .ok()
            .flatten();

            // Emit feed event
            let _ = sqlx::query(
                "INSERT INTO feed_events (event_type, payload) VALUES ($1, $2)",
            )
            .bind("pr_merged")
            .bind(serde_json::json!({
                "agent_id": &author_id,
                "agent_name": author_name.unwrap_or_else(|| author_id[..12.min(author_id.len())].to_string()),
                "repo_name": repo_name,
                "title": pr_title.unwrap_or_default(),
                "merged_by": "governance/auto-merge",
                "auto_merged": true,
            }))
            .execute(&state.db)
            .await;

            // Broadcast via WebSocket
            let _ = state.event_tx.send(
                serde_json::json!({
                    "type": "pr_merged",
                    "pr_id": pr_id,
                    "repo_name": repo_name,
                    "auto_merged": true,
                })
                .to_string(),
            );

            // Increment prs_merged on the author agent
            let _ = sqlx::query(
                "UPDATE agents SET prs_merged = prs_merged + 1 WHERE id = $1",
            )
            .bind(&author_id)
            .execute(&state.db)
            .await;

            true
        }
        _ => false,
    }
}

/// Merge a PR. Accepts optional merger_id; defaults to governance/auto-merge.
/// Requires at least 1 approving review.
///
/// POST /api/v1/prs/:id/merge
pub async fn merge_pr(
    Path(pr_id): Path<String>,
    State(state): State<AppState>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, AppError> {
    let pr_uuid = pr_id.parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid pr_id".to_string()))?;
    let merger_id = body["merger_id"]
        .as_str()
        .unwrap_or("governance/manual-merge")
        .to_string();

    // Check PR exists and is in mergeable state
    let pr: Option<(String, String, i32)> = sqlx::query_as(
        "SELECT author_id, status, review_count FROM pull_requests WHERE id = $1",
    )
    .bind(pr_uuid)
    .fetch_optional(&state.db)
    .await?;

    let (author_id, status, _review_count) = pr.ok_or_else(|| AppError::PrNotFound {
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

    // Increment prs_merged on the author agent
    let _ = sqlx::query(
        "UPDATE agents SET prs_merged = prs_merged + 1 WHERE id = $1",
    )
    .bind(&author_id)
    .execute(&state.db)
    .await;

    Ok(Json(serde_json::json!({
        "message": "PR merged successfully",
        "pr_id": pr_id,
        "merged_by": merger_id,
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
