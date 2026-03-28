//! Pre-commit consultation route.
//!
//! The single most important collaboration endpoint. An agent calls this
//! BEFORE starting work on anything. It returns everything needed to
//! avoid wasted effort: locks, conflicts, pitfalls, warnings, and decisions.

use axum::{
    extract::State,
    response::Json,
};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;
use chrono::Utc;

use crate::errors::AppError;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct ConsultRequest {
    pub target_type: String,
    pub target_id: String,
    pub intended_approach: String,
    pub agent_id: String,
}

/// Pre-commit consultation: gather all relevant context before starting work.
///
/// POST /api/v1/consult
pub async fn consult(
    State(state): State<AppState>,
    Json(req): Json<ConsultRequest>,
) -> Result<Json<Value>, AppError> {
    if !["issue", "bounty", "subtask"].contains(&req.target_type.as_str()) {
        return Err(AppError::Validation(
            "target_type must be one of: issue, bounty, subtask".into(),
        ));
    }

    let target_uuid = req.target_id.parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid target_id".into()))?;

    // Check cache first (10 minute TTL)
    let cached = check_cache(&state, &req.target_type, target_uuid).await?;
    if let Some(result) = cached {
        tracing::info!(target_type = %req.target_type, target_id = %req.target_id, "consultation_cache_hit");
        return Ok(Json(result));
    }

    // Gather all context
    let active_locks = check_active_locks(&state, &req.target_type, target_uuid).await?;
    let related_prs = check_related_prs(&state, &req.target_type, target_uuid).await?;
    let warnings = check_project_warnings(&state, &req.target_type, target_uuid).await?;
    let pending_decisions = check_pending_decisions(&state, &req.target_type, target_uuid).await?;
    let pitfalls = check_pitfalls(&state, &req.intended_approach).await?;

    // Compute recommendation
    let recommendation = compute_recommendation(
        &active_locks, &related_prs, &warnings, &pending_decisions,
    );

    let reason = compute_reason(&recommendation, &active_locks, &related_prs, &warnings);

    let result = serde_json::json!({
        "recommendation": recommendation,
        "reason": reason,
        "active_locks": active_locks,
        "related_prs": related_prs,
        "pitfalls": pitfalls,
        "warnings": warnings,
        "constraints": [],
        "failed_approaches": [],
        "pending_decisions": pending_decisions,
        "related_knowledge": [],
    });

    // Cache the result
    cache_result(&state, &req.agent_id, &req.target_type, target_uuid, &result).await?;

    tracing::info!(
        target_type = %req.target_type,
        target_id = %req.target_id,
        recommendation = %recommendation,
        "consultation_completed"
    );

    Ok(Json(result))
}

/// Check for a cached consultation result within the 10-minute TTL.
async fn check_cache(
    state: &AppState,
    target_type: &str,
    target_id: Uuid,
) -> Result<Option<Value>, AppError> {
    let cached: Option<(Value,)> = sqlx::query_as(
        r#"SELECT result FROM precommit_consultations
           WHERE target_type = $1 AND target_id = $2 AND expires_at > NOW()
           ORDER BY created_at DESC LIMIT 1"#,
    )
    .bind(target_type)
    .bind(target_id)
    .fetch_optional(&state.db)
    .await?;

    Ok(cached.map(|(r,)| r))
}

/// Cache a consultation result with a 10-minute TTL.
async fn cache_result(
    state: &AppState,
    agent_id: &str,
    target_type: &str,
    target_id: Uuid,
    result: &Value,
) -> Result<(), AppError> {
    let expires_at = Utc::now() + chrono::Duration::minutes(10);
    sqlx::query(
        r#"INSERT INTO precommit_consultations
           (id, agent_id, target_type, target_id, result, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6)"#,
    )
    .bind(Uuid::new_v4())
    .bind(agent_id)
    .bind(target_type)
    .bind(target_id)
    .bind(result)
    .bind(expires_at)
    .execute(&state.db)
    .await?;
    Ok(())
}

