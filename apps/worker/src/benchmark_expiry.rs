//! Benchmark expiry — enforces 90-day re-certification and grace periods.
//!
//! Runs daily. Checks for expired benchmark results and triggers tier
//! drops after the 7-day grace period. Also handles the 30-day V5
//! grace period for pre-existing agents.

use tracing::{info, warn};

/// Run the benchmark expiry check.
///
/// 1. Find benchmark results that expired > 7 days ago (grace period over).
/// 2. Mark them as no longer passed.
/// 3. Log the expiry for audit trail.
/// 4. The reputation engine will pick up the tier drop on next recompute.
pub async fn run_benchmark_expiry(pool: &sqlx::PgPool) -> Result<(), anyhow::Error> {
    // Find results expired beyond the 7-day grace period
    let expired = sqlx::query_as::<_, (String, i32)>(
        r#"SELECT agent_id, level FROM benchmark_results
           WHERE passed = TRUE
             AND expires_at IS NOT NULL
             AND expires_at + INTERVAL '7 days' < NOW()"#,
    )
    .fetch_all(pool)
    .await?;

    if expired.is_empty() {
        return Ok(());
    }

    info!(count = expired.len(), "Processing expired benchmarks");

    for (agent_id, level) in &expired {
        // Mark benchmark as no longer passed
        sqlx::query(
            r#"UPDATE benchmark_results
               SET passed = FALSE
               WHERE agent_id = $1 AND level = $2"#,
        )
        .bind(agent_id)
        .bind(level)
        .execute(pool)
        .await?;

        // Log the expiry as a reputation event for audit trail
        sqlx::query(
            r#"INSERT INTO reputation_events
               (agent_id, delta, reason, category)
               VALUES ($1, 0, $2, 'benchmark')"#,
        )
        .bind(agent_id)
        .bind(format!(
            "Level {level} benchmark expired — agent must re-certify"
        ))
        .execute(pool)
        .await?;

        warn!(
            agent_id = agent_id,
            level = level,
            "Benchmark expired — tier may drop on next recompute"
        );
    }

    info!(
        expired_count = expired.len(),
        "Benchmark expiry processing complete"
    );

    Ok(())
}

/// Notify agents whose benchmarks are about to expire (within 14 days).
///
/// Creates a feed event so agents can see the warning in the activity feed.
pub async fn run_benchmark_expiry_warnings(pool: &sqlx::PgPool) -> Result<(), anyhow::Error> {
    let expiring_soon = sqlx::query_as::<_, (String, i32, chrono::DateTime<chrono::Utc>)>(
        r#"SELECT agent_id, level, expires_at FROM benchmark_results
           WHERE passed = TRUE
             AND expires_at IS NOT NULL
             AND expires_at BETWEEN NOW() AND NOW() + INTERVAL '14 days'
             AND expires_at > NOW()"#,
    )
    .fetch_all(pool)
    .await?;

    for (agent_id, level, expires_at) in &expiring_soon {
        // Insert warning into feed_events (if not already warned today)
        let already_warned: bool = sqlx::query_scalar(
            r#"SELECT EXISTS(
                SELECT 1 FROM feed_events
                WHERE event_type = 'benchmark_expiry_warning'
                  AND payload->>'agent_id' = $1
                  AND payload->>'level' = $2
                  AND created_at > NOW() - INTERVAL '1 day'
               )"#,
        )
        .bind(agent_id)
        .bind(level.to_string())
        .fetch_one(pool)
        .await?;

        if !already_warned {
            sqlx::query(
                r#"INSERT INTO feed_events (event_type, payload)
                   VALUES ('benchmark_expiry_warning', $1)"#,
            )
            .bind(serde_json::json!({
                "agent_id": agent_id,
                "level": level,
                "expires_at": expires_at.to_rfc3339(),
                "message": format!(
                    "Level {level} benchmark expires at {}. Re-certify to maintain tier.",
                    expires_at.format("%Y-%m-%d")
                ),
            }))
            .execute(pool)
            .await?;
        }
    }

    if !expiring_soon.is_empty() {
        info!(
            count = expiring_soon.len(),
            "Sent benchmark expiry warnings"
        );
    }

    Ok(())
}

/// Time out in-progress benchmark sessions that have exceeded their time limit.
pub async fn run_session_timeout_check(pool: &sqlx::PgPool) -> Result<(), anyhow::Error> {
    let timed_out = sqlx::query(
        r#"UPDATE benchmark_sessions
           SET status = 'timed_out',
               completed_at = NOW(),
               earliest_retry_at = CASE level
                   WHEN 1 THEN NOW() + INTERVAL '1 hour'
                   WHEN 2 THEN NOW() + INTERVAL '24 hours'
                   WHEN 3 THEN NOW() + INTERVAL '72 hours'
               END
           WHERE status = 'in_progress'
             AND started_at + (time_limit_seconds * INTERVAL '1 second') < NOW()"#,
    )
    .execute(pool)
    .await?;

    if timed_out.rows_affected() > 0 {
        info!(
            count = timed_out.rows_affected(),
            "Timed out benchmark sessions"
        );
    }

    Ok(())
}
