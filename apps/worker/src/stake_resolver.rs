//! Stake resolver: walks pending stakes whose `expires_at` has passed
//! and credits or slashes the staker based on the claim's outcome.
//!
//! Runs every 5 minutes. For each expired pending stake, the resolver
//! evaluates the claim against current DB state, then writes:
//!
//!   - status = won | lost | cancelled
//!   - resolution_evidence (JSONB describing the verdict)
//!   - resolved_at = NOW()
//!
//! and applies the reputation delta to the staker:
//!
//!   - won  → +amount
//!   - lost → -amount (clamped to 0)
//!   - cancelled → no delta (used when the evaluator is not yet
//!     implemented or evidence is unavailable; the stake registers but
//!     doesn't move rep)
//!
//! Resolver evidence is durable: every resolved stake keeps the JSON the
//! evaluator produced, so a later audit can see why each verdict landed.

use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Verdict {
    Won,
    Lost,
    Cancelled,
}

impl Verdict {
    fn as_status(self) -> &'static str {
        match self {
            Verdict::Won => "won",
            Verdict::Lost => "lost",
            Verdict::Cancelled => "cancelled",
        }
    }
}

/// Resolve all pending stakes whose `expires_at` has passed.
pub async fn run_stake_resolution(pool: &PgPool) -> Result<(), anyhow::Error> {
    let expired: Vec<(Uuid, String, String, Uuid, String, i64)> = sqlx::query_as(
        r#"SELECT id, agent_id, target_type, target_id, claim, amount
           FROM reputation_stakes
           WHERE status = 'pending' AND expires_at <= NOW()
           ORDER BY expires_at ASC
           LIMIT 200"#,
    )
    .fetch_all(pool)
    .await?;

    if expired.is_empty() {
        return Ok(());
    }

    let mut won = 0;
    let mut lost = 0;
    let mut cancelled = 0;

    for (stake_id, agent_id, target_type, target_id, claim, amount) in &expired {
        let (verdict, evidence) = evaluate_claim(pool, claim, target_type, *target_id).await;

        // Reputation delta. Slash floors at 0 so a slashed agent can't go
        // negative; this is the conservative default until we have an
        // explicit "debt" semantics.
        let delta: i64 = match verdict {
            Verdict::Won => *amount,
            Verdict::Lost => -*amount,
            Verdict::Cancelled => 0,
        };

        // Single transaction: mark the stake resolved AND adjust rep.
        // If either fails, the stake stays pending and the resolver
        // will retry on the next tick.
        let mut tx = pool.begin().await?;

        sqlx::query(
            r#"UPDATE reputation_stakes
               SET status = $1, resolved_at = NOW(), resolution_evidence = $2
               WHERE id = $3 AND status = 'pending'"#,
        )
        .bind(verdict.as_status())
        .bind(&evidence)
        .bind(stake_id)
        .execute(&mut *tx)
        .await?;

        if delta != 0 {
            sqlx::query(
                r#"UPDATE agents
                   SET reputation = GREATEST(0, reputation + $1)
                   WHERE id = $2"#,
            )
            .bind(delta)
            .bind(agent_id)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;

        match verdict {
            Verdict::Won => won += 1,
            Verdict::Lost => lost += 1,
            Verdict::Cancelled => cancelled += 1,
        }

        tracing::info!(
            stake_id = %stake_id,
            agent_id = %agent_id,
            claim = %claim,
            amount = amount,
            verdict = verdict.as_status(),
            delta = delta,
            "stake_resolved"
        );
    }

    tracing::info!(
        processed = expired.len(),
        won,
        lost,
        cancelled,
        "stake_resolution_tick"
    );
    Ok(())
}

/// Dispatch on claim type. Returns (verdict, evidence JSON).
///
/// Unimplemented evaluators return Cancelled so the stake registers
/// but doesn't move reputation — the operator can then ship a real
/// evaluator in a follow-up without leaving stuck pending rows.
async fn evaluate_claim(
    pool: &PgPool,
    claim: &str,
    target_type: &str,
    target_id: Uuid,
) -> (Verdict, Value) {
    match claim {
        "pocc_chain_verified_30d" => evaluate_pocc_chain_verified(pool, target_id).await,
        "pr_no_revert_7d" => evaluate_pr_no_revert(pool, target_id).await,
        // For an audit_finding_confirmed stake, target_id IS the
        // audit_findings.id row (see hub::routes::audits::create_audit).
        "audit_finding_confirmed" => evaluate_audit_finding_confirmed(pool, target_id).await,
        "bounty_delivered_clean" => evaluate_bounty_delivered_clean(pool, target_id).await,
        // Still stubbed — needs design pass; verifying a consultation's
        // accuracy means correlating its recommendation against what
        // actually shipped, which is fuzzy enough to deserve its own PR.
        "consultation_accurate" => (
            Verdict::Cancelled,
            json!({
                "evaluator": "not_implemented",
                "claim": claim,
                "target_type": target_type,
            }),
        ),
        _ => (
            Verdict::Cancelled,
            json!({ "evaluator": "unknown_claim", "claim": claim }),
        ),
    }
}

/// `bounty_delivered_clean`: the bounty must reach `accepted` to win.
/// `disputed` or `expired` lose. Anything else (still open / claimed /
/// delivered without verdict) cancels so the stake settles next tick
/// without prematurely moving rep.
async fn evaluate_bounty_delivered_clean(pool: &PgPool, bounty_id: Uuid) -> (Verdict, Value) {
    let row: Option<(String,)> = sqlx::query_as("SELECT status FROM bounties WHERE id = $1")
        .bind(bounty_id)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten();

    match row {
        Some((s,)) if s == "accepted" => (
            Verdict::Won,
            json!({ "evaluator": "bounty_status", "status": s }),
        ),
        Some((s,)) if s == "disputed" || s == "expired" => (
            Verdict::Lost,
            json!({ "evaluator": "bounty_status", "status": s }),
        ),
        Some((s,)) => (
            Verdict::Cancelled,
            json!({
                "evaluator": "bounty_status",
                "status": s,
                "reason": "unsettled",
            }),
        ),
        None => (
            Verdict::Cancelled,
            json!({
                "evaluator": "bounty_status",
                "reason": "bounty_not_found",
            }),
        ),
    }
}

/// `audit_finding_confirmed`: the auditor wins their stake when the
/// audit they filed reaches `confirmed`, loses it when `dismissed`,
/// cancels otherwise (still open / disputed / withdrawn at expiry).
///
/// The stake's target_id is the audit_findings.id row by construction,
/// so we look up the audit directly.
async fn evaluate_audit_finding_confirmed(pool: &PgPool, audit_id: Uuid) -> (Verdict, Value) {
    let row: Option<(String,)> = sqlx::query_as("SELECT status FROM audit_findings WHERE id = $1")
        .bind(audit_id)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten();

    match row {
        Some((s,)) if s == "confirmed" => (
            Verdict::Won,
            json!({ "evaluator": "audit_status", "status": s }),
        ),
        Some((s,)) if s == "dismissed" => (
            Verdict::Lost,
            json!({ "evaluator": "audit_status", "status": s }),
        ),
        Some((s,)) => (
            Verdict::Cancelled,
            json!({
                "evaluator": "audit_status",
                "status": s,
                "reason": "unsettled",
            }),
        ),
        None => (
            Verdict::Cancelled,
            json!({
                "evaluator": "audit_status",
                "reason": "audit_not_found",
            }),
        ),
    }
}

/// `pocc_chain_verified_30d`: at expiry, the chain must be `verified` or
/// `sealed` to win. `invalid` loses. Anything else (deleted, still
/// building) cancels.
async fn evaluate_pocc_chain_verified(pool: &PgPool, chain_id: Uuid) -> (Verdict, Value) {
    let row: Option<(String,)> = sqlx::query_as("SELECT status FROM pocc_chains WHERE id = $1")
        .bind(chain_id)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten();

    match row {
        Some((s,)) if s == "verified" || s == "sealed" => (
            Verdict::Won,
            json!({ "evaluator": "pocc_chain_status", "status": s }),
        ),
        Some((s,)) if s == "invalid" => (
            Verdict::Lost,
            json!({ "evaluator": "pocc_chain_status", "status": s }),
        ),
        Some((s,)) => (
            Verdict::Cancelled,
            json!({ "evaluator": "pocc_chain_status", "status": s, "reason": "unsettled" }),
        ),
        None => (
            Verdict::Cancelled,
            json!({ "evaluator": "pocc_chain_status", "reason": "chain_not_found" }),
        ),
    }
}

/// `pr_no_revert_7d`: at expiry, the PR must still be `merged` (not
/// reverted/closed-after-merge) to win. PR status `rejected` after
/// merge or any explicit revert flag loses. Missing PR cancels.
///
/// We don't yet track explicit reverts, so this is a conservative
/// approximation: status == "merged" → Won, status == "rejected"
/// → Lost (catches the "merged then reverted" case under the v1 schema).
async fn evaluate_pr_no_revert(pool: &PgPool, pr_id: Uuid) -> (Verdict, Value) {
    let row: Option<(String,)> = sqlx::query_as("SELECT status FROM pull_requests WHERE id = $1")
        .bind(pr_id)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten();

    match row {
        Some((s,)) if s == "merged" => (
            Verdict::Won,
            json!({ "evaluator": "pr_status", "status": s }),
        ),
        Some((s,)) if s == "rejected" || s == "closed" => (
            Verdict::Lost,
            json!({ "evaluator": "pr_status", "status": s }),
        ),
        Some((s,)) => (
            Verdict::Cancelled,
            json!({ "evaluator": "pr_status", "status": s, "reason": "unsettled" }),
        ),
        None => (
            Verdict::Cancelled,
            json!({ "evaluator": "pr_status", "reason": "pr_not_found" }),
        ),
    }
}
