//! Proof of Command Correctness (PoCC) routes.
//!
//! Endpoints for creating chains, sealing with steps, invalidating,
//! viewing chains, and publicly verifying chain integrity.

use axum::{
    extract::{Path, Query, State},
    response::Json,
};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

use crate::errors::AppError;
use crate::services::pocc;
use crate::state::AppState;

/// Query params for listing chains.
#[derive(Deserialize)]
pub struct ListChainsQuery {
    pub agent_id: Option<String>,
    pub status: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// List recent PoCC chains (public, summary only).
///
/// GET /api/v1/pocc/chains
pub async fn list_chains(
    State(state): State<AppState>,
    Query(params): Query<ListChainsQuery>,
) -> Result<Json<Value>, AppError> {
    let limit = params.limit.unwrap_or(30).min(100);
    let offset = params.offset.unwrap_or(0);

    let chains: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(c) FROM (
               SELECT id, agent_id, work_type, work_ref_type, work_ref_id,
                      status, step_count, root_hash, final_hash,
                      verified_at, created_at, sealed_at
               FROM pocc_chains
               WHERE ($1::text IS NULL OR agent_id = $1)
                 AND ($2::text IS NULL OR status = $2)
               ORDER BY created_at DESC
               LIMIT $3 OFFSET $4
           ) c"#,
    )
    .bind(&params.agent_id)
    .bind(&params.status)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "chains": chains,
        "total": chains.len(),
    })))
}

/// Create a new PoCC chain (with explicit agent_id).
///
/// POST /api/v1/pocc/chains
pub async fn create_chain_with_agent(
    State(state): State<AppState>,
    Json(req): Json<CreateChainWithAgentRequest>,
) -> Result<Json<Value>, AppError> {
    let create_req = pocc::CreateChainRequest {
        work_type: req.work_type,
        work_ref_type: req.work_ref_type,
        work_ref_id: req.work_ref_id,
    };
    let chain_id = pocc::create_chain(&state.db, &req.agent_id, &create_req).await?;

    Ok(Json(serde_json::json!({
        "chain_id": chain_id,
    })))
}

#[derive(Deserialize)]
pub struct CreateChainWithAgentRequest {
    pub agent_id: String,
    pub work_type: String,
    pub work_ref_type: String,
    pub work_ref_id: Uuid,
}

/// Seal a PoCC chain with all steps.
///
/// POST /api/v1/pocc/chains/:chain_id/seal
pub async fn seal_chain(
    State(state): State<AppState>,
    Path(chain_id): Path<Uuid>,
    Json(req): Json<SealChainWithAgentRequest>,
) -> Result<Json<Value>, AppError> {
    let seal_req = pocc::SealChainRequest {
        steps: req.steps,
        root_hash: req.root_hash,
        final_hash: req.final_hash,
        chain_signature: req.chain_signature,
    };
    let result = pocc::seal_chain(&state.db, chain_id, &req.agent_id, &seal_req).await?;

    // Broadcast event
    let _ = state.event_tx.send(
        serde_json::to_string(&serde_json::json!({
            "type": "pocc_chain_sealed",
            "chain_id": chain_id,
            "agent_id": req.agent_id,
            "step_count": seal_req.steps.len(),
            "timestamp": chrono::Utc::now().to_rfc3339(),
        }))
        .unwrap_or_default(),
    );

    Ok(Json(result))
}

#[derive(Deserialize)]
pub struct SealChainWithAgentRequest {
    pub agent_id: String,
    pub steps: Vec<pocc::StepPayload>,
    pub root_hash: String,
    pub final_hash: String,
    pub chain_signature: String,
}

/// Invalidate a PoCC chain.
///
/// POST /api/v1/pocc/chains/:chain_id/invalidate
pub async fn invalidate_chain(
    State(state): State<AppState>,
    Path(chain_id): Path<Uuid>,
    Json(req): Json<InvalidateRequest>,
) -> Result<Json<Value>, AppError> {
    pocc::invalidate_chain(&state.db, chain_id, &req.agent_id, &req.reason).await?;

    Ok(Json(serde_json::json!({
        "chain_id": chain_id,
        "status": "invalid",
    })))
}

#[derive(Deserialize)]
pub struct InvalidateRequest {
    pub agent_id: String,
    pub reason: String,
}

/// Get a full PoCC chain with all steps (public).
///
/// GET /api/v1/pocc/chains/:chain_id
pub async fn get_chain(
    State(state): State<AppState>,
    Path(chain_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    let chain = pocc::get_chain(&state.db, chain_id).await?;
    Ok(Json(chain))
}

/// Re-verify a PoCC chain from scratch (public).
///
/// GET /api/v1/pocc/verify/:chain_id
pub async fn verify_chain(
    State(state): State<AppState>,
    Path(chain_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    let result = pocc::verify_chain(&state.db, chain_id).await?;

    Ok(Json(serde_json::json!({
        "verified": result.verified,
        "step_results": result.step_results,
        "errors": result.errors,
    })))
}

/// Get PoCC stats for an agent (public).
///
/// GET /api/v1/agents/:id/pocc-stats
pub async fn get_agent_pocc_stats(
    State(state): State<AppState>,
    Path(agent_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let stats = pocc::get_agent_pocc_stats(&state.db, &agent_id).await?;
    Ok(Json(stats))
}
