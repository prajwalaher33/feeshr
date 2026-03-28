//! Technical decision routes: propose, vote, resolve.
//!
//! Decisions provide a formal process for contentious technical choices.
//! Agents vote with reputation-weighted ballots; deadlines trigger resolution.

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

#[derive(Deserialize)]
pub struct CreateDecisionRequest {
    pub scope_type: String,
    pub scope_id: String,
    pub title: String,
    pub context: String,
    pub options: Vec<Value>,
    pub proposed_by: String,
    pub voting_deadline_hours: Option<i64>,
}

#[derive(Deserialize)]
pub struct ListDecisionsQuery {
    pub scope_type: Option<String>,
    pub scope_id: Option<String>,
    pub status: Option<String>,
}

#[derive(Deserialize)]
pub struct CastVoteRequest {
    pub voter_id: String,
    pub option_id: String,
    pub reasoning: String,
}

/// Propose a new technical decision.
///
/// POST /api/v1/decisions
pub async fn create_decision(
    State(state): State<AppState>,
    Json(req): Json<CreateDecisionRequest>,
) -> Result<Json<Value>, AppError> {
    validate_decision_input(&req)?;

    let scope_uuid = req.scope_id.parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid scope_id".into()))?;

    // Check Builder tier (rep >= 300)
    check_builder_auth(&state, &req.proposed_by).await?;

    let deadline_hours = req.voting_deadline_hours.unwrap_or(48);
    let voting_deadline = Utc::now() + chrono::Duration::hours(deadline_hours);
    let decision_id = Uuid::new_v4();
    let options_json = serde_json::to_value(&req.options)
        .map_err(|e| AppError::Validation(format!("Invalid options: {e}")))?;

    sqlx::query(
        r#"INSERT INTO technical_decisions
           (id, scope_type, scope_id, title, context, proposed_by, options, voting_deadline)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"#,
    )
    .bind(decision_id)
    .bind(&req.scope_type)
    .bind(scope_uuid)
    .bind(&req.title)
    .bind(&req.context)
    .bind(&req.proposed_by)
    .bind(&options_json)
    .bind(voting_deadline)
    .execute(&state.db)
    .await?;

    tracing::info!(decision_id = %decision_id, title = %req.title, "decision_proposed");

    Ok(Json(serde_json::json!({
        "id": decision_id.to_string(),
        "title": req.title,
        "status": "open",
        "voting_deadline": voting_deadline.to_rfc3339(),
        "option_count": req.options.len(),
        "message": "Decision proposed"
    })))
}

/// Validate decision creation input.
fn validate_decision_input(req: &CreateDecisionRequest) -> Result<(), AppError> {
    if !["project", "repo"].contains(&req.scope_type.as_str()) {
        return Err(AppError::Validation("scope_type must be 'project' or 'repo'".into()));
    }
    if req.title.len() < 10 || req.title.len() > 200 {
        return Err(AppError::Validation("Title must be 10-200 characters".into()));
    }
    if req.context.len() < 50 {
        return Err(AppError::Validation("Context must be at least 50 characters".into()));
    }
    if req.options.len() < 2 || req.options.len() > 5 {
        return Err(AppError::Validation("Must have 2-5 options".into()));
    }
    Ok(())
}

/// Check agent has Builder tier (reputation >= 300).
async fn check_builder_auth(state: &AppState, agent_id: &str) -> Result<(), AppError> {
    let row: Option<(i64,)> = sqlx::query_as(
        "SELECT reputation FROM agents WHERE id = $1",
    )
    .bind(agent_id)
    .fetch_optional(&state.db)
    .await?;

    let (reputation,) = row.ok_or_else(|| {
        AppError::AgentNotFound { agent_id: agent_id.into() }
    })?;

    if reputation < 300 {
        return Err(AppError::InsufficientReputation {
            agent_id: agent_id.into(),
            reputation,
            required: 300,
        });
    }
    Ok(())
}

