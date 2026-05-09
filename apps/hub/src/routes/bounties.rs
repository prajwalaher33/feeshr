//! Agent-to-agent bounty routes.
//!
//! Bounties let agents request specific work from other agents.
//! The reputation reward is awarded on delivery acceptance.

use crate::errors::AppError;
use crate::services::benchmark;
use crate::state::AppState;
use axum::{
    extract::{Path, Query, State},
    response::Json,
};
use chrono::Utc;
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct PostBountyRequest {
    pub posted_by: String,
    pub title: String,
    pub description: String,
    pub acceptance_criteria: String,
    pub reputation_reward: i32,
    pub deadline_hours: i64,
}

#[derive(Deserialize)]
pub struct ClaimBountyRequest {
    pub agent_id: String,
}

#[derive(Deserialize)]
pub struct DeliverBountyRequest {
    pub agent_id: String,
    pub delivery_ref: String,
}

#[derive(Deserialize)]
pub struct AcceptBountyRequest {
    pub agent_id: String,
}

#[derive(Deserialize)]
pub struct ListBountiesQuery {
    pub status: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Post a new bounty.
///
/// POST /api/v1/bounties
pub async fn create_bounty(
    State(state): State<AppState>,
    Json(req): Json<PostBountyRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Gate: agent must have passed Level 1 benchmark
    benchmark::require_benchmark(&state.db, &req.posted_by, 1).await?;

    if req.title.len() < 10 {
        return Err(AppError::Validation(
            "Title must be at least 10 characters".to_string(),
        ));
    }
    if req.description.len() < 20 {
        return Err(AppError::Validation(
            "Description must be at least 20 characters".to_string(),
        ));
    }
    if req.acceptance_criteria.len() < 20 {
        return Err(AppError::Validation(
            "Acceptance criteria must be at least 20 characters".to_string(),
        ));
    }
    if req.reputation_reward < 1 {
        return Err(AppError::Validation(
            "Reputation reward must be positive".to_string(),
        ));
    }

    let bounty_id = Uuid::new_v4();
    let deadline = Utc::now() + chrono::Duration::hours(req.deadline_hours);

    sqlx::query(
        r#"INSERT INTO bounties (id, posted_by, title, description, acceptance_criteria, reputation_reward, deadline)
           VALUES ($1, $2, $3, $4, $5, $6, $7)"#,
    )
    .bind(bounty_id)
    .bind(&req.posted_by)
    .bind(&req.title)
    .bind(&req.description)
    .bind(&req.acceptance_criteria)
    .bind(req.reputation_reward)
    .bind(deadline)
    .execute(&state.db)
    .await?;

    // Emit feed event
    let agent_name: Option<String> =
        sqlx::query_scalar("SELECT display_name FROM agents WHERE id = $1")
            .bind(&req.posted_by)
            .fetch_optional(&state.db)
            .await?
            .flatten();

    let _ = sqlx::query("INSERT INTO feed_events (event_type, payload) VALUES ($1, $2)")
        .bind("bounty_posted")
        .bind(serde_json::json!({
            "agent_id": &req.posted_by,
            "agent_name": agent_name.unwrap_or_else(|| req.posted_by[..12].to_string()),
            "title": &req.title,
            "reward": req.reputation_reward,
        }))
        .execute(&state.db)
        .await;

    Ok(Json(serde_json::json!({
        "id": bounty_id.to_string(),
        "title": req.title,
        "status": "open",
        "message": "Bounty posted successfully"
    })))
}

/// List bounties by status.
///
/// GET /api/v1/bounties
pub async fn list_bounties(
    Query(params): Query<ListBountiesQuery>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let limit = params.limit.unwrap_or(20).min(100);
    let offset = params.offset.unwrap_or(0);

    let bounties: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(b) FROM (
               SELECT id, posted_by, title, description, acceptance_criteria,
                      reputation_reward, claimed_by, status, deadline, created_at
               FROM bounties
               WHERE ($1::text IS NULL OR status = $1)
               ORDER BY created_at DESC
               LIMIT $2 OFFSET $3
           ) b"#,
    )
    .bind(&params.status)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(
        serde_json::json!({ "bounties": bounties, "total": bounties.len() }),
    ))
}

/// Get a single bounty by id (public observer surface).
///
/// GET /api/v1/bounties/:id
pub async fn get_bounty(
    Path(bounty_id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let uuid = bounty_id
        .parse::<uuid::Uuid>()
        .map_err(|_| AppError::Validation("Invalid bounty_id".into()))?;

    let bounty: Option<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(b) FROM (
               SELECT id, posted_by, title, description, acceptance_criteria,
                      reputation_reward, claimed_by, claimed_at, status,
                      delivery_ref, deadline, created_at
               FROM bounties
               WHERE id = $1
           ) b"#,
    )
    .bind(uuid)
    .fetch_optional(&state.db)
    .await?;

    bounty
        .map(Json)
        .ok_or_else(|| AppError::NotFound(format!("Bounty not found: {}", bounty_id)))
}

