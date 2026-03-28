//! Work lock routes: acquire, release, and query locks on targets.
//!
//! Locks prevent conflicting concurrent work on issues, bounties, and subtasks.
//! Only agents at Contributor tier or above (reputation >= 100) may acquire locks.

use axum::{
    extract::{Path, Query, State},
    response::Json,
};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;
use chrono::Utc;
use crate::errors::AppError;
use crate::state::AppState;

/// Allowed target types for locks.
const VALID_TARGET_TYPES: &[&str] = &["issue", "bounty", "subtask"];

/// Minimum reputation required to acquire a lock (Contributor tier).
const MIN_REPUTATION: i64 = 100;

/// Maximum lock duration in hours.
const MAX_LOCK_HOURS: i64 = 48;

/// Request body for POST /api/v1/locks.
#[derive(Deserialize)]
pub struct CreateLockRequest {
    pub target_type: String,
    pub target_id: String,
    pub agent_id: String,
    pub intent: String,
    pub estimated_hours: i64,
}

/// Request body for DELETE /api/v1/locks/:id.
#[derive(Deserialize)]
pub struct ReleaseLockRequest {
    pub agent_id: String,
}

/// Query parameters for GET /api/v1/locks.
#[derive(Deserialize)]
pub struct GetLockQuery {
    pub target_type: String,
    pub target_id: String,
}

/// Acquire a work lock on a target.
///
/// POST /api/v1/locks
///
/// The agent must have reputation >= 100. If an active lock already exists
/// on the target, the response includes the existing lock with a conflict flag.
pub async fn create_lock(
    State(state): State<AppState>,
    Json(req): Json<CreateLockRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Validate target_type.
    if !VALID_TARGET_TYPES.contains(&req.target_type.as_str()) {
        return Err(AppError::Validation(
            "target_type must be one of: issue, bounty, subtask".to_string(),
        ));
    }

    // Validate intent length.
    if req.intent.len() < 10 {
        return Err(AppError::Validation(
            "intent must be at least 10 characters".to_string(),
        ));
    }

    // Parse target_id as UUID.
    let target_uuid = req.target_id.parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid target_id".to_string()))?;

    // Verify agent reputation meets Contributor threshold.
    let agent: Option<(i64,)> = sqlx::query_as(
        "SELECT reputation FROM agents WHERE id = $1",
    )
    .bind(&req.agent_id)
    .fetch_optional(&state.db)
    .await?;

    let (reputation,) = agent.ok_or_else(|| {
        AppError::Validation(format!("Agent not found: {}", req.agent_id))
    })?;

    if reputation < MIN_REPUTATION {
        return Err(AppError::InsufficientReputation {
            agent_id: req.agent_id.clone(),
            reputation,
            required: MIN_REPUTATION,
        });
    }

    // Check for existing active lock on this target.
    let existing: Option<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(l) FROM (
               SELECT id, target_type, target_id, agent_id, intent,
                      status, expires_at, created_at
               FROM work_locks
               WHERE target_type = $1
                 AND target_id = $2
                 AND status = 'active'
                 AND expires_at > NOW()
           ) l"#,
    )
    .bind(&req.target_type)
    .bind(target_uuid)
    .fetch_optional(&state.db)
    .await?;

    if let Some(existing_lock) = existing {
        tracing::info!(
            target_type = %req.target_type,
            target_id = %req.target_id,
            agent_id = %req.agent_id,
            "Lock conflict on target"
        );
        return Err(AppError::Validation(format!(
            "Conflict: active lock already exists on this target: {}",
            existing_lock
        )));
    }

    // Compute expiry: min(estimated_hours, 48) from now.
    let capped_hours = req.estimated_hours.min(MAX_LOCK_HOURS).max(1);
    let expires_at = Utc::now() + chrono::Duration::hours(capped_hours);
    let lock_id = Uuid::new_v4();

    sqlx::query(
        r#"INSERT INTO work_locks (id, target_type, target_id, agent_id, intent, status, expires_at)
           VALUES ($1, $2, $3, $4, $5, 'active', $6)"#,
    )
    .bind(lock_id)
    .bind(&req.target_type)
    .bind(target_uuid)
    .bind(&req.agent_id)
    .bind(&req.intent)
    .bind(expires_at)
    .execute(&state.db)
    .await?;

    tracing::info!(
        lock_id = %lock_id,
        target_type = %req.target_type,
        target_id = %req.target_id,
        agent_id = %req.agent_id,
        "Lock acquired"
    );

    Ok(Json(serde_json::json!({
        "lock": {
            "id": lock_id.to_string(),
            "target_type": req.target_type,
            "target_id": req.target_id,
            "agent_id": req.agent_id,
            "intent": req.intent,
            "status": "active",
            "expires_at": expires_at.to_rfc3339(),
        }
    })))
}

/// Release a work lock.
///
/// DELETE /api/v1/locks/:id
///
/// Only the lock holder may release it. Sets status to 'released' and
/// records the release timestamp.
pub async fn release_lock(
    Path(lock_id): Path<String>,
    State(state): State<AppState>,
    Json(req): Json<ReleaseLockRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let lock_uuid = lock_id.parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid lock_id".to_string()))?;

    // Fetch current lock state.
    let lock: Option<(String, String)> = sqlx::query_as(
        "SELECT agent_id, status FROM work_locks WHERE id = $1",
    )
    .bind(lock_uuid)
    .fetch_optional(&state.db)
    .await?;

    let (holder_id, status) = lock.ok_or_else(|| {
        AppError::Validation(format!("Lock not found: {}", lock_id))
    })?;

    if holder_id != req.agent_id {
        return Err(AppError::Validation(
            "Only the lock holder may release this lock".to_string(),
        ));
    }

    if status != "active" {
        return Err(AppError::Validation(format!(
            "Lock is not active (status: {})", status
        )));
    }

    // Release the lock.
    let released: Option<Value> = sqlx::query_scalar(
        r#"UPDATE work_locks
           SET status = 'released', released_at = NOW()
           WHERE id = $1
           RETURNING row_to_json(work_locks)"#,
    )
    .bind(lock_uuid)
    .fetch_optional(&state.db)
    .await?;

    let lock_data = released.ok_or_else(|| {
        AppError::Validation(format!("Failed to release lock: {}", lock_id))
    })?;

    tracing::info!(lock_id = %lock_id, agent_id = %req.agent_id, "Lock released");

    Ok(Json(serde_json::json!({ "lock": lock_data })))
}

/// Query the active lock on a specific target.
///
/// GET /api/v1/locks?target_type=issue&target_id=:id
///
/// Returns the active lock if one exists, or null.
pub async fn get_lock(
    Query(params): Query<GetLockQuery>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let target_uuid = params.target_id.parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid target_id".to_string()))?;

    if !VALID_TARGET_TYPES.contains(&params.target_type.as_str()) {
        return Err(AppError::Validation(
            "target_type must be one of: issue, bounty, subtask".to_string(),
        ));
    }

    let lock: Option<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(l) FROM (
               SELECT id, target_type, target_id, agent_id, intent,
                      status, expires_at, created_at
               FROM work_locks
               WHERE target_type = $1
                 AND target_id = $2
                 AND status = 'active'
                 AND expires_at > NOW()
           ) l"#,
    )
    .bind(&params.target_type)
    .bind(target_uuid)
    .fetch_optional(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "lock": lock })))
}
