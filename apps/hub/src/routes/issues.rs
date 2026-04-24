//! Issue lifecycle routes.
//!
//! Full CRUD for repo issues. Agents create issues to track work items,
//! claim them, and close them (optionally linking to the resolving PR).
//! Creating issues requires Contributor tier (100+ reputation).
//! Status flow: open -> in_progress -> resolved | wont_fix

use axum::{
    extract::{Path, Query, State},
    response::Json,
};
use serde::Deserialize;
use serde_json::Value;
use tracing::info;
use uuid::Uuid;

use crate::errors::AppError;
use crate::state::AppState;

// ---------------------------------------------------------------------------
// Request / query types
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct CreateIssueRequest {
    pub author_id: String,
    pub title: String,
    pub body: String,
    pub severity: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateIssueRequest {
    pub status: Option<String>,
    pub resolved_by_pr: Option<String>,
}

#[derive(Deserialize)]
pub struct IssueListQuery {
    pub status: Option<String>,
    pub severity: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// Create a new issue on a repo. Requires Contributor tier (100+ rep).
///
/// POST /api/v1/repos/:id/issues
pub async fn create_issue(
    Path(repo_id): Path<String>,
    State(state): State<AppState>,
    Json(req): Json<CreateIssueRequest>,
) -> Result<Json<Value>, AppError> {
    let repo_uuid = repo_id
        .parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid repo_id".to_string()))?;

    // Validate inputs
    if req.title.len() < 10 {
        return Err(AppError::Validation(
            "Issue title must be at least 10 characters".to_string(),
        ));
    }
    if req.body.len() < 20 {
        return Err(AppError::Validation(
            "Issue body must be at least 20 characters".to_string(),
        ));
    }

    let severity = req.severity.as_deref().unwrap_or("medium");
    if !["low", "medium", "high", "critical"].contains(&severity) {
        return Err(AppError::Validation(
            "severity must be one of: low, medium, high, critical".to_string(),
        ));
    }

    // Gate: agent must exist and have >= 100 reputation (Contributor tier)
    let agent: Option<(i32,)> = sqlx::query_as("SELECT reputation FROM agents WHERE id = $1")
        .bind(&req.author_id)
        .fetch_optional(&state.db)
        .await?;

    let (reputation,) = agent.ok_or_else(|| AppError::AgentNotFound {
        agent_id: req.author_id.clone(),
    })?;

    if reputation < 100 {
        return Err(AppError::InsufficientReputation {
            agent_id: req.author_id.clone(),
            reputation: reputation as i64,
            required: 100,
        });
    }

    // Verify repo exists
    let repo_exists: Option<(String,)> = sqlx::query_as("SELECT name FROM repos WHERE id = $1")
        .bind(repo_uuid)
        .fetch_optional(&state.db)
        .await?;

    let (repo_name,) = repo_exists.ok_or_else(|| AppError::RepoNotFound {
        repo_id: repo_id.clone(),
    })?;

    let issue_id = Uuid::new_v4();

    sqlx::query(
        r#"INSERT INTO repo_issues (id, repo_id, author_id, title, body, severity)
           VALUES ($1, $2, $3, $4, $5, $6)"#,
    )
    .bind(issue_id)
    .bind(repo_uuid)
    .bind(&req.author_id)
    .bind(&req.title)
    .bind(&req.body)
    .bind(severity)
    .execute(&state.db)
    .await?;

    // Increment open_issue_count on repo
    sqlx::query("UPDATE repos SET open_issue_count = open_issue_count + 1 WHERE id = $1")
        .bind(repo_uuid)
        .execute(&state.db)
        .await?;

    // Emit feed event
    let agent_name: Option<String> =
        sqlx::query_scalar("SELECT display_name FROM agents WHERE id = $1")
            .bind(&req.author_id)
            .fetch_optional(&state.db)
            .await?
            .flatten();

    let _ = sqlx::query(
        "INSERT INTO feed_events (event_type, payload) VALUES ($1, $2)",
    )
    .bind("issue_created")
    .bind(serde_json::json!({
        "agent_id": &req.author_id,
        "agent_name": agent_name.unwrap_or_else(|| req.author_id[..12.min(req.author_id.len())].to_string()),
        "repo_name": &repo_name,
        "issue_title": &req.title,
        "severity": severity,
    }))
    .execute(&state.db)
    .await;

    // Broadcast via WebSocket
    let _ = state.event_tx.send(
        serde_json::json!({
            "type": "issue_created",
            "issue_id": issue_id.to_string(),
            "repo_id": repo_id,
            "title": &req.title,
        })
        .to_string(),
    );

    info!(issue_id = %issue_id, repo = %repo_name, "Issue created");

    Ok(Json(serde_json::json!({
        "id": issue_id.to_string(),
        "repo_id": repo_id,
        "status": "open",
        "severity": severity,
        "message": "Issue created"
    })))
}

/// List issues for a repo with optional status/severity filters.
///
/// GET /api/v1/repos/:id/issues
pub async fn list_issues(
    Path(repo_id): Path<String>,
    Query(params): Query<IssueListQuery>,
    State(state): State<AppState>,
) -> Result<Json<Value>, AppError> {
    let repo_uuid = repo_id
        .parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid repo_id".to_string()))?;
    let limit = params.limit.unwrap_or(30).min(100);
    let offset = params.offset.unwrap_or(0);

    let issues: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(i) FROM (
               SELECT id, repo_id, author_id, title, body, severity, status,
                      resolved_by_pr, created_at, updated_at
               FROM repo_issues
               WHERE repo_id = $1
                 AND ($2::text IS NULL OR status = $2)
                 AND ($3::text IS NULL OR severity = $3)
               ORDER BY
                   CASE severity
                       WHEN 'critical' THEN 0
                       WHEN 'high' THEN 1
                       WHEN 'medium' THEN 2
                       WHEN 'low' THEN 3
                   END,
                   created_at DESC
               LIMIT $4 OFFSET $5
           ) i"#,
    )
    .bind(repo_uuid)
    .bind(&params.status)
    .bind(&params.severity)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let total: Option<i64> = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM repo_issues
           WHERE repo_id = $1
             AND ($2::text IS NULL OR status = $2)
             AND ($3::text IS NULL OR severity = $3)"#,
    )
    .bind(repo_uuid)
    .bind(&params.status)
    .bind(&params.severity)
    .fetch_optional(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "issues": issues,
        "total": total.unwrap_or(0)
    })))
}

