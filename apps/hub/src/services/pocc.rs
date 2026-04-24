//! Proof of Command Correctness (PoCC) chain management.
//!
//! Manages the lifecycle of PoCC chains: creation, step recording,
//! sealing, verification, and invalidation. Each chain is a
//! cryptographic proof that an agent committed its intent before
//! executing actions and that execution matched intent.

use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha3::{Digest, Sha3_256};
use sqlx::PgPool;
use tracing::{info, warn};
use uuid::Uuid;

use crate::errors::AppError;

/// Compute SHA3-256 hash of bytes, returning hex string.
fn sha3_hex(data: &[u8]) -> String {
    let mut hasher = Sha3_256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

/// Request to create a new PoCC chain.
#[derive(Debug, Deserialize)]
pub struct CreateChainRequest {
    pub work_type: String,
    pub work_ref_type: String,
    pub work_ref_id: Uuid,
}

/// A single step in a sealed chain submission.
#[derive(Debug, Deserialize, Serialize)]
pub struct StepPayload {
    pub step_index: i32,
    pub commitment_hash: String,
    pub intent: Value,
    pub context_hash: String,
    pub previous_step_hash: Option<String>,
    pub committed_at: f64,
    pub execution_witness: Value,
    pub executed_at: f64,
    pub consistency_check: Value,
    pub is_consistent: bool,
    pub verified_at: f64,
    pub step_hash: String,
}

/// Request to seal a PoCC chain.
#[derive(Debug, Deserialize)]
pub struct SealChainRequest {
    pub steps: Vec<StepPayload>,
    pub root_hash: String,
    pub final_hash: String,
    pub chain_signature: String,
}

/// Result of chain verification.
#[derive(Debug, Serialize)]
pub struct VerificationResult {
    pub verified: bool,
    pub step_results: Vec<StepVerification>,
    pub errors: Vec<String>,
}

/// Verification result for a single step.
#[derive(Debug, Serialize)]
pub struct StepVerification {
    pub step_index: i32,
    pub commitment_valid: bool,
    pub chain_link_valid: bool,
    pub consistency_valid: bool,
}

/// Create a new PoCC chain.
pub async fn create_chain(
    db: &PgPool,
    agent_id: &str,
    req: &CreateChainRequest,
) -> Result<Uuid, AppError> {
    let valid_types = [
        "pr_submission",
        "pr_review",
        "bounty_delivery",
        "benchmark_exam",
        "project_contribution",
        "security_audit",
    ];
    if !valid_types.contains(&req.work_type.as_str()) {
        return Err(AppError::Validation(format!(
            "Invalid work_type: {}. Must be one of: {}",
            req.work_type,
            valid_types.join(", ")
        )));
    }

    let chain_id = Uuid::new_v4();

    sqlx::query(
        r#"INSERT INTO pocc_chains
           (id, agent_id, work_type, work_ref_type, work_ref_id)
           VALUES ($1, $2, $3, $4, $5)"#,
    )
    .bind(chain_id)
    .bind(agent_id)
    .bind(&req.work_type)
    .bind(&req.work_ref_type)
    .bind(req.work_ref_id)
    .execute(db)
    .await?;

    info!(
        chain_id = %chain_id,
        agent_id = agent_id,
        work_type = %req.work_type,
        "PoCC chain created"
    );

    Ok(chain_id)
}

/// Seal a PoCC chain with all its steps.
pub async fn seal_chain(
    db: &PgPool,
    chain_id: Uuid,
    agent_id: &str,
    req: &SealChainRequest,
) -> Result<Value, AppError> {
    // Verify chain ownership and status
    let (chain_agent, status): (String, String) =
        sqlx::query_as(r#"SELECT agent_id, status FROM pocc_chains WHERE id = $1"#)
            .bind(chain_id)
            .fetch_optional(db)
            .await?
            .ok_or_else(|| AppError::NotFound("PoCC chain not found".to_string()))?;

    if chain_agent != agent_id {
        return Err(AppError::Forbidden("Not your PoCC chain".to_string()));
    }
    if status != "building" {
        return Err(AppError::Conflict {
            message: format!("Chain is already {status}"),
        });
    }

    if req.steps.is_empty() {
        return Err(AppError::Validation(
            "Chain must have at least one step".to_string(),
        ));
    }

    // Validate chain integrity
    validate_chain_integrity(&req.steps, &req.root_hash, &req.final_hash)?;

    // Check all steps are consistent
    let all_consistent = req.steps.iter().all(|s| s.is_consistent);
    if !all_consistent {
        return Err(AppError::Validation(
            "All steps must be consistent to seal chain".to_string(),
        ));
    }

    // Insert steps
    for step in &req.steps {
        sqlx::query(
            r#"INSERT INTO pocc_steps
               (chain_id, step_index, commitment_hash, intent, context_hash,
                previous_step_hash, committed_at, execution_witness,
                executed_at, consistency_check, is_consistent, verified_at, step_hash)
               VALUES ($1, $2, $3, $4, $5, $6,
                       to_timestamp($7), $8,
                       to_timestamp($9), $10, $11, to_timestamp($12), $13)"#,
        )
        .bind(chain_id)
        .bind(step.step_index)
        .bind(&step.commitment_hash)
        .bind(&step.intent)
        .bind(&step.context_hash)
        .bind(&step.previous_step_hash)
        .bind(step.committed_at)
        .bind(&step.execution_witness)
        .bind(step.executed_at)
        .bind(&step.consistency_check)
        .bind(step.is_consistent)
        .bind(step.verified_at)
        .bind(&step.step_hash)
        .execute(db)
        .await?;
    }

    // Seal the chain
    sqlx::query(
        r#"UPDATE pocc_chains
           SET status = 'sealed',
               root_hash = $2,
               final_hash = $3,
               step_count = $4,
               chain_signature = $5,
               sealed_at = NOW()
           WHERE id = $1"#,
    )
    .bind(chain_id)
    .bind(&req.root_hash)
    .bind(&req.final_hash)
    .bind(req.steps.len() as i32)
    .bind(&req.chain_signature)
    .execute(db)
    .await?;

    info!(
        chain_id = %chain_id,
        step_count = req.steps.len(),
        "PoCC chain sealed"
    );

    Ok(serde_json::json!({
        "chain_id": chain_id,
        "status": "sealed",
        "step_count": req.steps.len(),
    }))
}

/// Validate that step hashes form a valid chain.
fn validate_chain_integrity(
    steps: &[StepPayload],
    root_hash: &str,
    final_hash: &str,
) -> Result<(), AppError> {
    if steps.is_empty() {
        return Err(AppError::Validation("No steps provided".to_string()));
    }

    // First step should have no previous_step_hash
    if steps[0].previous_step_hash.is_some() {
        return Err(AppError::Validation(
            "First step must not have a previous_step_hash".to_string(),
        ));
    }

    // Root hash must match first step
    if steps[0].step_hash != root_hash {
        return Err(AppError::Validation(
            "Root hash does not match first step hash".to_string(),
        ));
    }

    // Final hash must match last step
    let last = steps.last().expect("steps is non-empty");
    if last.step_hash != final_hash {
        return Err(AppError::Validation(
            "Final hash does not match last step hash".to_string(),
        ));
    }

    // Each step must link to the previous
    for i in 1..steps.len() {
        let expected = Some(steps[i - 1].step_hash.clone());
        if steps[i].previous_step_hash != expected {
            return Err(AppError::Validation(format!(
                "Step {} previous_step_hash does not match step {} hash",
                i,
                i - 1
            )));
        }
    }

    // Step indices must be sequential
    for (i, step) in steps.iter().enumerate() {
        if step.step_index != i as i32 {
            return Err(AppError::Validation(format!(
                "Step index mismatch: expected {i}, got {}",
                step.step_index
            )));
        }
    }

    Ok(())
}

/// Invalidate a PoCC chain.
pub async fn invalidate_chain(
    db: &PgPool,
    chain_id: Uuid,
    agent_id: &str,
    reason: &str,
) -> Result<(), AppError> {
    let (chain_agent, status): (String, String) =
        sqlx::query_as(r#"SELECT agent_id, status FROM pocc_chains WHERE id = $1"#)
            .bind(chain_id)
            .fetch_optional(db)
            .await?
            .ok_or_else(|| AppError::NotFound("PoCC chain not found".to_string()))?;

    if chain_agent != agent_id && agent_id != "system" {
        return Err(AppError::Forbidden("Not your PoCC chain".to_string()));
    }

    if status == "invalid" {
        return Ok(());
    }

    sqlx::query(
        r#"UPDATE pocc_chains SET status = 'invalid',
           verification_result = $2 WHERE id = $1"#,
    )
    .bind(chain_id)
    .bind(serde_json::json!({"invalidation_reason": reason}))
    .execute(db)
    .await?;

    warn!(chain_id = %chain_id, reason = reason, "PoCC chain invalidated");

    Ok(())
}

/// Get a full PoCC chain with all steps.
pub async fn get_chain(db: &PgPool, chain_id: Uuid) -> Result<Value, AppError> {
    let chain = sqlx::query_as::<
        _,
        (
            Uuid,
            String,
            String,
            String,
            Uuid,
            String,
            Option<String>,
            Option<String>,
            i32,
            Option<chrono::DateTime<Utc>>,
            Option<String>,
            Option<Value>,
            Option<String>,
            chrono::DateTime<Utc>,
            Option<chrono::DateTime<Utc>>,
        ),
    >(
        r#"SELECT id, agent_id, work_type, work_ref_type, work_ref_id,
                  status, root_hash, final_hash, step_count,
                  verified_at, verified_by, verification_result,
                  chain_signature, created_at, sealed_at
           FROM pocc_chains WHERE id = $1"#,
    )
    .bind(chain_id)
    .fetch_optional(db)
    .await?
    .ok_or_else(|| AppError::NotFound("PoCC chain not found".to_string()))?;

    let steps = sqlx::query_as::<
        _,
        (
            i32,
            String,
            Value,
            String,
            Option<String>,
            chrono::DateTime<Utc>,
            Option<Value>,
            Option<chrono::DateTime<Utc>>,
            Option<Value>,
            Option<bool>,
            Option<chrono::DateTime<Utc>>,
            String,
        ),
    >(
        r#"SELECT step_index, commitment_hash, intent, context_hash,
                  previous_step_hash, committed_at, execution_witness,
                  executed_at, consistency_check, is_consistent,
                  verified_at, step_hash
           FROM pocc_steps
           WHERE chain_id = $1
           ORDER BY step_index"#,
    )
    .bind(chain_id)
    .fetch_all(db)
    .await?;

    let steps_json: Vec<Value> = steps
        .into_iter()
        .map(
            |(
                idx,
                commitment,
                intent,
                ctx_hash,
                prev_hash,
                committed,
                witness,
                executed,
                consistency,
                consistent,
                verified,
                step_hash,
            )| {
                serde_json::json!({
                    "step_index": idx,
                    "commitment_hash": commitment,
                    "intent": intent,
                    "context_hash": ctx_hash,
                    "previous_step_hash": prev_hash,
                    "committed_at": committed.to_rfc3339(),
                    "execution_witness": witness,
                    "executed_at": executed.map(|d| d.to_rfc3339()),
                    "consistency_check": consistency,
                    "is_consistent": consistent,
                    "verified_at": verified.map(|d| d.to_rfc3339()),
                    "step_hash": step_hash,
                })
            },
        )
        .collect();

    let (
        id,
        agent_id,
        work_type,
        work_ref_type,
        work_ref_id,
        status,
        root_hash,
        final_hash,
        step_count,
        verified_at,
        verified_by,
        verification_result,
        chain_signature,
        created_at,
        sealed_at,
    ) = chain;

    Ok(serde_json::json!({
        "id": id,
        "agent_id": agent_id,
        "work_type": work_type,
        "work_ref_type": work_ref_type,
        "work_ref_id": work_ref_id,
        "status": status,
        "root_hash": root_hash,
        "final_hash": final_hash,
        "step_count": step_count,
        "verified_at": verified_at.map(|d| d.to_rfc3339()),
        "verified_by": verified_by,
        "verification_result": verification_result,
        "chain_signature": chain_signature,
        "created_at": created_at.to_rfc3339(),
        "sealed_at": sealed_at.map(|d| d.to_rfc3339()),
        "steps": steps_json,
    }))
}

/// Re-verify a PoCC chain from scratch.
pub async fn verify_chain(db: &PgPool, chain_id: Uuid) -> Result<VerificationResult, AppError> {
    let (status, root_hash, final_hash): (String, Option<String>, Option<String>) =
        sqlx::query_as(r#"SELECT status, root_hash, final_hash FROM pocc_chains WHERE id = $1"#)
            .bind(chain_id)
            .fetch_optional(db)
            .await?
            .ok_or_else(|| AppError::NotFound("PoCC chain not found".to_string()))?;

    if status == "building" {
        return Err(AppError::Validation(
            "Cannot verify a chain that is still building".to_string(),
        ));
    }

    let steps = sqlx::query_as::<
        _,
        (
            i32,
            String,
            Value,
            String,
            Option<String>,
            Option<Value>,
            Option<bool>,
            String,
        ),
    >(
        r#"SELECT step_index, commitment_hash, intent, context_hash,
                  previous_step_hash, execution_witness,
                  is_consistent, step_hash
           FROM pocc_steps
           WHERE chain_id = $1
           ORDER BY step_index"#,
    )
    .bind(chain_id)
    .fetch_all(db)
    .await?;

    let mut errors = Vec::new();
    let mut step_results = Vec::new();
    let mut all_valid = true;

    for (i, step) in steps.iter().enumerate() {
        let (
            idx,
            commitment_hash,
            intent,
            context_hash,
            previous_step_hash,
            witness,
            is_consistent,
            step_hash,
        ) = step;

        let mut step_ok = true;

        // Verify commitment hash: sha3(intent + context_hash + previous + chain_id + step_index)
        let commitment_input = serde_json::json!({
            "intent": intent,
            "context_hash": context_hash,
            "previous_step_hash": previous_step_hash,
            "chain_id": chain_id.to_string(),
            "step_index": idx,
        });
        let computed_commitment = sha3_hex(
            serde_json::to_string(&commitment_input)
                .unwrap_or_default()
                .as_bytes(),
        );
        let commitment_valid = computed_commitment == *commitment_hash;
        if !commitment_valid {
            errors.push(format!("Step {idx}: commitment hash mismatch"));
            step_ok = false;
        }

        // Verify chain linking
        let chain_link_valid = if i == 0 {
            previous_step_hash.is_none()
        } else {
            previous_step_hash.as_ref() == Some(&steps[i - 1].7)
        };
        if !chain_link_valid {
            errors.push(format!("Step {idx}: chain link broken"));
            step_ok = false;
        }

        // Verify consistency
        let consistency_valid = is_consistent.unwrap_or(false);
        if !consistency_valid {
            errors.push(format!("Step {idx}: inconsistent"));
            step_ok = false;
        }

        // Verify step hash
        let witness_hash = sha3_hex(
            serde_json::to_string(witness)
                .unwrap_or_default()
                .as_bytes(),
        );
        let step_data = serde_json::json!({
            "commitment_hash": commitment_hash,
            "execution_witness_hash": witness_hash,
            "is_consistent": is_consistent,
            "previous_step_hash": previous_step_hash,
        });
        let computed_step_hash = sha3_hex(
            serde_json::to_string(&step_data)
                .unwrap_or_default()
                .as_bytes(),
        );
        if computed_step_hash != *step_hash {
            errors.push(format!("Step {idx}: step hash mismatch"));
            step_ok = false;
        }

        if !step_ok {
            all_valid = false;
        }

        step_results.push(StepVerification {
            step_index: *idx,
            commitment_valid,
            chain_link_valid,
            consistency_valid,
        });
    }

    // Verify root/final hashes
    if let Some(root) = &root_hash {
        if steps.first().map(|s| &s.7) != Some(root) {
            errors.push("Root hash does not match first step".to_string());
            all_valid = false;
        }
    }
    if let Some(final_h) = &final_hash {
        if steps.last().map(|s| &s.7) != Some(final_h) {
            errors.push("Final hash does not match last step".to_string());
            all_valid = false;
        }
    }

    // Update verification status
    let new_status = if all_valid { "verified" } else { "invalid" };
    sqlx::query(
        r#"UPDATE pocc_chains
           SET verified_at = NOW(), verified_by = 'system',
               verification_result = $2, status = $3
           WHERE id = $1"#,
    )
    .bind(chain_id)
    .bind(serde_json::json!({
        "verified": all_valid,
        "errors": &errors,
        "step_count": steps.len(),
    }))
    .bind(new_status)
    .execute(db)
    .await?;

    Ok(VerificationResult {
        verified: all_valid,
        step_results,
        errors,
    })
}

/// Get PoCC stats for an agent.
pub async fn get_agent_pocc_stats(db: &PgPool, agent_id: &str) -> Result<Value, AppError> {
    let total: i64 = sqlx::query_scalar(r#"SELECT COUNT(*) FROM pocc_chains WHERE agent_id = $1"#)
        .bind(agent_id)
        .fetch_one(db)
        .await?;

    let verified: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM pocc_chains
           WHERE agent_id = $1 AND status = 'verified'"#,
    )
    .bind(agent_id)
    .fetch_one(db)
    .await?;

    let invalid: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM pocc_chains
           WHERE agent_id = $1 AND status = 'invalid'"#,
    )
    .bind(agent_id)
    .fetch_one(db)
    .await?;

    let consistency_rate = if total > 0 {
        verified as f64 / total as f64
    } else {
        0.0
    };

    let avg_steps: Option<f64> = sqlx::query_scalar(
        r#"SELECT AVG(step_count)::float8 FROM pocc_chains
           WHERE agent_id = $1 AND status IN ('sealed', 'verified')"#,
    )
    .bind(agent_id)
    .fetch_one(db)
    .await?;

    let work_types = sqlx::query_as::<_, (String, i64)>(
        r#"SELECT work_type, COUNT(*)
           FROM pocc_chains WHERE agent_id = $1
           GROUP BY work_type"#,
    )
    .bind(agent_id)
    .fetch_all(db)
    .await?;

    let work_types_json: Value = work_types
        .into_iter()
        .map(|(t, c)| (t, Value::from(c)))
        .collect::<serde_json::Map<String, Value>>()
        .into();

    Ok(serde_json::json!({
        "total_chains": total,
        "verified_chains": verified,
        "invalid_chains": invalid,
        "consistency_rate": consistency_rate,
        "avg_steps_per_chain": avg_steps.unwrap_or(0.0),
        "work_types": work_types_json,
    }))
}
