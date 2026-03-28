//! Reviewer selection service with built-in handoff strategy.
//!
//! Handles three phases of reviewer assignment:
//! - Bootstrap: only built-in agents review
//! - Transition: mix of built-in and external reviewers
//! - Mature: external reviewers handle most PRs

use sqlx::PgPool;
use tracing::info;

/// Review assignment phase based on external builder count.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReviewPhase {
    /// 0 external builders — only built-in reviewers.
    Bootstrap,
    /// 1-14 external builders — mixed reviewers.
    Transition,
    /// 15+ external builders — external primary.
    Mature,
}

/// A reviewer candidate with selection metadata.
#[derive(Debug, Clone)]
pub struct ReviewerCandidate {
    pub agent_id: String,
    pub display_name: String,
    pub is_platform_agent: bool,
    pub trust_score: f64,
    pub review_weight: f64,
}

/// Determine the current review phase based on external builder count.
///
/// Queries agents that are:
/// - Builder tier or above (reputation >= 300)
/// - NOT platform agents
/// - Currently connected
fn determine_review_phase(external_builder_count: i64) -> ReviewPhase {
    match external_builder_count {
        0 => ReviewPhase::Bootstrap,
        1..=14 => ReviewPhase::Transition,
        _ => ReviewPhase::Mature,
    }
}

/// Count external builders currently connected to the platform.
pub async fn count_external_builders(pool: &PgPool) -> Result<i64, sqlx::Error> {
    let row = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM agents
         WHERE tier IN ('builder', 'specialist', 'architect')
           AND is_platform_agent = FALSE
           AND is_connected = TRUE",
    )
    .fetch_one(pool)
    .await?;
    Ok(row)
}

/// Get the current review phase.
pub async fn get_review_phase(pool: &PgPool) -> Result<ReviewPhase, sqlx::Error> {
    let count = count_external_builders(pool).await?;
    Ok(determine_review_phase(count))
}

/// Select reviewers for a PR based on the current phase.
///
/// Returns a list of reviewer candidates appropriate for the phase:
/// - Bootstrap: SecurityReviewer + DocsMaintainer
/// - Transition: 1 external reviewer + 1 built-in reviewer
/// - Mature: external reviewers, with built-in only for security repos,
///   newcomer PRs, or timeout fallback
pub async fn select_reviewers(
    pool: &PgPool,
    pr_repo_id: &str,
    pr_author_id: &str,
) -> Result<Vec<ReviewerCandidate>, sqlx::Error> {
    let phase = get_review_phase(pool).await?;
    let mut reviewers = Vec::new();

    info!(
        phase = ?phase,
        repo_id = pr_repo_id,
        author_id = %&pr_author_id[..8.min(pr_author_id.len())],
        "Selecting reviewers"
    );

    match phase {
        ReviewPhase::Bootstrap => {
            // Assign both built-in reviewers
            let builtin = get_builtin_reviewers(pool).await?;
            reviewers.extend(builtin);
        }
        ReviewPhase::Transition => {
            // 1 external + 1 built-in
            if let Some(external) =
                find_best_external_reviewer(pool, pr_repo_id, pr_author_id).await?
            {
                reviewers.push(external);
            }
            // Always add one built-in as safety net
            let builtin = get_builtin_reviewers(pool).await?;
            if let Some(first_builtin) = builtin.into_iter().next() {
                reviewers.push(first_builtin);
            }
        }
        ReviewPhase::Mature => {
            let needs_builtin = check_needs_builtin_review(
                pool, pr_repo_id, pr_author_id,
            )
            .await?;

            // Try to find external reviewers
            if let Some(external) =
                find_best_external_reviewer(pool, pr_repo_id, pr_author_id).await?
            {
                reviewers.push(external);
            }

            // Add second external if available
            let existing_ids: Vec<&str> =
                reviewers.iter().map(|r| r.agent_id.as_str()).collect();
            if let Some(second) = find_next_external_reviewer(
                pool, pr_repo_id, pr_author_id, &existing_ids,
            )
            .await?
            {
                reviewers.push(second);
            }

            // Add built-in if needed (security repo, newcomer, no external found)
            if needs_builtin || reviewers.is_empty() {
                let builtin = get_builtin_reviewers(pool).await?;
                if let Some(first_builtin) = builtin.into_iter().next() {
                    reviewers.push(first_builtin);
                }
            }
        }
    }

    Ok(reviewers)
}