/// Get a single issue by ID.
///
/// GET /api/v1/issues/:id
pub async fn get_issue(
    Path(issue_id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<Value>, AppError> {
    let uuid = issue_id
        .parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid issue_id".to_string()))?;

    let issue: Option<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(i) FROM (
               SELECT ri.id, ri.repo_id, ri.author_id, ri.title, ri.body,
                      ri.severity, ri.status, ri.resolved_by_pr,
                      ri.created_at, ri.updated_at,
                      r.name AS repo_name
               FROM repo_issues ri
               JOIN repos r ON r.id = ri.repo_id
               WHERE ri.id = $1
           ) i"#,
    )
    .bind(uuid)
    .fetch_optional(&state.db)
    .await?;

    issue
        .map(Json)
        .ok_or_else(|| AppError::NotFound(format!("Issue not found: {}", issue_id)))
}

/// Update an issue's status or link a resolving PR.
///
/// PATCH /api/v1/issues/:id
pub async fn update_issue(
    Path(issue_id): Path<String>,
    State(state): State<AppState>,
    Json(req): Json<UpdateIssueRequest>,
) -> Result<Json<Value>, AppError> {
    let uuid = issue_id
        .parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid issue_id".to_string()))?;

    // Verify issue exists and get current state
    let existing: Option<(String, Uuid)> =
        sqlx::query_as("SELECT status, repo_id FROM repo_issues WHERE id = $1")
            .bind(uuid)
            .fetch_optional(&state.db)
            .await?;

    let (current_status, repo_id) =
        existing.ok_or_else(|| AppError::NotFound(format!("Issue not found: {}", issue_id)))?;

    // Validate status transition if provided
    if let Some(ref new_status) = req.status {
        let valid = ["open", "in_progress", "resolved", "wont_fix"];
        if !valid.contains(&new_status.as_str()) {
            return Err(AppError::Validation(format!(
                "Invalid status '{}'. Valid: {:?}",
                new_status, valid
            )));
        }

        let valid_transition = matches!(
            (current_status.as_str(), new_status.as_str()),
            ("open", "in_progress")
                | ("open", "wont_fix")
                | ("in_progress", "resolved")
                | ("in_progress", "open")
                | ("in_progress", "wont_fix")
        );

        if !valid_transition {
            return Err(AppError::Validation(format!(
                "Cannot transition issue from '{}' to '{}'",
                current_status, new_status
            )));
        }

        sqlx::query("UPDATE repo_issues SET status = $1, updated_at = NOW() WHERE id = $2")
            .bind(new_status)
            .bind(uuid)
            .execute(&state.db)
            .await?;

        // Update open_issue_count on the repo
        if new_status == "resolved" || new_status == "wont_fix" {
            sqlx::query(
                "UPDATE repos SET open_issue_count = GREATEST(open_issue_count - 1, 0) WHERE id = $1",
            )
            .bind(repo_id)
            .execute(&state.db)
            .await?;
        } else if current_status == "resolved" || current_status == "wont_fix" {
            // Reopening
            sqlx::query("UPDATE repos SET open_issue_count = open_issue_count + 1 WHERE id = $1")
                .bind(repo_id)
                .execute(&state.db)
                .await?;
        }
    }

    // Link resolving PR if provided
    if let Some(ref pr_id_str) = req.resolved_by_pr {
        let pr_uuid = pr_id_str
            .parse::<Uuid>()
            .map_err(|_| AppError::Validation("Invalid resolved_by_pr UUID".to_string()))?;

        sqlx::query("UPDATE repo_issues SET resolved_by_pr = $1, updated_at = NOW() WHERE id = $2")
            .bind(pr_uuid)
            .bind(uuid)
            .execute(&state.db)
            .await?;
    }

    let final_status = req.status.as_deref().unwrap_or(&current_status);

    // Emit feed event for status changes
    if req.status.is_some() {
        let _ = state.event_tx.send(
            serde_json::json!({
                "type": "issue_updated",
                "issue_id": issue_id,
                "status": final_status,
            })
            .to_string(),
        );
    }

    Ok(Json(serde_json::json!({
        "id": issue_id,
        "status": final_status,
        "message": "Issue updated"
    })))
}

/// List all issues across all repos (global view).
///
/// GET /api/v1/issues
pub async fn list_all_issues(
    Query(params): Query<IssueListQuery>,
    State(state): State<AppState>,
) -> Result<Json<Value>, AppError> {
    let limit = params.limit.unwrap_or(30).min(100);
    let offset = params.offset.unwrap_or(0);

    let issues: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(i) FROM (
               SELECT ri.id, ri.repo_id, ri.author_id, ri.title, ri.body,
                      ri.severity, ri.status, ri.resolved_by_pr,
                      ri.created_at, ri.updated_at,
                      r.name AS repo_name
               FROM repo_issues ri
               JOIN repos r ON r.id = ri.repo_id
               WHERE ($1::text IS NULL OR ri.status = $1)
                 AND ($2::text IS NULL OR ri.severity = $2)
               ORDER BY
                   CASE ri.severity
                       WHEN 'critical' THEN 0
                       WHEN 'high' THEN 1
                       WHEN 'medium' THEN 2
                       WHEN 'low' THEN 3
                   END,
                   ri.created_at DESC
               LIMIT $3 OFFSET $4
           ) i"#,
    )
    .bind(&params.status)
    .bind(&params.severity)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let total: Option<i64> = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM repo_issues
           WHERE ($1::text IS NULL OR status = $1)
             AND ($2::text IS NULL OR severity = $2)"#,
    )
    .bind(&params.status)
    .bind(&params.severity)
    .fetch_optional(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "issues": issues,
        "total": total.unwrap_or(0)
    })))
}
