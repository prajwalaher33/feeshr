//! Quantum readiness dashboard — daily job that computes migration metrics.
//!
//! Tracks: percentage of agents with PQ keys, PQ TLS handshake rate,
//! OIDC quantum-safe token rate. Computes an overall readiness score
//! and warns HMAC-only agents when deprecation deadline approaches.

use serde_json::json;
use sqlx::PgPool;

/// Run the daily quantum readiness assessment.
///
/// 1. Compute component metrics (PQ agents %, PQ TLS %, OIDC safe %)
/// 2. Compute weighted readiness score
/// 3. Log daily snapshot to quantum_readiness_log
/// 4. Warn HMAC-only agents if deprecation deadline is near
pub async fn run_quantum_readiness_check(pool: &PgPool) -> Result<(), anyhow::Error> {
    tracing::info!("Computing quantum readiness metrics...");

    // 1a. Percentage of agents with post-quantum keys
    let agent_stats: Option<(i64, i64)> = sqlx::query_as(
        r#"SELECT
               COUNT(*) FILTER (WHERE pq_public_key IS NOT NULL),
               COUNT(*)
           FROM agents"#,
    )
    .fetch_optional(pool)
    .await?;

    let (pq_agents, total_agents) = agent_stats.unwrap_or((0, 0));
    let pq_agents_pct = if total_agents > 0 {
        (pq_agents as f64 / total_agents as f64) * 100.0
    } else {
        0.0
    };

    // 1b. PQ TLS handshake percentage (last 24h from quantum_readiness_log)
    let tls_stats: Option<(i64, i64)> = sqlx::query_as(
        r#"SELECT
               COUNT(*) FILTER (WHERE event_type = 'tls_pq_handshake_success'),
               COUNT(*) FILTER (WHERE event_type IN ('tls_pq_handshake_success', 'tls_pq_handshake_failure'))
           FROM quantum_readiness_log
           WHERE created_at > NOW() - INTERVAL '24 hours'
             AND event_type LIKE 'tls_pq_%'"#,
    )
    .fetch_optional(pool)
    .await?;

    let (pq_tls, total_tls) = tls_stats.unwrap_or((0, 0));
    let pq_tls_pct = if total_tls > 0 {
        (pq_tls as f64 / total_tls as f64) * 100.0
    } else {
        0.0
    };

    // 1c. OIDC quantum-safe token percentage (last 24h)
    let oidc_stats: Option<(i64, i64)> = sqlx::query_as(
        r#"SELECT
               COUNT(*) FILTER (WHERE event_type = 'oidc_quantum_safe_detected'),
               COUNT(*) FILTER (WHERE event_type IN ('oidc_quantum_safe_detected', 'oidc_quantum_vulnerable_detected'))
           FROM quantum_readiness_log
           WHERE created_at > NOW() - INTERVAL '24 hours'
             AND event_type LIKE 'oidc_%'"#,
    )
    .fetch_optional(pool)
    .await?;

    let (oidc_safe, total_oidc) = oidc_stats.unwrap_or((0, 0));
    let oidc_safe_pct = if total_oidc > 0 {
        (oidc_safe as f64 / total_oidc as f64) * 100.0
    } else {
        0.0
    };

    // 2. Compute overall readiness score (weighted)
    let readiness_score = (pq_agents_pct * 0.5) + (pq_tls_pct * 0.3) + (oidc_safe_pct * 0.2);

    tracing::info!(
        pq_agents_pct = pq_agents_pct,
        pq_tls_pct = pq_tls_pct,
        oidc_safe_pct = oidc_safe_pct,
        readiness_score = readiness_score,
        "Quantum readiness score computed"
    );

    // 3. Log daily snapshot
    sqlx::query(
        r#"INSERT INTO quantum_readiness_log (event_type, details)
           VALUES ('daily_readiness_snapshot', $1)"#,
    )
    .bind(json!({
        "pq_agents_count": pq_agents,
        "total_agents": total_agents,
        "pq_agents_pct": pq_agents_pct,
        "pq_tls_pct": pq_tls_pct,
        "oidc_safe_pct": oidc_safe_pct,
        "readiness_score": readiness_score,
    }))
    .execute(pool)
    .await?;

    // 4. Warn if more than half of agents still use legacy HMAC after 90 days
    if pq_agents_pct < 50.0 && total_agents > 0 {
        // Check if the platform has been running for > 90 days with PQ support
        let oldest_pq_event: Option<(Option<chrono::DateTime<chrono::Utc>>,)> = sqlx::query_as(
            r#"SELECT MIN(created_at)
               FROM quantum_readiness_log
               WHERE event_type = 'agent_created_with_sphincs'"#,
        )
        .fetch_optional(pool)
        .await?;

        if let Some((Some(first_pq_date),)) = oldest_pq_event {
            let days_since = (chrono::Utc::now() - first_pq_date).num_days();
            if days_since > 90 {
                tracing::warn!(
                    pq_agents_pct = pq_agents_pct,
                    days_since_pq_launch = days_since,
                    "More than half of agents still use legacy HMAC signatures"
                );

                sqlx::query(
                    r#"INSERT INTO quantum_readiness_log (event_type, details)
                       VALUES ('hmac_only_agent_warning', $1)"#,
                )
                .bind(json!({
                    "pq_agents_pct": pq_agents_pct,
                    "days_since_pq_launch": days_since,
                    "hmac_only_agents": total_agents - pq_agents,
                }))
                .execute(pool)
                .await?;
            }
        }
    }

    // 5. Check HMAC deprecation deadline proximity
    let hmac_deadline = std::env::var("PQ_HMAC_DEPRECATION_DATE")
        .ok()
        .filter(|s| !s.is_empty())
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok())
        .map(|dt| dt.with_timezone(&chrono::Utc));

    if let Some(deadline) = hmac_deadline {
        let days_until = (deadline - chrono::Utc::now()).num_days();
        if days_until > 0 && days_until <= 30 {
            tracing::warn!(
                days_until_deadline = days_until,
                hmac_only_agents = total_agents - pq_agents,
                "HMAC deprecation deadline approaching"
            );

            sqlx::query(
                r#"INSERT INTO quantum_readiness_log (event_type, details)
                   VALUES ('hmac_only_agent_warning', $1)"#,
            )
            .bind(json!({
                "warning_type": "deprecation_deadline_approaching",
                "days_until_deadline": days_until,
                "hmac_only_agents": total_agents - pq_agents,
                "deadline": deadline.to_rfc3339(),
            }))
            .execute(pool)
            .await?;
        }
    }

    Ok(())
}
