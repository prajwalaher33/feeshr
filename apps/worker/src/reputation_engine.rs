//! Reputation engine: compute tier from score, define all reputation deltas.
//!
//! The reputation system is append-only. Scores are NEVER stored as mutable
//! state in the database — they are always recomputed from the event log.
//! This file defines the exact delta values (not configurable at runtime).

/// Reputation tiers with their minimum scores.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Tier {
    /// 0-99 reputation. Can browse and learn. Cannot submit PRs.
    Observer,
    /// 100-299 reputation. Can submit PRs and claim bounties.
    Contributor,
    /// 300-699 reputation. Can propose projects and create repos.
    Builder,
    /// 700-1499 reputation. Assigned as reviewers for important PRs.
    Specialist,
    /// 1500+ reputation. Can approve critical security changes.
    Architect,
}

impl Tier {
    /// Minimum reputation required for this tier.
    pub fn min_reputation(&self) -> i64 {
        match self {
            Self::Observer => 0,
            Self::Contributor => 100,
            Self::Builder => 300,
            Self::Specialist => 700,
            Self::Architect => 1500,
        }
    }

    /// Human-readable tier name for display.
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Observer => "Observer",
            Self::Contributor => "Contributor",
            Self::Builder => "Builder",
            Self::Specialist => "Specialist",
            Self::Architect => "Architect",
        }
    }
}

/// Compute the reputation tier for a given score.
///
/// # Arguments
/// * `reputation` - The agent's current reputation score
///
/// # Returns
/// The tier corresponding to the reputation score.
///
/// # Examples
/// ```
/// assert_eq!(compute_tier(0), Tier::Observer);
/// assert_eq!(compute_tier(99), Tier::Observer);
/// assert_eq!(compute_tier(100), Tier::Contributor);
/// assert_eq!(compute_tier(1500), Tier::Architect);
/// ```
pub fn compute_tier(reputation: i64) -> Tier {
    match reputation {
        0..=99 => Tier::Observer,
        100..=299 => Tier::Contributor,
        300..=699 => Tier::Builder,
        700..=1499 => Tier::Specialist,
        _ => Tier::Architect,
    }
}

// ─── Reputation deltas — exact values, NOT runtime-configurable ──────────────

/// Reputation earned when a PR is merged.
pub const REP_PR_MERGED: i64 = 15;

/// Reputation earned for submitting a PR review.
pub const REP_PR_REVIEWED: i64 = 5;

/// Reputation earned for contributing to a shipped project.
pub const REP_PROJECT_CONTRIBUTED: i64 = 25;

/// Reputation earned for creating a new repo.
pub const REP_REPO_CREATED: i64 = 30;

/// Reputation earned for completing a bounty.
pub const REP_BOUNTY_COMPLETED: i64 = 20;

/// Reputation earned for delivering a bounty solution.
pub const REP_BOUNTY_DELIVERED: i64 = 20;

/// Reputation earned for finding a security vulnerability.
pub const REP_SECURITY_FINDING: i64 = 30;

/// Reputation earned for completing a security audit.
pub const REP_AUDIT_COMPLETED: i64 = 40;

/// Reputation deducted when a bug is found in a merged PR.
pub const REP_BUG_IN_MERGED_PR: i64 = -10;

/// Reputation deducted when a PR was unfairly rejected (peer-validated).
pub const REP_PR_REJECTED_UNFAIRLY: i64 = -5;

/// Reputation deducted when an agent loses a dispute.
pub const REP_DISPUTE_LOST: i64 = -20;

/// Reputation decay per week of inactivity.
pub const REP_INACTIVITY_DECAY_PER_WEEK: i64 = -2;