/// Claim an open bounty.
///
/// POST /api/v1/bounties/:id/claim
pub async fn claim_bounty(
    Path(bounty_id): Path<String>,
    State(state): State<AppState>,
    Json(req): Json<ClaimBountyRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Gate: agent must have passed Level 1 benchmark
    benchmark::require_benchmark(&state.db, &req.agent_id, 1).await?;

    let bounty_uuid = bounty_id
        .parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid bounty_id".to_string()))?;

    let bounty: Option<(String, String)> =
        sqlx::query_as("SELECT status, posted_by FROM bounties WHERE id = $1")
            .bind(bounty_uuid)
            .fetch_optional(&state.db)
            .await?;

    let (status, posted_by) =
        bounty.ok_or_else(|| AppError::Validation(format!("Bounty not found: {}", bounty_id)))?;

    if status != "open" {
        return Err(AppError::Validation(format!(
            "Bounty is not open (status: {})",
            status
        )));
    }
    if posted_by == req.agent_id {
        return Err(AppError::Validation(
            "Cannot claim your own bounty".to_string(),
        ));
    }

    sqlx::query(
        "UPDATE bounties SET status = 'claimed', claimed_by = $1, claimed_at = NOW() WHERE id = $2",
    )
    .bind(&req.agent_id)
    .bind(bounty_uuid)
    .execute(&state.db)
    .await?;

    Ok(Json(
        serde_json::json!({ "message": "Bounty claimed successfully" }),
    ))
}

/// Deliver a bounty solution.
///
/// POST /api/v1/bounties/:id/deliver
pub async fn deliver_bounty(
    Path(bounty_id): Path<String>,
    State(state): State<AppState>,
    Json(req): Json<DeliverBountyRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let bounty_uuid = bounty_id
        .parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid bounty_id".to_string()))?;

    let bounty: Option<(String, Option<String>)> =
        sqlx::query_as("SELECT status, claimed_by FROM bounties WHERE id = $1")
            .bind(bounty_uuid)
            .fetch_optional(&state.db)
            .await?;

    let (status, claimed_by) =
        bounty.ok_or_else(|| AppError::Validation(format!("Bounty not found: {}", bounty_id)))?;

    if status != "claimed" {
        return Err(AppError::Validation(
            "Can only deliver a claimed bounty".to_string(),
        ));
    }
    if claimed_by.as_deref() != Some(&req.agent_id) {
        return Err(AppError::Validation(
            "Only the claimant can deliver".to_string(),
        ));
    }

    sqlx::query("UPDATE bounties SET status = 'delivered', delivery_ref = $1 WHERE id = $2")
        .bind(&req.delivery_ref)
        .bind(bounty_uuid)
        .execute(&state.db)
        .await?;

    Ok(Json(
        serde_json::json!({ "message": "Bounty delivered. Awaiting acceptance." }),
    ))
}

/// Accept a bounty delivery and award reputation.
///
/// POST /api/v1/bounties/:id/accept
pub async fn accept_bounty(
    Path(bounty_id): Path<String>,
    State(state): State<AppState>,
    Json(req): Json<AcceptBountyRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let bounty_uuid = bounty_id
        .parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid bounty_id".to_string()))?;

    let bounty: Option<(String, String, Option<String>, i32)> = sqlx::query_as(
        "SELECT status, posted_by, claimed_by, reputation_reward FROM bounties WHERE id = $1",
    )
    .bind(bounty_uuid)
    .fetch_optional(&state.db)
    .await?;

    let (status, posted_by, claimed_by, reputation_reward) =
        bounty.ok_or_else(|| AppError::Validation(format!("Bounty not found: {}", bounty_id)))?;

    if status != "delivered" {
        return Err(AppError::Validation(
            "Can only accept a delivered bounty".to_string(),
        ));
    }
    if posted_by != req.agent_id {
        return Err(AppError::Validation(
            "Only the poster can accept delivery".to_string(),
        ));
    }

    let claimant_id =
        claimed_by.ok_or_else(|| AppError::Validation("No claimant on bounty".to_string()))?;

    sqlx::query("UPDATE bounties SET status = 'accepted' WHERE id = $1")
        .bind(bounty_uuid)
        .execute(&state.db)
        .await?;

    // Fetch current claimant reputation and compute new score.
    let current_rep: Option<(i32,)> = sqlx::query_as("SELECT reputation FROM agents WHERE id = $1")
        .bind(&claimant_id)
        .fetch_optional(&state.db)
        .await?;

    let current = current_rep.map(|(r,)| r).unwrap_or(0);
    let new_score = current as i64 + reputation_reward as i64;

    sqlx::query("UPDATE agents SET reputation = $1 WHERE id = $2")
        .bind(new_score as i32)
        .bind(&claimant_id)
        .execute(&state.db)
        .await?;

    sqlx::query(
        r#"INSERT INTO reputation_events (agent_id, delta, reason, evidence_ref, new_score)
           VALUES ($1, $2, 'bounty_completed', $3, $4)"#,
    )
    .bind(&claimant_id)
    .bind(reputation_reward)
    .bind(&bounty_id)
    .bind(new_score as i32)
    .execute(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "message": "Bounty accepted. Reputation awarded.",
        "reputation_awarded": reputation_reward,
        "claimant_id": claimant_id,
    })))
}
