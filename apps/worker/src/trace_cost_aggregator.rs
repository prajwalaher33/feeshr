//! Daily cost aggregation for reasoning traces.
//!
//! Runs daily at 00:15 UTC. Aggregates yesterday's traces into the
//! reasoning_cost_daily table for dashboards and cost analysis.

/// Aggregate yesterday's reasoning trace costs into daily rollups.
///
/// Groups by (agent_id, action_type) and computes:
/// - trace_count, total tokens by category, avg/max reasoning tokens
/// - positive/negative outcome counts
/// - tokens per successful outcome
/// - average reasoning duration
pub async fn run_daily_cost_aggregation(pool: &sqlx::PgPool) -> Result<(), anyhow::Error> {
    let start = std::time::Instant::now();

    let result = sqlx::query(
        r#"INSERT INTO reasoning_cost_daily
           (date, agent_id, action_type, trace_count,
            total_context_tokens, total_reasoning_tokens, total_decision_tokens,
            avg_reasoning_tokens, max_reasoning_tokens,
            positive_outcomes, negative_outcomes, tokens_per_success,
            avg_reasoning_duration_ms)
           SELECT
               (NOW() - INTERVAL '1 day')::date,
               agent_id,
               action_type,
               COUNT(*),
               SUM(context_tokens),
               SUM(reasoning_tokens),
               SUM(decision_tokens),
               AVG(reasoning_tokens)::integer,
               MAX(reasoning_tokens),
               COUNT(*) FILTER (WHERE outcome_quality = 'positive'),
               COUNT(*) FILTER (WHERE outcome_quality = 'negative'),
               CASE
                   WHEN COUNT(*) FILTER (WHERE outcome_quality = 'positive') > 0
                   THEN (SUM(reasoning_tokens)
                         / COUNT(*) FILTER (WHERE outcome_quality = 'positive'))::integer
                   ELSE NULL
               END,
               AVG(reasoning_duration_ms)::integer
           FROM reasoning_traces
           WHERE created_at::date = (NOW() - INTERVAL '1 day')::date
           GROUP BY agent_id, action_type
           ON CONFLICT (date, agent_id, action_type) DO UPDATE
           SET trace_count = EXCLUDED.trace_count,
               total_context_tokens = EXCLUDED.total_context_tokens,
               total_reasoning_tokens = EXCLUDED.total_reasoning_tokens,
               total_decision_tokens = EXCLUDED.total_decision_tokens,
               avg_reasoning_tokens = EXCLUDED.avg_reasoning_tokens,
               max_reasoning_tokens = EXCLUDED.max_reasoning_tokens,
               positive_outcomes = EXCLUDED.positive_outcomes,
               negative_outcomes = EXCLUDED.negative_outcomes,
               tokens_per_success = EXCLUDED.tokens_per_success,
               avg_reasoning_duration_ms = EXCLUDED.avg_reasoning_duration_ms"#,
    )
    .execute(pool)
    .await?;

    tracing::info!(
        rows_upserted = result.rows_affected(),
        duration_ms = start.elapsed().as_millis() as u64,
        "Daily cost aggregation complete"
    );

    Ok(())
}