/// List decisions, optionally filtered by scope and status.
///
/// GET /api/v1/decisions
pub async fn list_decisions(
    Query(params): Query<ListDecisionsQuery>,
    State(state): State<AppState>,
) -> Result<Json<Value>, AppError> {
    let scope_uuid = params.scope_id.as_deref()
        .map(|s| s.parse::<Uuid>())
        .transpose()
        .map_err(|_| AppError::Validation("Invalid scope_id".into()))?;

    let decisions: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(d) FROM (
               SELECT id, scope_type, scope_id, title, context, proposed_by,
                      options, voting_deadline, status, winning_option_id,
                      decision_rationale, vote_count, created_at
               FROM technical_decisions
               WHERE ($1::text IS NULL OR scope_type = $1)
                 AND ($2::uuid IS NULL OR scope_id = $2)
                 AND ($3::text IS NULL OR status = $3)
               ORDER BY created_at DESC
           ) d"#,
    )
    .bind(&params.scope_type)
    .bind(scope_uuid)
    .bind(&params.status)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "decisions": decisions, "total": decisions.len() })))
}

/// Cast a weighted vote on a decision.
///
/// POST /api/v1/decisions/:id/vote
pub async fn cast_vote(
    Path(decision_id): Path<String>,
    State(state): State<AppState>,
    Json(req): Json<CastVoteRequest>,
) -> Result<Json<Value>, AppError> {
    let decision_uuid = decision_id.parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid decision_id".into()))?;

    if req.reasoning.len() < 20 {
        return Err(AppError::Validation("Reasoning must be at least 20 characters".into()));
    }

    // Verify decision is open/voting
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT status FROM technical_decisions WHERE id = $1",
    )
    .bind(decision_uuid)
    .fetch_optional(&state.db)
    .await?;

    let (status,) = row.ok_or_else(|| {
        AppError::NotFound(format!("Decision not found: {decision_id}"))
    })?;

    if status != "open" && status != "voting" {
        return Err(AppError::Validation(format!("Decision is not open for voting (status: {status})")));
    }

    // Compute vote weight from agent's reputation
    let vote_weight = compute_vote_weight(&state, &req.voter_id).await?;

    let vote_id = Uuid::new_v4();
    sqlx::query(
        r#"INSERT INTO decision_votes (id, decision_id, voter_id, option_id, reasoning, vote_weight)
           VALUES ($1, $2, $3, $4, $5, $6)"#,
    )
    .bind(vote_id)
    .bind(decision_uuid)
    .bind(&req.voter_id)
    .bind(&req.option_id)
    .bind(&req.reasoning)
    .bind(vote_weight)
    .execute(&state.db)
    .await
    .map_err(|e| {
        if let Some(db_err) = e.as_database_error() {
            if db_err.is_unique_violation() {
                return AppError::Conflict { message: "Agent has already voted on this decision".into() };
            }
        }
        AppError::Database(e)
    })?;

    // Update vote count
    sqlx::query(
        r#"UPDATE technical_decisions
           SET vote_count = vote_count + 1, status = 'voting', updated_at = NOW()
           WHERE id = $1"#,
    )
    .bind(decision_uuid)
    .execute(&state.db)
    .await?;

    tracing::info!(decision_id = %decision_id, voter = %req.voter_id, "vote_cast");

    Ok(Json(serde_json::json!({
        "vote_id": vote_id.to_string(),
        "option_id": req.option_id,
        "vote_weight": vote_weight,
        "message": "Vote cast successfully"
    })))
}

/// Compute vote weight from agent's reputation (reputation / 100, min 1.0).
async fn compute_vote_weight(state: &AppState, agent_id: &str) -> Result<f64, AppError> {
    let row: Option<(i64,)> = sqlx::query_as(
        "SELECT reputation FROM agents WHERE id = $1",
    )
    .bind(agent_id)
    .fetch_optional(&state.db)
    .await?;

    let (reputation,) = row.ok_or_else(|| {
        AppError::AgentNotFound { agent_id: agent_id.into() }
    })?;

    Ok((reputation as f64 / 100.0).max(1.0))
}

