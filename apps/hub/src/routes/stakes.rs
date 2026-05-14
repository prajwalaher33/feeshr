//! Reputation stakes — agents put rep at risk on a verifiable claim.
//!
//! PR 1 of the staking series: create + list endpoints. The resolver
//! worker (PR 2) walks pending stakes whose `expires_at` has passed and
//! credits/slashes the staker based on the resolved outcome.
//!
//! See migration 016_reputation_stakes.sql for the data model.

use axum::{
    extract::{Query, State},
    response::Json,
};
use chrono::Utc;
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

use crate::errors::AppError;
use crate::state::AppState;

const VALID_TARGET_TYPES: &[&str] = &["pr", "pocc_chain", "consultation", "bounty", "audit"];

const VALID_CLAIMS: &[&str] = &[
    "pr_no_revert_7d",
    "pocc_chain_verified_30d",
    "consultation_accurate",
    "bounty_delivered_clean",
    "audit_finding_confirmed",
];

const MIN_AMOUNT: i64 = 1;
const MAX_AMOUNT: i64 = 10_000;

/// Default expiry windows per claim type, in hours.
fn default_expiry_hours(claim: &str) -> i64 {
    match claim {
        "pr_no_revert_7d" => 24 * 7,
        "pocc_chain_verified_30d" => 24 * 30,
        "consultation_accurate" => 24 * 14,
        "bounty_delivered_clean" => 24 * 7,
        "audit_finding_confirmed" => 24 * 14,
        _ => 24 * 7,
    }
}

#[derive(Deserialize)]
pub struct CreateStakeRequest {
    pub agent_id: String,
    pub target_type: String,
    pub target_id: String,
    pub claim: String,
    pub amount: i64,
    /// Optional override (hours). If absent, the per-claim default applies.
    pub expires_in_hours: Option<i64>,
    pub rationale: Option<String>,
}

/// POST /api/v1/stakes — commit collateral against a claim.
///
/// Validates target_type/claim/amount, enforces an upper bound on
/// expiry, and inserts the stake in `pending` status. The actual
/// reputation deduction happens at resolution time, not commit time —
/// committing only registers the claim.
pub async fn create_stake(
    State(state): State<AppState>,
    Json(req): Json<CreateStakeRequest>,
) -> Result<Json<Value>, AppError> {
    if !VALID_TARGET_TYPES.contains(&req.target_type.as_str()) {
        return Err(AppError::Validation(format!(
            "target_type must be one of: {}",
            VALID_TARGET_TYPES.join(", ")
        )));
    }
    if !VALID_CLAIMS.contains(&req.claim.as_str()) {
        return Err(AppError::Validation(format!(
            "claim must be one of: {}",
            VALID_CLAIMS.join(", ")
        )));
    }
    if !(MIN_AMOUNT..=MAX_AMOUNT).contains(&req.amount) {
        return Err(AppError::Validation(format!(
            "amount must be between {MIN_AMOUNT} and {MAX_AMOUNT}"
        )));
    }

    let target_uuid = req
        .target_id
        .parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid target_id".into()))?;

    // Cap user-supplied expiry at 90 days so a runaway value can't
    // pin reputation forever.
    let hours = req
        .expires_in_hours
        .unwrap_or_else(|| default_expiry_hours(&req.claim))
        .clamp(1, 24 * 90);
    let expires_at = Utc::now() + chrono::Duration::hours(hours);

    // Verify agent has at least the staked amount in current reputation —
    // we don't deduct yet, but staking more than you have is incoherent.
    let current_rep: Option<(i64,)> = sqlx::query_as("SELECT reputation FROM agents WHERE id = $1")
        .bind(&req.agent_id)
        .fetch_optional(&state.db)
        .await?;
    let current = match current_rep {
        Some((r,)) => r,
        None => {
            return Err(AppError::AgentNotFound {
                agent_id: req.agent_id.clone(),
            })
        }
    };
    if current < req.amount {
        return Err(AppError::Validation(format!(
            "agent reputation ({current}) is below stake amount ({})",
            req.amount
        )));
    }

    let id = Uuid::new_v4();
    sqlx::query(
        r#"INSERT INTO reputation_stakes
           (id, agent_id, target_type, target_id, claim, amount, expires_at, rationale)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"#,
    )
    .bind(id)
    .bind(&req.agent_id)
    .bind(&req.target_type)
    .bind(target_uuid)
    .bind(&req.claim)
    .bind(req.amount)
    .bind(expires_at)
    .bind(&req.rationale)
    .execute(&state.db)
    .await?;

    tracing::info!(
        stake_id = %id,
        agent_id = %req.agent_id,
        target_type = %req.target_type,
        claim = %req.claim,
        amount = req.amount,
        expires_at = %expires_at,
        "stake_committed"
    );

    Ok(Json(serde_json::json!({
        "id": id,
        "expires_at": expires_at,
        "status": "pending",
    })))
}

#[derive(Deserialize)]
pub struct ListStakesQuery {
    pub agent_id: Option<String>,
    pub target_type: Option<String>,
    pub target_id: Option<String>,
    pub status: Option<String>,
    pub limit: Option<i64>,
}

/// GET /api/v1/stakes — list stakes, filterable by agent / target / status.
pub async fn list_stakes(
    State(state): State<AppState>,
    Query(params): Query<ListStakesQuery>,
) -> Result<Json<Value>, AppError> {
    let limit = params.limit.unwrap_or(50).min(200);

    // Optional UUID parse — invalid IDs return zero results, not 400.
    let target_uuid = params
        .target_id
        .as_deref()
        .and_then(|s| s.parse::<Uuid>().ok());

    let stakes: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(s) FROM (
               SELECT id, agent_id, target_type, target_id, claim, amount,
                      expires_at, status, resolved_at, resolution_evidence,
                      rationale, created_at
               FROM reputation_stakes
               WHERE ($1::text IS NULL OR agent_id = $1)
                 AND ($2::text IS NULL OR target_type = $2)
                 AND ($3::uuid IS NULL OR target_id = $3)
                 AND ($4::text IS NULL OR status = $4)
               ORDER BY
                   CASE status WHEN 'pending' THEN 0 ELSE 1 END,
                   expires_at ASC
               LIMIT $5
           ) s"#,
    )
    .bind(&params.agent_id)
    .bind(&params.target_type)
    .bind(target_uuid)
    .bind(&params.status)
    .bind(limit)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "stakes": stakes,
        "total": stakes.len(),
    })))
}

/// GET /api/v1/agents/:id/stake-summary — aggregate from agent_stake_summary view.
pub async fn get_agent_stake_summary(
    axum::extract::Path(id): axum::extract::Path<String>,
    State(state): State<AppState>,
) -> Result<Json<Value>, AppError> {
    let row: Option<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(s) FROM (
               SELECT agent_id, open_stakes, at_risk, won_total, lost_total,
                      wins, losses
               FROM agent_stake_summary
               WHERE agent_id = $1
           ) s"#,
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await?;

    Ok(Json(row.unwrap_or_else(|| {
        serde_json::json!({
            "agent_id": id,
            "open_stakes": 0,
            "at_risk": 0,
            "won_total": 0,
            "lost_total": 0,
            "wins": 0,
            "losses": 0,
        })
    })))
}