/// Check for active work locks on the target.
async fn check_active_locks(
    state: &AppState,
    target_type: &str,
    target_id: Uuid,
) -> Result<Vec<Value>, AppError> {
    let locks: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(l) FROM (
               SELECT id, agent_id, intent, expires_at, created_at
               FROM work_locks
               WHERE target_type = $1 AND target_id = $2
                 AND status = 'active' AND expires_at > NOW()
           ) l"#,
    )
    .bind(target_type)
    .bind(target_id)
    .fetch_all(&state.db)
    .await?;

    Ok(locks)
}

/// Check for open PRs that may already address this target.
async fn check_related_prs(
    state: &AppState,
    _target_type: &str,
    target_id: Uuid,
) -> Result<Vec<Value>, AppError> {
    // Search for PRs referencing this target ID in title or description
    let target_str = target_id.to_string();
    let prs: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(p) FROM (
               SELECT id, title, author_id, status, created_at
               FROM pull_requests
               WHERE status IN ('open', 'reviewing')
                 AND (title ILIKE '%' || $1 || '%'
                      OR description ILIKE '%' || $1 || '%')
               LIMIT 5
           ) p"#,
    )
    .bind(&target_str)
    .fetch_all(&state.db)
    .await?;

    Ok(prs)
}

/// Check for project memory warnings and constraints.
async fn check_project_warnings(
    state: &AppState,
    _target_type: &str,
    _target_id: Uuid,
) -> Result<Vec<Value>, AppError> {
    // For now, return all active warnings/constraints/failed_approaches
    // In production, would scope to the repo containing this target
    let warnings: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(m) FROM (
               SELECT key, value, entry_type, contributed_by
               FROM project_memory
               WHERE entry_type IN ('warning', 'failed_approach', 'constraint')
                 AND is_active = TRUE
               ORDER BY created_at DESC
               LIMIT 10
           ) m"#,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(warnings)
}

/// Check for pending technical decisions that affect this work.
async fn check_pending_decisions(
    state: &AppState,
    _target_type: &str,
    _target_id: Uuid,
) -> Result<Vec<Value>, AppError> {
    let decisions: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(d) FROM (
               SELECT id, title, status, voting_deadline
               FROM technical_decisions
               WHERE status IN ('open', 'voting')
               ORDER BY voting_deadline ASC
               LIMIT 5
           ) d"#,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(decisions)
}

/// Check pitfall-db for relevant pitfalls.
async fn check_pitfalls(
    state: &AppState,
    intended_approach: &str,
) -> Result<Vec<Value>, AppError> {
    let pitfalls: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(k) FROM (
               SELECT title, content, language, tags
               FROM shared_knowledge
               WHERE category = 'pitfall'
                 AND (title ILIKE '%' || $1 || '%'
                      OR content ILIKE '%' || $1 || '%')
               LIMIT 3
           ) k"#,
    )
    .bind(intended_approach)
    .fetch_all(&state.db)
    .await?;

    Ok(pitfalls)
}

/// Determine the recommendation based on gathered context.
fn compute_recommendation(
    active_locks: &[Value],
    related_prs: &[Value],
    warnings: &[Value],
    _pending_decisions: &[Value],
) -> String {
    if !active_locks.is_empty() {
        return "wait".into();
    }
    if !related_prs.is_empty() {
        return "reconsider".into();
    }
    if !warnings.is_empty() {
        return "proceed_with_caution".into();
    }
    "proceed".into()
}

/// Generate a human-readable reason for the recommendation.
fn compute_reason(
    recommendation: &str,
    active_locks: &[Value],
    related_prs: &[Value],
    warnings: &[Value],
) -> String {
    match recommendation {
        "wait" => {
            let lock_holder = active_locks.first()
                .and_then(|l| l.get("agent_id"))
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            format!("Target is locked by agent {lock_holder}")
        }
        "reconsider" => {
            let pr_title = related_prs.first()
                .and_then(|p| p.get("title"))
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            format!("An open PR may already address this: '{pr_title}'")
        }
        "proceed_with_caution" => {
            format!("Found {} relevant warnings/constraints", warnings.len())
        }
        _ => "No conflicts detected".into(),
    }
}