/// Recompute reputation for all agents from the event log.
///
/// Sums all reputation_events for each agent and updates the agents table
/// with the computed score and tier.
pub async fn run_reputation_recompute(pool: &sqlx::PgPool) -> Result<(), anyhow::Error> {
    // Get all agents with reputation events.
    let rows = sqlx::query_as::<_, (String, i64)>(
        "SELECT agent_id, COALESCE(SUM(delta), 0) AS total
         FROM reputation_events
         GROUP BY agent_id"
    )
    .fetch_all(pool)
    .await?;

    let count = rows.len();
    for (agent_id, total) in rows {
        let score = total.max(0);
        let tier = compute_tier(score);
        let tier_str = tier.display_name().to_lowercase();

        sqlx::query(
            "UPDATE agents SET reputation = $1, tier = $2, last_active_at = NOW()
             WHERE id = $3"
        )
        .bind(score)
        .bind(&tier_str)
        .bind(&agent_id)
        .execute(pool)
        .await?;
    }

    tracing::info!(agents_updated = count, "Reputation recomputation complete");
    Ok(())
}

/// Recompute categorical reputation and sync to agents.reputation_breakdown.
///
/// Sums reputation_events by (agent_id, category), updates reputation_categories
/// table, then updates the agents.reputation_breakdown JSONB cache.
pub async fn run_categorical_recompute(pool: &sqlx::PgPool) -> Result<(), anyhow::Error> {
    // Get per-category sums
    let rows = sqlx::query_as::<_, (String, String, i64)>(
        r#"SELECT agent_id, COALESCE(category, 'general'), COALESCE(SUM(delta), 0)
           FROM reputation_events
           GROUP BY agent_id, category"#,
    )
    .fetch_all(pool)
    .await?;

    for (agent_id, category, total) in &rows {
        let score = (*total).max(0) as i32;
        sqlx::query(
            r#"INSERT INTO reputation_categories (agent_id, category, score, last_activity_at)
               VALUES ($1, $2, $3, NOW())
               ON CONFLICT (agent_id, category) DO UPDATE
               SET score = $3, last_activity_at = NOW(), updated_at = NOW()"#,
        )
        .bind(agent_id)
        .bind(category)
        .bind(score)
        .execute(pool)
        .await?;
    }

    // Update reputation_breakdown JSONB on agents
    sqlx::query(
        r#"UPDATE agents SET reputation_breakdown = (
               SELECT COALESCE(jsonb_object_agg(category, score), '{}'::jsonb)
               FROM reputation_categories
               WHERE reputation_categories.agent_id = agents.id
           )"#,
    )
    .execute(pool)
    .await?;

    tracing::info!(categories_updated = rows.len(), "Categorical reputation recomputation complete");
    Ok(())
}

/// Smart decay configuration per tier.
struct TierDecayConfig {
    inactivity_threshold_days: i64,
    decay_rate_pct: f64,
    grace_period_days: i64,
    floor_pct: f64,
}

/// Get decay config for a tier.
fn decay_config_for_tier(tier: &Tier) -> TierDecayConfig {
    match tier {
        Tier::Observer | Tier::Contributor => TierDecayConfig {
            inactivity_threshold_days: 14,
            decay_rate_pct: 0.03,
            grace_period_days: 7,
            floor_pct: 0.50,
        },
        Tier::Builder => TierDecayConfig {
            inactivity_threshold_days: 21,
            decay_rate_pct: 0.02,
            grace_period_days: 7,
            floor_pct: 0.50,
        },
        Tier::Specialist => TierDecayConfig {
            inactivity_threshold_days: 28,
            decay_rate_pct: 0.015,
            grace_period_days: 7,
            floor_pct: 0.50,
        },
        Tier::Architect => TierDecayConfig {
            inactivity_threshold_days: 35,
            decay_rate_pct: 0.01,
            grace_period_days: 7,
            floor_pct: 0.50,
        },
    }
}

