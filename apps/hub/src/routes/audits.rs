//! Audit findings — adversarial pressure on shipped work.
//!
//! POST /audits creates an audit AND auto-creates a reputation_stake on
//! `audit_finding_confirmed` from the auditor. This forces skin in the
//! game on every accusation: if confirmed the auditor wins the stake;
//! if dismissed the auditor loses it. The stake_id is recorded on the
//! audit row so the resolver can look one up from the other.
//!
//! GET /audits supports filters by status / target / auditor.

use axum::{
    extract::{Path, Query, State},
    response::Json,
};
use chrono::Utc;
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

use crate::errors::AppError;
use crate::state::AppState;

const VALID_TARGET_TYPES: &[&str] = &["pocc_chain", "pr", "bounty"];
const VALID_SEVERITIES: &[&str] = &["low", "medium", "high", "critical"];
const MAX_CLAIM_LEN: usize = 500;

/// Stake amount per severity. High-severity accusations cost more rep
/// to file, which discourages spam at the high end without making low-
/// severity audits prohibitive.
fn stake_amount_for(severity: &str) -> i64 {
    match severity {
        "low" => 25,
        "medium" => 75,
        "high" => 200,
        "critical" => 500,
        _ => 25,
    }
}

/// Default expiry: audits resolve within 14 days. The resolver will
/// settle the linked stake on the same window.
const AUDIT_EXPIRY_HOURS: i64 = 24 * 14;

#[derive(Deserialize)]
pub struct CreateAuditRequest {
    pub auditor_id: String,
    pub target_type: String,
    pub target_id: String,
    pub severity: String,
    pub claim: String,
    pub evidence: Option<Value>,
}

/// POST /api/v1/audits — file an audit finding (auto-stakes the auditor).
pub async fn create_audit(
    State(state): State<AppState>,
    Json(req): Json<CreateAuditRequest>,
) -> Result<Json<Value>, AppError> {
    if !VALID_TARGET_TYPES.contains(&req.target_type.as_str()) {
        return Err(AppError::Validation(format!(
            "target_type must be one of: {}",
            VALID_TARGET_TYPES.join(", ")
        )));
    }
    if !VALID_SEVERITIES.contains(&req.severity.as_str()) {
        return Err(AppError::Validation(format!(
            "severity must be one of: {}",
            VALID_SEVERITIES.join(", ")
        )));
    }
    if req.claim.is_empty() || req.claim.len() > MAX_CLAIM_LEN {
        return Err(AppError::Validation(format!(
            "claim must be 1..={MAX_CLAIM_LEN} chars"
        )));
    }

    let target_uuid = req
        .target_id
        .parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid target_id".into()))?;

    // Verify auditor has at least the stake amount in rep.
    let stake_amt = stake_amount_for(&req.severity);
    let current_rep: Option<(i64,)> = sqlx::query_as("SELECT reputation FROM agents WHERE id = $1")
        .bind(&req.auditor_id)
        .fetch_optional(&state.db)
        .await?;
    let current = match current_rep {
        Some((r,)) => r,
        None => {
            return Err(AppError::AgentNotFound {
                agent_id: req.auditor_id.clone(),
            })
        }
    };
    if current < stake_amt {
        return Err(AppError::Validation(format!(
            "auditor reputation ({current}) is below required audit stake ({stake_amt}) for severity {}",
            req.severity
        )));
    }

    let audit_id = Uuid::new_v4();
    let stake_id = Uuid::new_v4();
    let expires_at = Utc::now() + chrono::Duration::hours(AUDIT_EXPIRY_HOURS);
    let evidence = req.evidence.unwrap_or_else(|| serde_json::json!({}));

    // Single tx: stake first (so the FK on audit.stake_id resolves),
    // then the audit. If either fails, neither lands.
    let mut tx = state.db.begin().await?;

    sqlx::query(
        r#"INSERT INTO reputation_stakes
           (id, agent_id, target_type, target_id, claim, amount, expires_at, rationale)
           VALUES ($1, $2, 'audit', $3, 'audit_finding_confirmed', $4, $5, $6)"#,
    )
    .bind(stake_id)
    .bind(&req.auditor_id)
    .bind(audit_id) // the stake target IS the audit row, by id
    .bind(stake_amt)
    .bind(expires_at)
    .bind(format!("auto-stake on audit finding ({})", req.severity))
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"INSERT INTO audit_findings
           (id, auditor_id, target_type, target_id, severity, claim, evidence, stake_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"#,
    )
    .bind(audit_id)
    .bind(&req.auditor_id)
    .bind(&req.target_type)
    .bind(target_uuid)
    .bind(&req.severity)
    .bind(&req.claim)
    .bind(&evidence)
    .bind(stake_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    tracing::info!(
        audit_id = %audit_id,
        stake_id = %stake_id,
        auditor_id = %req.auditor_id,
        target_type = %req.target_type,
        target_id = %req.target_id,
        severity = %req.severity,
        stake_amount = stake_amt,
        "audit_filed"
    );

    Ok(Json(serde_json::json!({
        "id": audit_id,
        "stake_id": stake_id,
        "stake_amount": stake_amt,
        "expires_at": expires_at,
        "status": "open",
    })))
}

#[derive(Deserialize)]
pub struct ListAuditsQuery {
    pub auditor_id: Option<String>,
    pub target_type: Option<String>,
    pub target_id: Option<String>,
    pub status: Option<String>,
    pub limit: Option<i64>,
}

/// GET /api/v1/audits — list with filters.
pub async fn list_audits(
    State(state): State<AppState>,
    Query(params): Query<ListAuditsQuery>,
) -> Result<Json<Value>, AppError> {
    let limit = params.limit.unwrap_or(50).min(200);

    let target_uuid = params
        .target_id
        .as_deref()
        .and_then(|s| s.parse::<Uuid>().ok());

    let audits: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(a) FROM (
               SELECT id, auditor_id, target_type, target_id, severity,
                      claim, evidence, status, stake_id, resolution_note,
                      created_at, resolved_at
               FROM audit_findings
               WHERE ($1::text IS NULL OR auditor_id = $1)
                 AND ($2::text IS NULL OR target_type = $2)
                 AND ($3::uuid IS NULL OR target_id = $3)
                 AND ($4::text IS NULL OR status = $4)
               ORDER BY
                   CASE status
                       WHEN 'open' THEN 0
                       WHEN 'disputed' THEN 1
                       ELSE 2
                   END,
                   created_at DESC
               LIMIT $5
           ) a"#,
    )
    .bind(&params.auditor_id)
    .bind(&params.target_type)
    .bind(target_uuid)
    .bind(&params.status)
    .bind(limit)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "audits": audits,
        "total": audits.len(),
    })))
}

/// GET /api/v1/agents/:id/audit-summary — aggregate from view.
pub async fn get_agent_audit_summary(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<Value>, AppError> {
    let row: Option<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(s) FROM (
               SELECT agent_id, open_audits, disputed_audits, confirmed_audits,
                      dismissed_audits, total_audits
               FROM agent_audit_summary
               WHERE agent_id = $1
           ) s"#,
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await?;

    Ok(Json(row.unwrap_or_else(|| {
        serde_json::json!({
            "agent_id": id,
            "open_audits": 0,
            "disputed_audits": 0,
            "confirmed_audits": 0,
            "dismissed_audits": 0,
            "total_audits": 0,
        })
    })))
}
