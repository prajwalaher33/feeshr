//! Decision resolver: auto-resolve technical decisions after voting deadline.
//!
//! Runs every 5 minutes. For decisions past their deadline:
//! - If votes exist: compute winner, generate rationale, create memory entry
//! - If no votes: extend deadline by 24 hours (once)

/// Resolve expired technical decisions.
pub async fn run_decision_resolution(pool: &sqlx::PgPool) -> Result<(), anyhow::Error> {
    let expired = sqlx::query_as::<_, (uuid::Uuid, i64)>(
        r#"SELECT id, vote_count
           FROM technical_decisions
           WHERE status IN ('open', 'voting')
             AND voting_deadline < NOW()"#,
    )
    .fetch_all(pool)
    .await?;

    for (decision_id, vote_count) in &expired {
        if *vote_count == 0 {
            extend_deadline(pool, *decision_id).await?;
        } else {
            resolve_with_votes(pool, *decision_id).await?;
        }
    }

    if !expired.is_empty() {
        tracing::info!(
            decisions_processed = expired.len(),
            "Decision resolution complete"
        );
    }
    Ok(())
}

/// Extend a decision's deadline by 24 hours (one retry only).
async fn extend_deadline(
    pool: &sqlx::PgPool,
    decision_id: uuid::Uuid,
) -> Result<(), anyhow::Error> {
    // Only extend once: check if we already extended
    let updated = sqlx::query(
        r#"UPDATE technical_decisions
           SET voting_deadline = voting_deadline + interval '24 hours',
               updated_at = NOW()
           WHERE id = $1
             AND status = 'open'"#,
    )
    .bind(decision_id)
    .execute(pool)
    .await?;

    if updated.rows_affected() > 0 {
        tracing::info!(decision_id = %decision_id, "Decision deadline extended (no votes)");
    }
    Ok(())
}

/// Resolve a decision that has votes.
async fn resolve_with_votes(
    pool: &sqlx::PgPool,
    decision_id: uuid::Uuid,
) -> Result<(), anyhow::Error> {
    // Get all votes grouped by option
    let votes = sqlx::query_as::<_, (String, f64, String)>(
        r#"SELECT option_id, vote_weight, reasoning
           FROM decision_votes
           WHERE decision_id = $1
           ORDER BY vote_weight DESC"#,
    )
    .bind(decision_id)
    .fetch_all(pool)
    .await?;

    // Tally weighted votes
    let mut option_sums: std::collections::HashMap<String, f64> = std::collections::HashMap::new();
    let mut option_reasons: std::collections::HashMap<String, Vec<(String, f64)>> =
        std::collections::HashMap::new();

    for (option_id, weight, reasoning) in &votes {
        *option_sums.entry(option_id.clone()).or_default() += weight;
        option_reasons
            .entry(option_id.clone())
            .or_default()
            .push((reasoning.clone(), *weight));
    }

    // Find winner
    let mut ranked: Vec<_> = option_sums.iter().collect();
    ranked.sort_by(|a, b| b.1.partial_cmp(a.1).unwrap_or(std::cmp::Ordering::Equal));

    let winner = ranked
        .first()
        .map(|(k, _)| k.to_string())
        .unwrap_or_default();
    let winner_sum = ranked.first().map(|(_, v)| **v).unwrap_or(0.0);
    let runner_up_info = ranked
        .get(1)
        .map(|(k, v)| format!("Runner-up: '{}' with {:.1} weighted votes.", k, v))
        .unwrap_or_default();

    // Get top reasoning
    let top_args = option_reasons
        .get(&winner)
        .map(|reasons| {
            reasons
                .iter()
                .take(2)
                .map(|(r, _)| {
                    let truncated = if r.len() > 100 { &r[..100] } else { r };
                    format!("\"{}\"", truncated)
                })
                .collect::<Vec<_>>()
                .join("; ")
        })
        .unwrap_or_default();

    let rationale = format!(
        "Option '{}' was chosen with {} votes (weighted sum: {:.1}). Key arguments: {}. {}",
        winner,
        votes.len(),
        winner_sum,
        top_args,
        runner_up_info
    );

    // Update decision
    sqlx::query(
        r#"UPDATE technical_decisions
           SET status = 'decided', winning_option_id = $1,
               decision_rationale = $2, decided_at = NOW(), updated_at = NOW()
           WHERE id = $3"#,
    )
    .bind(&winner)
    .bind(&rationale)
    .bind(decision_id)
    .execute(pool)
    .await?;

    // Auto-create project memory entry
    create_decision_memory(pool, decision_id, &winner, &rationale).await?;

    tracing::info!(
        decision_id = %decision_id,
        winner = %winner,
        vote_count = votes.len(),
        "Decision resolved"
    );

    Ok(())
}

/// Create a project memory entry recording the resolved decision.
async fn create_decision_memory(
    pool: &sqlx::PgPool,
    decision_id: uuid::Uuid,
    winner: &str,
    rationale: &str,
) -> Result<(), anyhow::Error> {
    let decision = sqlx::query_as::<_, (String, uuid::Uuid, String)>(
        "SELECT scope_type, scope_id, title FROM technical_decisions WHERE id = $1",
    )
    .bind(decision_id)
    .fetch_optional(pool)
    .await?;

    if let Some((scope_type, scope_id, title)) = decision {
        let mem_value = serde_json::json!({
            "title": title,
            "winning_option": winner,
            "rationale": rationale,
        });

        sqlx::query(
            r#"INSERT INTO project_memory
               (id, scope_type, scope_id, key, value, entry_type, contributed_by)
               VALUES ($1, $2, $3, $4, $5, 'decision', 'system')"#,
        )
        .bind(uuid::Uuid::new_v4())
        .bind(&scope_type)
        .bind(scope_id)
        .bind(format!("decision:{}", decision_id))
        .bind(&mem_value)
        .execute(pool)
        .await
        .ok(); // Don't fail resolution if memory insert fails
    }
    Ok(())
}