/// Run smart decay on inactive categories.
///
/// For each agent-category pair, check if the agent has been inactive
/// in that category beyond the tier-appropriate threshold. If so,
/// decay the category score proportionally.
pub async fn run_smart_decay(pool: &sqlx::PgPool) -> Result<(), anyhow::Error> {
    let categories = sqlx::query_as::<_, (String, String, i32, Option<chrono::NaiveDateTime>)>(
        r#"SELECT rc.agent_id, rc.category, rc.score, rc.last_activity_at::timestamp
           FROM reputation_categories rc
           JOIN agents a ON a.id = rc.agent_id
           WHERE rc.score > 0"#,
    )
    .fetch_all(pool)
    .await?;

    let now = chrono::Utc::now().naive_utc();
    let mut decay_count = 0;

    for (agent_id, category, score, last_activity) in &categories {
        let last = last_activity.unwrap_or(now);
        let inactive_days = (now - last).num_days();

        // Get agent tier for decay config
        let agent_rep: Option<(i64,)> = sqlx::query_as(
            "SELECT reputation FROM agents WHERE id = $1",
        )
        .bind(agent_id)
        .fetch_optional(pool)
        .await?;

        let reputation = agent_rep.map(|(r,)| r).unwrap_or(0);
        let tier = compute_tier(reputation);
        let config = decay_config_for_tier(&tier);

        // Skip if within grace period or below threshold
        if inactive_days <= config.grace_period_days {
            continue;
        }
        if inactive_days < config.inactivity_threshold_days {
            continue;
        }

        // Compute decay amount
        let decay_raw = (*score as f64 * config.decay_rate_pct).ceil() as i32;
        let decay_amount = decay_raw.max(1);

        // Floor: never below 50% of current score (approximate peak)
        let floor = (*score as f64 * config.floor_pct) as i32;
        let new_score = (*score - decay_amount).max(floor).max(0);

        if new_score == *score {
            continue;
        }

        let actual_decay = new_score - *score;

        // Apply decay
        sqlx::query(
            "UPDATE reputation_categories SET score = $1, updated_at = NOW() WHERE agent_id = $2 AND category = $3",
        )
        .bind(new_score)
        .bind(agent_id)
        .bind(category)
        .execute(pool)
        .await?;

        // Log decay
        sqlx::query(
            r#"INSERT INTO reputation_decay_log
               (agent_id, category, decay_amount, reason, tier_at_decay, inactive_days, old_score, new_score)
               VALUES ($1, $2, $3, 'inactivity', $4, $5, $6, $7)"#,
        )
        .bind(agent_id)
        .bind(category)
        .bind(actual_decay)
        .bind(tier.display_name().to_lowercase())
        .bind(inactive_days as i32)
        .bind(score)
        .bind(new_score)
        .execute(pool)
        .await?;

        decay_count += 1;
    }

    if decay_count > 0 {
        tracing::info!(categories_decayed = decay_count, "Smart decay applied");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tier_boundaries() {
        assert_eq!(compute_tier(0), Tier::Observer);
        assert_eq!(compute_tier(99), Tier::Observer);
        assert_eq!(compute_tier(100), Tier::Contributor);
        assert_eq!(compute_tier(299), Tier::Contributor);
        assert_eq!(compute_tier(300), Tier::Builder);
        assert_eq!(compute_tier(699), Tier::Builder);
        assert_eq!(compute_tier(700), Tier::Specialist);
        assert_eq!(compute_tier(1499), Tier::Specialist);
        assert_eq!(compute_tier(1500), Tier::Architect);
        assert_eq!(compute_tier(9999), Tier::Architect);
    }

    #[test]
    fn test_tier_min_reputation() {
        assert_eq!(Tier::Observer.min_reputation(), 0);
        assert_eq!(Tier::Contributor.min_reputation(), 100);
        assert_eq!(Tier::Builder.min_reputation(), 300);
        assert_eq!(Tier::Specialist.min_reputation(), 700);
        assert_eq!(Tier::Architect.min_reputation(), 1500);
    }

    #[test]
    fn test_reputation_deltas_are_nonzero() {
        assert!(REP_PR_MERGED > 0);
        assert!(REP_BUG_IN_MERGED_PR < 0);
        assert!(REP_DISPUTE_LOST < 0);
    }
}
