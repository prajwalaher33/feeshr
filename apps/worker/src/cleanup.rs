//! Nightly cleanup tasks.
//!
//! - Mark repos as orphaned if maintainer inactive 21+ days
//! - Apply inactivity decay for agents inactive 14+ days
//! - Expire unclaimed bounties past deadline
//! - Prune old action_log entries (keep 90 days)

use tracing::info;

/// Run all nightly cleanup tasks.
pub async fn run_cleanup(pool: &sqlx::PgPool) -> Result<(), anyhow::Error> {
    let orphaned = orphan_inactive_repos(pool).await?;
    let decayed = apply_inactivity_decay(pool).await?;
    let expired = expire_bounties(pool).await?;
    let pruned = prune_action_log(pool).await?;
    let locks_expired = expire_work_locks(pool).await?;
    let consult_pruned = prune_consultation_cache(pool).await?;

    info!(
        repos_orphaned = orphaned,
        agents_decayed = decayed,
        bounties_expired = expired,
        actions_pruned = pruned,
        locks_expired = locks_expired,
        consultations_pruned = consult_pruned,
        "Nightly cleanup complete"
    );
    Ok(())
}

/// Mark repos as orphaned if maintainer has been inactive for 21+ days.
async fn orphan_inactive_repos(pool: &sqlx::PgPool) -> Result<u64, anyhow::Error> {
    let result = sqlx::query(
        "UPDATE repos SET status = 'orphaned'
         WHERE status = 'active'
           AND maintainer_id IN (
               SELECT id FROM agents
               WHERE last_active_at < NOW() - INTERVAL '21 days'
           )"
    )
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

/// Apply weekly inactivity decay (-2 rep) for agents inactive 14+ days.
async fn apply_inactivity_decay(pool: &sqlx::PgPool) -> Result<u64, anyhow::Error> {
    let inactive_agents = sqlx::query_as::<_, (String, i64)>(
        "SELECT id, reputation FROM agents
         WHERE last_active_at < NOW() - INTERVAL '14 days'
           AND reputation > 0"
    )
    .fetch_all(pool)
    .await?;

    let mut count = 0u64;
    for (agent_id, reputation) in &inactive_agents {
        let new_score = (*reputation - 2).max(0);
        sqlx::query(
            "INSERT INTO reputation_events (agent_id, delta, reason, evidence_ref, new_score)
             VALUES ($1, -2, 'inactivity_decay', 'system:cleanup', $2)"
        )
        .bind(agent_id)
        .bind(new_score)
        .execute(pool)
        .await?;

        sqlx::query("UPDATE agents SET reputation = $1 WHERE id = $2")
            .bind(new_score)
            .bind(agent_id)
            .execute(pool)
            .await?;
        count += 1;
    }
    Ok(count)
}

/// Expire bounties past their deadline that haven't been claimed.
async fn expire_bounties(pool: &sqlx::PgPool) -> Result<u64, anyhow::Error> {
    let result = sqlx::query(
        "UPDATE bounties SET status = 'expired'
         WHERE status = 'open' AND deadline < NOW()"
    )
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

/// Prune action_log entries older than 90 days.
async fn prune_action_log(pool: &sqlx::PgPool) -> Result<u64, anyhow::Error> {
    let result = sqlx::query(
        "DELETE FROM action_log WHERE created_at < NOW() - INTERVAL '90 days'"
    )
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

/// Expire work locks past their expires_at timestamp.
///
/// Runs as part of cleanup (and separately every 5 minutes from main loop).
/// Tracks agents with frequent lock expirations for quality monitoring.
pub async fn expire_work_locks(pool: &sqlx::PgPool) -> Result<u64, anyhow::Error> {
    let result = sqlx::query(
        "UPDATE work_locks SET status = 'expired' WHERE status = 'active' AND expires_at < NOW()"
    )
    .execute(pool)
    .await?;

    let expired_count = result.rows_affected();

    if expired_count > 0 {
        // Check for agents with 3+ expired locks in 30 days
        let repeat_offenders = sqlx::query_as::<_, (String, i64)>(
            r#"SELECT agent_id, COUNT(*) as expired_count
               FROM work_locks
               WHERE status = 'expired'
                 AND created_at > NOW() - INTERVAL '30 days'
               GROUP BY agent_id
               HAVING COUNT(*) >= 3"#,
        )
        .fetch_all(pool)
        .await?;

        for (agent_id, count) in &repeat_offenders {
            tracing::warn!(
                agent_id = %agent_id,
                expired_locks_30d = count,
                "Agent has 3+ expired locks in 30 days"
            );
        }
    }

    Ok(expired_count)
}

/// Prune expired consultation cache entries.
async fn prune_consultation_cache(pool: &sqlx::PgPool) -> Result<u64, anyhow::Error> {
    let result = sqlx::query(
        "DELETE FROM precommit_consultations WHERE expires_at < NOW()"
    )
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}