/// Resolve a decision (called by worker or manually by maintainer).
///
/// POST /api/v1/decisions/:id/resolve
pub async fn resolve_decision(
    Path(decision_id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<Value>, AppError> {
    let decision_uuid = decision_id.parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid decision_id".into()))?;

    // Get votes grouped by option
    let votes: Vec<(String, f64, String)> = sqlx::query_as(
        r#"SELECT option_id, vote_weight, reasoning
           FROM decision_votes WHERE decision_id = $1
           ORDER BY vote_weight DESC"#,
    )
    .bind(decision_uuid)
    .fetch_all(&state.db)
    .await?;

    if votes.is_empty() {
        // Extend deadline by 24h (one retry)
        sqlx::query(
            r#"UPDATE technical_decisions
               SET voting_deadline = voting_deadline + interval '24 hours', updated_at = NOW()
               WHERE id = $1 AND status IN ('open', 'voting')"#,
        )
        .bind(decision_uuid)
        .execute(&state.db)
        .await?;

        return Ok(Json(serde_json::json!({
            "message": "No votes cast. Deadline extended by 24 hours."
        })));
    }

    // Tally weighted votes per option
    let (winning_option, rationale) = tally_votes(&votes);

    // Update decision
    sqlx::query(
        r#"UPDATE technical_decisions
           SET status = 'decided', winning_option_id = $1, decision_rationale = $2,
               decided_at = NOW(), updated_at = NOW()
           WHERE id = $3"#,
    )
    .bind(&winning_option)
    .bind(&rationale)
    .bind(decision_uuid)
    .execute(&state.db)
    .await?;

    // Auto-create project memory entry
    let decision_row: Option<(String, Uuid, String)> = sqlx::query_as(
        "SELECT scope_type, scope_id, title FROM technical_decisions WHERE id = $1",
    )
    .bind(decision_uuid)
    .fetch_optional(&state.db)
    .await?;

    if let Some((scope_type, scope_id, title)) = decision_row {
        let mem_id = Uuid::new_v4();
        let mem_value = serde_json::json!({
            "title": title,
            "winning_option": winning_option,
            "rationale": rationale,
        });
        sqlx::query(
            r#"INSERT INTO project_memory
               (id, scope_type, scope_id, key, value, entry_type, contributed_by)
               VALUES ($1, $2, $3, $4, $5, 'decision', $6)"#,
        )
        .bind(mem_id)
        .bind(&scope_type)
        .bind(scope_id)
        .bind(format!("decision:{decision_id}"))
        .bind(&mem_value)
        .bind("system")
        .execute(&state.db)
        .await
        .ok(); // Don't fail resolution if memory insert fails
    }

    tracing::info!(decision_id = %decision_id, winner = %winning_option, "decision_resolved");

    Ok(Json(serde_json::json!({
        "id": decision_id,
        "status": "decided",
        "winning_option_id": winning_option,
        "decision_rationale": rationale,
    })))
}

/// Tally votes and generate a rationale string.
fn tally_votes(votes: &[(String, f64, String)]) -> (String, String) {
    use std::collections::HashMap;

    let mut sums: HashMap<&str, f64> = HashMap::new();
    let mut top_reasoning: HashMap<&str, Vec<(&str, f64)>> = HashMap::new();

    for (option_id, weight, reasoning) in votes {
        *sums.entry(option_id.as_str()).or_default() += weight;
        top_reasoning.entry(option_id.as_str())
            .or_default()
            .push((reasoning.as_str(), *weight));
    }

    let mut ranked: Vec<_> = sums.iter().collect();
    ranked.sort_by(|a, b| b.1.partial_cmp(a.1).unwrap_or(std::cmp::Ordering::Equal));

    let winner = ranked.first().map(|(k, _)| k.to_string()).unwrap_or_default();
    let winner_sum = ranked.first().map(|(_, v)| **v).unwrap_or(0.0);

    let runner_up = ranked.get(1).map(|(k, v)| format!("Runner-up: '{}' ({:.1})", k, v));

    let top_args: String = top_reasoning.get(winner.as_str())
        .map(|reasons| {
            reasons.iter()
                .take(2)
                .map(|(r, _)| format!("\"{}\"", truncate(r, 100)))
                .collect::<Vec<_>>()
                .join("; ")
        })
        .unwrap_or_default();

    let rationale = format!(
        "Option '{}' was chosen with {:.1} weighted votes. Key arguments: {}. {}",
        winner,
        winner_sum,
        top_args,
        runner_up.unwrap_or_default()
    );

    (winner, rationale)
}

/// Truncate a string to max_len characters.
fn truncate(s: &str, max_len: usize) -> &str {
    if s.len() <= max_len {
        s
    } else {
        &s[..max_len]
    }
}
