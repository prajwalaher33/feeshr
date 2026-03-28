//! Quality tracker — computes per-agent quality metrics over time.
//!
//! Runs hourly. For each agent, computes:
//! - PR acceptance rate (rolling 30 days)
//! - Verified skills (from peer review scores by category)
//! - Improvement trends (is the agent getting better?)
//! - Comparison to platform average

use thiserror::Error;

/// Errors from quality tracking.
#[derive(Debug, Error)]
pub enum QualityError {
    #[error("Agent {agent_id} not found")]
    AgentNotFound { agent_id: String },

    #[error("Insufficient data for agent {agent_id}: need {needed} reviews, have {have}")]
    InsufficientData { agent_id: String, needed: usize, have: usize },

    #[error("Database error: {0}")]
    Database(String),
}

/// Quality metrics for a single agent.
#[derive(Debug, Clone)]
pub struct AgentQuality {
    /// The agent's ID.
    pub agent_id: String,
    /// PR acceptance rate in the last 30 days (0.0 to 1.0).
    pub acceptance_rate_30d: f64,
    /// Total PRs submitted.
    pub prs_submitted: i64,
    /// Total PRs merged.
    pub prs_merged: i64,
    /// Verified skills with confidence scores.
    pub verified_skills: std::collections::HashMap<String, f64>,
    /// Whether the agent is improving (positive trend).
    pub is_improving: bool,
}

/// Minimum reviews needed before a skill is considered "verified".
pub const MIN_REVIEWS_FOR_VERIFIED_SKILL: usize = 10;

/// Minimum score to count as a verified strength (0-100 scale).
pub const MIN_SKILL_SCORE: f64 = 70.0;

/// Compute PR acceptance rate from submission and merge counts.
///
/// # Arguments
/// * `submitted` - Number of PRs submitted
/// * `merged` - Number of PRs merged
///
/// # Returns
/// Acceptance rate as a value between 0.0 and 1.0.
/// Returns 0.0 if no PRs submitted.
pub fn compute_acceptance_rate(submitted: i64, merged: i64) -> f64 {
    if submitted == 0 {
        return 0.0;
    }
    (merged as f64 / submitted as f64).min(1.0)
}

/// Determine if an agent is improving based on recent vs older acceptance rate.
///
/// # Arguments
/// * `recent_rate` - Acceptance rate in the last 30 days
/// * `older_rate` - Acceptance rate in the 30 days before that
///
/// # Returns
/// True if recent rate is more than 5% higher than older rate.
pub fn is_agent_improving(recent_rate: f64, older_rate: f64) -> bool {
    recent_rate > older_rate + 0.05
}

/// Run quality tracking for all agents with PR activity.
///
/// Computes 30-day rolling acceptance rate and updates the agents table.
pub async fn run_quality_tracking(pool: &sqlx::PgPool) -> Result<(), anyhow::Error> {
    let rows = sqlx::query_as::<_, (String, i64, i64)>(
        "SELECT author_id, COUNT(*) AS submitted,
                COUNT(*) FILTER (WHERE status = 'merged') AS merged
         FROM pull_requests
         WHERE created_at > NOW() - INTERVAL '30 days'
         GROUP BY author_id"
    )
    .fetch_all(pool)
    .await?;

    for (agent_id, submitted, merged) in &rows {
        let rate = compute_acceptance_rate(*submitted, *merged);

        sqlx::query(
            "UPDATE agents SET pr_acceptance_rate = $1::decimal, prs_submitted = $2, prs_merged = $3
             WHERE id = $4"
        )
        .bind(rate)
        .bind(submitted)
        .bind(merged)
        .bind(agent_id)
        .execute(pool)
        .await?;
    }

    tracing::info!(agents_tracked = rows.len(), "Quality tracking complete");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_acceptance_rate_zero_submitted() {
        assert_eq!(compute_acceptance_rate(0, 0), 0.0);
    }

    #[test]
    fn test_acceptance_rate_all_merged() {
        assert!((compute_acceptance_rate(10, 10) - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_acceptance_rate_half() {
        assert!((compute_acceptance_rate(10, 5) - 0.5).abs() < 0.001);
    }

    #[test]
    fn test_acceptance_rate_capped_at_one() {
        // Edge case: merged > submitted (data inconsistency)
        assert!(compute_acceptance_rate(5, 10) <= 1.0);
    }

    #[test]
    fn test_improving_threshold() {
        assert!(is_agent_improving(0.8, 0.7));  // 10% improvement
        assert!(!is_agent_improving(0.7, 0.7)); // no improvement
        assert!(!is_agent_improving(0.72, 0.7)); // only 2% — below threshold
    }
}
