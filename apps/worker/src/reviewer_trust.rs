//! Reviewer trust engine: evaluate review accuracy over time.
//!
//! Runs daily. For each reviewer, evaluates pending review outcomes
//! based on what happened after merge (bugs found? security issues?).
//! Updates trust scores and review weights.

/// Evaluate pending review outcomes and update reviewer trust scores.
///
/// For each review with outcome = 'pending':
/// - If PR merged and reviewer approved: check for bugs in 14-day window
/// - If PR merged and reviewer rejected: mark as false_reject
/// - If PR closed and reviewer rejected: mark as correct_reject
///
/// Then recompute trust_score and review_weight for each reviewer-category pair.
pub async fn run_reviewer_trust_update(pool: &sqlx::PgPool) -> Result<(), anyhow::Error> {
    evaluate_pending_outcomes(pool).await?;
    recompute_trust_scores(pool).await?;
    Ok(())
}

/// Evaluate reviews that have been pending for 14+ days.
async fn evaluate_pending_outcomes(pool: &sqlx::PgPool) -> Result<(), anyhow::Error> {
    // Find approved reviews on merged PRs that are 14+ days old with no bugs
    let correct_approvals = sqlx::query(
        r#"UPDATE review_outcomes SET outcome = 'correct_approve',
               days_to_outcome = EXTRACT(DAY FROM NOW() - created_at)::integer,
               evaluated_at = NOW()
           WHERE outcome = 'pending'
             AND original_verdict = 'approve'
             AND created_at < NOW() - interval '14 days'
             AND pr_id IN (
                 SELECT id FROM pull_requests WHERE status = 'merged'
             )
             AND NOT EXISTS (
                 SELECT 1 FROM repo_issues ri
                 WHERE ri.resolved_by_pr = review_outcomes.pr_id
                   AND ri.severity IN ('high', 'critical')
                   AND ri.created_at > review_outcomes.created_at
             )"#,
    )
    .execute(pool)
    .await?;

    tracing::info!(
        correct_approvals = correct_approvals.rows_affected(),
        "Evaluated correct approvals"
    );

    // Find rejected reviews where PR was later merged successfully
    let false_rejects = sqlx::query(
        r#"UPDATE review_outcomes SET outcome = 'false_reject',
               days_to_outcome = EXTRACT(DAY FROM NOW() - created_at)::integer,
               evaluated_at = NOW()
           WHERE outcome = 'pending'
             AND original_verdict IN ('reject', 'request_changes')
             AND pr_id IN (
                 SELECT id FROM pull_requests WHERE status = 'merged'
             )
             AND created_at < NOW() - interval '14 days'"#,
    )
    .execute(pool)
    .await?;

    tracing::info!(
        false_rejects = false_rejects.rows_affected(),
        "Evaluated false rejects"
    );

    // Find correct rejections (PR closed/rejected)
    let correct_rejects = sqlx::query(
        r#"UPDATE review_outcomes SET outcome = 'correct_reject',
               days_to_outcome = EXTRACT(DAY FROM NOW() - created_at)::integer,
               evaluated_at = NOW()
           WHERE outcome = 'pending'
             AND original_verdict IN ('reject', 'request_changes')
             AND pr_id IN (
                 SELECT id FROM pull_requests WHERE status IN ('rejected', 'closed')
             )"#,
    )
    .execute(pool)
    .await?;

    tracing::info!(
        correct_rejects = correct_rejects.rows_affected(),
        "Evaluated correct rejects"
    );

    Ok(())
}

/// Recompute trust scores and review weights for all reviewers.
async fn recompute_trust_scores(pool: &sqlx::PgPool) -> Result<(), anyhow::Error> {
    // Aggregate outcomes per reviewer-category pair.
    // Derive category from the repo's primary language via the reviewed PR.
    let stats = sqlx::query_as::<_, (String, String, i64, i64, i64, i64)>(
        r#"SELECT ro.reviewer_id,
               COALESCE(r.languages->0->>'name', 'general') AS category,
               COUNT(*) FILTER (WHERE ro.outcome IN ('correct_approve', 'correct_reject')),
               COUNT(*) FILTER (WHERE ro.outcome IN ('missed_bug', 'missed_security')),
               COUNT(*) FILTER (WHERE ro.outcome = 'false_reject'),
               COUNT(*) FILTER (WHERE ro.outcome = 'false_positive')
           FROM review_outcomes ro
           LEFT JOIN pull_requests pr ON pr.id = ro.pr_id
           LEFT JOIN repos r ON r.id = pr.repo_id
           WHERE ro.outcome != 'pending'
           GROUP BY ro.reviewer_id, category"#,
    )
    .fetch_all(pool)
    .await?;

    for (reviewer_id, category, accurate, missed, false_rej, false_pos) in &stats {
        let total = accurate + missed + false_rej + false_pos;
        if total == 0 {
            continue;
        }

        let trust_score = *accurate as f64 / total as f64;
        let review_weight = compute_review_weight(trust_score, total);

        sqlx::query(
            r#"INSERT INTO reviewer_trust
               (reviewer_id, category, reviews_given, accurate_reviews,
                missed_issues, false_positives, trust_score, review_weight)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (reviewer_id, category) DO UPDATE
               SET reviews_given = $3, accurate_reviews = $4,
                   missed_issues = $5, false_positives = $6,
                   trust_score = $7, review_weight = $8, updated_at = NOW()"#,
        )
        .bind(reviewer_id)
        .bind(category)
        .bind(total)
        .bind(accurate)
        .bind(missed)
        .bind(*false_pos + *false_rej)
        .bind(trust_score)
        .bind(review_weight)
        .execute(pool)
        .await?;
    }

    tracing::info!(reviewers_updated = stats.len(), "Trust scores recomputed");
    Ok(())
}

/// Compute review weight from trust score.
///
/// - trust < 0.3: weight = 0.5
/// - trust 0.3-0.5: weight = 0.75
/// - trust 0.5-0.7: weight = 1.0
/// - trust 0.7-0.85: weight = 1.5
/// - trust > 0.85: weight = 2.0
///
/// Minimum 10 reviews before trust_score is considered reliable;
/// below that, default weight of 1.0 is used.
fn compute_review_weight(trust_score: f64, total_reviews: i64) -> f64 {
    if total_reviews < 10 {
        return 1.0;
    }
    match trust_score {
        t if t < 0.3 => 0.5,
        t if t < 0.5 => 0.75,
        t if t < 0.7 => 1.0,
        t if t < 0.85 => 1.5,
        _ => 2.0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_review_weight_thresholds() {
        assert!((compute_review_weight(0.2, 15) - 0.5).abs() < f64::EPSILON);
        assert!((compute_review_weight(0.4, 15) - 0.75).abs() < f64::EPSILON);
        assert!((compute_review_weight(0.6, 15) - 1.0).abs() < f64::EPSILON);
        assert!((compute_review_weight(0.8, 15) - 1.5).abs() < f64::EPSILON);
        assert!((compute_review_weight(0.9, 15) - 2.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_review_weight_insufficient_reviews() {
        assert!((compute_review_weight(0.1, 5) - 1.0).abs() < f64::EPSILON);
        assert!((compute_review_weight(0.9, 9) - 1.0).abs() < f64::EPSILON);
    }
}
