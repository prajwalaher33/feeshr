//! Trace similarity finder for SRC preparation.
//!
//! Runs weekly. Finds pairs of traces with similar contexts but
//! different reasoning — the most valuable data for SRC training.
//!
//! Uses a simple text-overlap heuristic for similarity until Qdrant
//! embedding infrastructure is available. The heuristic compares
//! the JSON-serialized context keys and structure.

/// Find pairs of traces with similar contexts but divergent reasoning.
///
/// 1. Get traces from the last 7 days with known outcomes
/// 2. Group by action_type (only compare same-type traces)
/// 3. For each pair with high context similarity and low reasoning similarity,
///    insert into trace_similarity_pairs
pub async fn run_trace_similarity_analysis(pool: &sqlx::PgPool) -> Result<(), anyhow::Error> {
    let start = std::time::Instant::now();

    // Get recent evaluated traces grouped by action_type
    let traces: Vec<(
        uuid::Uuid,
        String,
        String,
        serde_json::Value,
        String,
        serde_json::Value,
        String,
    )> = sqlx::query_as(
        r#"SELECT id, agent_id, action_type, context, reasoning_trace, decision, outcome_quality
           FROM reasoning_traces
           WHERE created_at > NOW() - INTERVAL '7 days'
             AND outcome_quality IN ('positive', 'negative')
           ORDER BY action_type, created_at DESC
           LIMIT 500"#,
    )
    .fetch_all(pool)
    .await?;

    if traces.len() < 2 {
        tracing::info!("Not enough evaluated traces for similarity analysis");
        return Ok(());
    }

    let mut pairs_found: u64 = 0;

    // Compare traces of the same action_type
    for i in 0..traces.len() {
        for j in (i + 1)..traces.len() {
            // Only compare same action_type
            if traces[i].2 != traces[j].2 {
                continue;
            }

            let ctx_sim = compute_json_similarity(&traces[i].3, &traces[j].3);
            if ctx_sim < 0.7 {
                continue;
            }

            let reasoning_sim = compute_text_similarity(&traces[i].4, &traces[j].4);
            let decision_sim = compute_json_similarity(&traces[i].5, &traces[j].5);
            let divergence = ctx_sim * (1.0 - reasoning_sim);

            if divergence < 0.3 {
                continue;
            }

            // Determine better trace
            let better_id = determine_better_trace(
                traces[i].0,
                &traces[i].6,
                &traces[i].4,
                traces[j].0,
                &traces[j].6,
                &traces[j].4,
            );

            let result = sqlx::query(
                r#"INSERT INTO trace_similarity_pairs
                   (trace_a_id, trace_b_id, context_similarity,
                    reasoning_similarity, decision_similarity, better_trace_id)
                   VALUES ($1, $2, $3, $4, $5, $6)
                   ON CONFLICT (trace_a_id, trace_b_id) DO NOTHING"#,
            )
            .bind(traces[i].0)
            .bind(traces[j].0)
            .bind(ctx_sim)
            .bind(reasoning_sim)
            .bind(decision_sim)
            .bind(better_id)
            .execute(pool)
            .await?;

            pairs_found += result.rows_affected();
        }
    }

    tracing::info!(
        traces_analyzed = traces.len(),
        pairs_found,
        duration_ms = start.elapsed().as_millis() as u64,
        "Trace similarity analysis complete"
    );

    Ok(())
}

/// Compute similarity between two JSON values using key overlap.
///
/// Returns a value between 0.0 (no overlap) and 1.0 (identical structure).
/// This is a simple heuristic — will be replaced by embedding-based
/// similarity when Qdrant is integrated.
fn compute_json_similarity(a: &serde_json::Value, b: &serde_json::Value) -> f64 {
    let a_str = a.to_string();
    let b_str = b.to_string();

    if a_str == b_str {
        return 1.0;
    }

    // Extract unique tokens (split on non-alphanumeric)
    let a_tokens: std::collections::HashSet<&str> =
        a_str.split(|c: char| !c.is_alphanumeric()).filter(|s| s.len() > 2).collect();
    let b_tokens: std::collections::HashSet<&str> =
        b_str.split(|c: char| !c.is_alphanumeric()).filter(|s| s.len() > 2).collect();

    if a_tokens.is_empty() && b_tokens.is_empty() {
        return 1.0;
    }

    let intersection = a_tokens.intersection(&b_tokens).count() as f64;
    let union = a_tokens.union(&b_tokens).count() as f64;

    if union == 0.0 {
        return 0.0;
    }

    intersection / union
}

/// Compute similarity between two text strings using token overlap (Jaccard).
fn compute_text_similarity(a: &str, b: &str) -> f64 {
    if a == b {
        return 1.0;
    }

    let a_tokens: std::collections::HashSet<&str> =
        a.split_whitespace().collect();
    let b_tokens: std::collections::HashSet<&str> =
        b.split_whitespace().collect();

    if a_tokens.is_empty() && b_tokens.is_empty() {
        return 1.0;
    }

    let intersection = a_tokens.intersection(&b_tokens).count() as f64;
    let union = a_tokens.union(&b_tokens).count() as f64;

    if union == 0.0 {
        return 0.0;
    }

    intersection / union
}

/// Determine which trace had the better outcome.
///
/// If one is positive and the other negative, the positive one wins.
/// If both positive, the one with fewer reasoning tokens (more efficient) wins.
fn determine_better_trace(
    id_a: uuid::Uuid,
    outcome_a: &str,
    reasoning_a: &str,
    id_b: uuid::Uuid,
    outcome_b: &str,
    reasoning_b: &str,
) -> Option<uuid::Uuid> {
    match (outcome_a, outcome_b) {
        ("positive", "negative") => Some(id_a),
        ("negative", "positive") => Some(id_b),
        ("positive", "positive") => {
            // More efficient reasoning wins
            if reasoning_a.len() <= reasoning_b.len() {
                Some(id_a)
            } else {
                Some(id_b)
            }
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_json_similarity_identical() {
        let a = serde_json::json!({"task": {"type": "issue", "title": "Fix parser"}});
        let b = serde_json::json!({"task": {"type": "issue", "title": "Fix parser"}});
        assert!((compute_json_similarity(&a, &b) - 1.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_json_similarity_different() {
        let a = serde_json::json!({"task": {"type": "issue", "title": "Fix parser"}});
        let b = serde_json::json!({"task": {"type": "bounty", "title": "Build API"}});
        let sim = compute_json_similarity(&a, &b);
        assert!(sim > 0.0 && sim < 1.0);
    }

    #[test]
    fn test_text_similarity_identical() {
        assert!((compute_text_similarity("hello world", "hello world") - 1.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_text_similarity_partial() {
        let sim = compute_text_similarity("the quick brown fox", "the slow brown dog");
        assert!(sim > 0.0 && sim < 1.0);
    }

    #[test]
    fn test_determine_better_trace_positive_wins() {
        let a = uuid::Uuid::new_v4();
        let b = uuid::Uuid::new_v4();
        assert_eq!(
            determine_better_trace(a, "positive", "short", b, "negative", "long"),
            Some(a)
        );
        assert_eq!(
            determine_better_trace(a, "negative", "short", b, "positive", "long"),
            Some(b)
        );
    }

    #[test]
    fn test_determine_better_trace_efficiency() {
        let a = uuid::Uuid::new_v4();
        let b = uuid::Uuid::new_v4();
        assert_eq!(
            determine_better_trace(a, "positive", "short", b, "positive", "much longer reasoning"),
            Some(a)
        );
    }
}
