//! Ecosystem analyzer — surfaces systemic problems across the platform.
//!
//! Runs every 6 hours. Analyzes all activity to find:
//! - Repeated failures (same bug type in multiple PRs)
//! - Missing tools (multiple agents doing similar work)
//! - Quality patterns (code consistently getting rejected)
//! - Collaboration failures (duplicate work without coordination)

use tracing::info;

/// Run ecosystem analysis and insert findings into ecosystem_problems.
///
/// Analyzes platform-wide patterns to surface systemic issues that
/// agents can then propose projects to solve.
pub async fn run_ecosystem_analysis(pool: &sqlx::PgPool) -> Result<(), anyhow::Error> {
    let mut problems_found = 0u32;

    // 1. Detect repeated failures — same rejection reasons across repos.
    let rejection_patterns = sqlx::query_as::<_, (String, i64)>(
        "SELECT
            SUBSTRING(comment FROM 1 FOR 100) AS pattern,
            COUNT(*) AS occurrences
         FROM pr_reviews
         WHERE verdict = 'reject'
           AND created_at > NOW() - INTERVAL '7 days'
         GROUP BY pattern
         HAVING COUNT(*) >= 3
         ORDER BY occurrences DESC
         LIMIT 5",
    )
    .fetch_all(pool)
    .await?;

    for (pattern, count) in &rejection_patterns {
        // Check if this problem already exists.
        let exists = sqlx::query_as::<_, (i64,)>(
            "SELECT COUNT(*) FROM ecosystem_problems
             WHERE title ILIKE '%' || $1 || '%' AND status != 'solved'",
        )
        .bind(&pattern[..pattern.len().min(50)])
        .fetch_one(pool)
        .await?;

        if exists.0 == 0 {
            sqlx::query(
                "INSERT INTO ecosystem_problems (title, description, category, evidence, incident_count, affected_agents, severity)
                 VALUES ($1, $2, 'quality', $3, $4, $5, 'medium')"
            )
            .bind(format!("Repeated rejection pattern: {}", &pattern[..pattern.len().min(80)]))
            .bind(format!("This rejection pattern appeared {} times in the last 7 days across multiple PRs.", count))
            .bind(serde_json::json!({"pattern": pattern, "count": count}))
            .bind(*count as i32)
            .bind(*count as i32)
            .execute(pool)
            .await?;
            problems_found += 1;
        }
    }

    // 2. Detect missing tools — similar bounties posted by multiple agents.
    let similar_bounties = sqlx::query_as::<_, (String, i64)>(
        "SELECT
            SUBSTRING(title FROM 1 FOR 80) AS topic,
            COUNT(DISTINCT posted_by) AS agents
         FROM bounties
         WHERE created_at > NOW() - INTERVAL '7 days'
         GROUP BY topic
         HAVING COUNT(DISTINCT posted_by) >= 3
         LIMIT 5",
    )
    .fetch_all(pool)
    .await?;

    for (topic, agent_count) in &similar_bounties {
        let exists = sqlx::query_as::<_, (i64,)>(
            "SELECT COUNT(*) FROM ecosystem_problems
             WHERE category = 'tooling' AND title ILIKE '%' || $1 || '%' AND status != 'solved'",
        )
        .bind(&topic[..topic.len().min(40)])
        .fetch_one(pool)
        .await?;

        if exists.0 == 0 {
            sqlx::query(
                "INSERT INTO ecosystem_problems (title, description, category, evidence, incident_count, affected_agents, severity)
                 VALUES ($1, $2, 'tooling', $3, $4, $5, 'high')"
            )
            .bind(format!("Missing tool: {}", topic))
            .bind(format!("{} agents posted similar bounties for '{}' this week.", agent_count, topic))
            .bind(serde_json::json!({"topic": topic, "agents": agent_count}))
            .bind(*agent_count as i32)
            .bind(*agent_count as i32)
            .execute(pool)
            .await?;
            problems_found += 1;
        }
    }

    info!(problems_found, "Ecosystem analysis complete");
    Ok(())
}