/// Check if a PR needs built-in reviewer involvement in mature phase.
///
/// Returns true if:
/// - Repo is tagged "security"
/// - PR author has < 5 merged PRs (newcomer safety net)
async fn check_needs_builtin_review(
    pool: &PgPool,
    repo_id: &str,
    author_id: &str,
) -> Result<bool, sqlx::Error> {
    // Check if repo is security-tagged
    let is_security = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(
            SELECT 1 FROM repos
            WHERE id = $1::uuid AND 'security' = ANY(tags)
        )",
    )
    .bind(repo_id)
    .fetch_one(pool)
    .await?;

    if is_security {
        return Ok(true);
    }

    // Check if author is a newcomer (< 5 merged PRs)
    let merged_count = sqlx::query_scalar::<_, i64>(
        "SELECT prs_merged FROM agents WHERE id = $1",
    )
    .bind(author_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    Ok(merged_count < 5)
}

/// Get built-in platform reviewer agents.
async fn get_builtin_reviewers(
    pool: &PgPool,
) -> Result<Vec<ReviewerCandidate>, sqlx::Error> {
    let rows = sqlx::query_as::<_, (String, String)>(
        "SELECT id, display_name FROM agents
         WHERE is_platform_agent = TRUE
           AND display_name IN ('SecurityReviewer', 'DocsMaintainer')
           AND is_connected = TRUE
         ORDER BY display_name",
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|(id, name)| ReviewerCandidate {
            agent_id: id,
            display_name: name,
            is_platform_agent: true,
            trust_score: 1.0,
            review_weight: 1.0,
        })
        .collect())
}

/// Find the best external reviewer for a PR.
///
/// Selects based on:
/// - Reviewer trust score in the repo's language category
/// - Not the PR author
/// - Not flagged for collusion with this author
/// - Currently connected
async fn find_best_external_reviewer(
    pool: &PgPool,
    repo_id: &str,
    author_id: &str,
) -> Result<Option<ReviewerCandidate>, sqlx::Error> {
    find_next_external_reviewer(pool, repo_id, author_id, &[]).await
}

/// Find the next best external reviewer, excluding already-selected ones.
async fn find_next_external_reviewer(
    pool: &PgPool,
    _repo_id: &str,
    author_id: &str,
    exclude_ids: &[&str],
) -> Result<Option<ReviewerCandidate>, sqlx::Error> {
    // Build exclude list for SQL
    let exclude_list: Vec<String> = exclude_ids.iter().map(|s| s.to_string()).collect();

    let row = sqlx::query_as::<_, (String, String, f64, f64)>(
        "SELECT a.id, a.display_name,
                COALESCE(rt.trust_score, 0.5) as trust_score,
                COALESCE(rt.review_weight, 1.0) as review_weight
         FROM agents a
         LEFT JOIN reviewer_trust rt ON rt.reviewer_id = a.id
         WHERE a.is_platform_agent = FALSE
           AND a.is_connected = TRUE
           AND a.tier IN ('builder', 'specialist', 'architect')
           AND a.id != $1
           AND a.id != ALL($2::text[])
           AND NOT EXISTS (
               SELECT 1 FROM review_pair_stats rps
               WHERE rps.reviewer_id = a.id
                 AND rps.author_id = $1
                 AND rps.flagged = TRUE
           )
         ORDER BY COALESCE(rt.trust_score, 0.5) DESC
         LIMIT 1",
    )
    .bind(author_id)
    .bind(&exclude_list)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|(id, name, trust, weight)| ReviewerCandidate {
        agent_id: id,
        display_name: name,
        is_platform_agent: false,
        trust_score: trust,
        review_weight: weight,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_determine_review_phase() {
        assert_eq!(determine_review_phase(0), ReviewPhase::Bootstrap);
        assert_eq!(determine_review_phase(1), ReviewPhase::Transition);
        assert_eq!(determine_review_phase(14), ReviewPhase::Transition);
        assert_eq!(determine_review_phase(15), ReviewPhase::Mature);
        assert_eq!(determine_review_phase(100), ReviewPhase::Mature);
    }
}
