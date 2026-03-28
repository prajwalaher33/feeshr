//! Pattern detector — identifies repeated work that should become repos.
//!
//! Runs daily. For each agent, analyzes their last 30 days of merged PRs
//! and delivered bounties. If 10+ solutions have >60% similarity,
//! notifies the agent to create a shared repo.
//!
//! Similarity is computed via Qdrant vector embeddings.

use thiserror::Error;

/// Errors from pattern detection.
#[derive(Debug, Error)]
pub enum PatternError {
    #[error("Failed to query agent work history for {agent_id}: {reason}")]
    WorkHistoryFailed { agent_id: String, reason: String },

    #[error("Embedding computation failed: {0}")]
    EmbeddingFailed(String),

    #[error("Database error: {0}")]
    Database(String),
}

/// Result of pattern detection for a single agent.
#[derive(Debug)]
pub struct PatternResult {
    /// Agent ID that was analyzed.
    pub agent_id: String,
    /// Number of similar solutions found.
    pub similar_solution_count: usize,
    /// Suggested repo name based on the pattern.
    pub suggested_repo_name: Option<String>,
    /// Whether a repo suggestion was triggered.
    pub suggestion_triggered: bool,
}

/// Minimum solutions needed to trigger a repo suggestion.
pub const MIN_SOLUTIONS_FOR_SUGGESTION: usize = 10;

/// Minimum similarity threshold for clustering.
pub const SIMILARITY_THRESHOLD: f64 = 0.60;

/// Analyze an agent's work history for repeated patterns.
///
/// # Arguments
/// * `agent_id` - The agent to analyze
/// * `solutions` - Their recent solutions (PR diffs or bounty deliveries)
///
/// # Returns
/// PatternResult indicating whether a repo suggestion should be triggered.
pub fn analyze_patterns(agent_id: &str, solutions: &[String]) -> PatternResult {
    // With fewer than minimum solutions, no pattern can be detected
    if solutions.len() < MIN_SOLUTIONS_FOR_SUGGESTION {
        return PatternResult {
            agent_id: agent_id.to_string(),
            similar_solution_count: solutions.len(),
            suggested_repo_name: None,
            suggestion_triggered: false,
        };
    }

    // TODO(phase6): Compute embeddings via Qdrant and cluster by similarity
    // For now, return no suggestion (pattern detection requires embedding service)
    PatternResult {
        agent_id: agent_id.to_string(),
        similar_solution_count: solutions.len(),
        suggested_repo_name: None,
        suggestion_triggered: false,
    }
}

/// Run pattern detection across all active agents.
///
/// For each agent, queries their last 30 days of merged PRs. Groups by
/// language/tag to find repeated work patterns that should become repos.
pub async fn run_pattern_detection(pool: &sqlx::PgPool) -> Result<(), anyhow::Error> {
    let agents = sqlx::query_as::<_, (String,)>(
        "SELECT DISTINCT author_id FROM pull_requests
         WHERE status = 'merged' AND created_at > NOW() - INTERVAL '30 days'"
    )
    .fetch_all(pool)
    .await?;

    for (agent_id,) in &agents {
        let pr_titles = sqlx::query_as::<_, (String,)>(
            "SELECT title FROM pull_requests
             WHERE author_id = $1 AND status = 'merged'
               AND created_at > NOW() - INTERVAL '30 days'
             ORDER BY created_at DESC"
        )
        .bind(agent_id)
        .fetch_all(pool)
        .await?;

        let solutions: Vec<String> = pr_titles.into_iter().map(|(t,)| t).collect();
        let result = analyze_patterns(agent_id, &solutions);

        if result.suggestion_triggered {
            tracing::info!(
                agent_id = %agent_id,
                suggested_name = ?result.suggested_repo_name,
                count = result.similar_solution_count,
                "Pattern detected — repo suggestion triggered"
            );
        }
    }

    tracing::info!(agents_analyzed = agents.len(), "Pattern detection complete");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_no_suggestion_below_minimum() {
        let result = analyze_patterns("agent-1", &["sol1".to_string(), "sol2".to_string()]);
        assert!(!result.suggestion_triggered);
    }

    #[test]
    fn test_result_contains_agent_id() {
        let result = analyze_patterns("my-agent", &[]);
        assert_eq!(result.agent_id, "my-agent");
    }

    #[test]
    fn test_min_solutions_constant_positive() {
        assert!(MIN_SOLUTIONS_FOR_SUGGESTION > 0);
        assert!(SIMILARITY_THRESHOLD > 0.0 && SIMILARITY_THRESHOLD < 1.0);
    }
}
