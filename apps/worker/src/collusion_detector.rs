//! Collusion detector: identify suspicious review patterns.
//!
//! Runs daily. Detects (reviewer, author) pairs with abnormally high
//! approval rates that may indicate rubber-stamping.
//! Flagged pairs are excluded from review assignment but NOT auto-penalized.

/// Run collusion detection across all review pairs.
///
/// 1. Update review_pair_stats from recent reviews
/// 2. Compute pair_approval_rate for each pair
/// 3. Flag pairs with suspiciously high approval rates
/// 4. De-flag pairs that subsequently show a rejection
pub async fn run_collusion_detection(pool: &sqlx::PgPool) -> Result<(), anyhow::Error> {
    update_pair_stats(pool).await?;
    flag_suspicious_pairs(pool).await?;
    deflag_resolved_pairs(pool).await?;
    Ok(())
}

/// Update review_pair_stats from pr_reviews data.
async fn update_pair_stats(pool: &sqlx::PgPool) -> Result<(), anyhow::Error> {
    // Aggregate review verdicts per (reviewer, author) pair
    let pairs = sqlx::query_as::<_, (String, String, i64, i64, i64)>(
        r#"SELECT r.reviewer_id, p.author_id,
               COUNT(*) FILTER (WHERE r.verdict = 'approve'),
               COUNT(*) FILTER (WHERE r.verdict = 'reject'),
               COUNT(*) FILTER (WHERE r.verdict = 'request_changes')
           FROM pr_reviews r
           JOIN pull_requests p ON p.id = r.pr_id
           GROUP BY r.reviewer_id, p.author_id"#,
    )
    .fetch_all(pool)
    .await?;

    for (reviewer, author, approves, rejects, changes) in &pairs {
        let total = approves + rejects + changes;
        let approval_rate = if total > 0 {
            *approves as f64 / total as f64
        } else {
            0.0
        };

        sqlx::query(
            r#"INSERT INTO review_pair_stats
               (reviewer_id, author_id, approve_count, reject_count,
                change_request_count, pair_approval_rate, last_review_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW())
               ON CONFLICT (reviewer_id, author_id) DO UPDATE
               SET approve_count = $3, reject_count = $4,
                   change_request_count = $5, pair_approval_rate = $6,
                   last_review_at = NOW()"#,
        )
        .bind(reviewer)
        .bind(author)
        .bind(approves)
        .bind(rejects)
        .bind(changes)
        .bind(approval_rate)
        .execute(pool)
        .await?;
    }

    tracing::info!(pairs_updated = pairs.len(), "Review pair stats updated");
    Ok(())
}

/// Flag pairs with suspiciously high approval rates.
///
/// A pair is flagged when:
/// - pair_approval_rate > platform_avg + 0.25
/// - approve_count >= 5
/// - reject_count == 0
async fn flag_suspicious_pairs(pool: &sqlx::PgPool) -> Result<(), anyhow::Error> {
    // Compute platform average approval rate
    let avg: Option<(f64,)> = sqlx::query_as(
        r#"SELECT COALESCE(AVG(pair_approval_rate), 0.5)
           FROM review_pair_stats
           WHERE approve_count + reject_count + change_request_count >= 3"#,
    )
    .fetch_optional(pool)
    .await?;

    let platform_avg = avg.map(|(a,)| a).unwrap_or(0.5);
    let threshold = platform_avg + 0.25;

    let flagged = sqlx::query(
        r#"UPDATE review_pair_stats
           SET flagged = TRUE, flagged_at = NOW()
           WHERE pair_approval_rate > $1
             AND approve_count >= 5
             AND reject_count = 0
             AND flagged = FALSE"#,
    )
    .bind(threshold)
    .execute(pool)
    .await?;

    if flagged.rows_affected() > 0 {
        tracing::info!(
            newly_flagged = flagged.rows_affected(),
            platform_avg = %platform_avg,
            threshold = %threshold,
            "Suspicious review pairs flagged"
        );
    }

    Ok(())
}

/// De-flag pairs where a rejection has since occurred.
async fn deflag_resolved_pairs(pool: &sqlx::PgPool) -> Result<(), anyhow::Error> {
    let deflagged = sqlx::query(
        r#"UPDATE review_pair_stats
           SET flagged = FALSE, flagged_at = NULL
           WHERE flagged = TRUE AND reject_count > 0"#,
    )
    .execute(pool)
    .await?;

    if deflagged.rows_affected() > 0 {
        tracing::info!(
            deflagged = deflagged.rows_affected(),
            "Previously flagged pairs de-flagged after rejection"
        );
    }

    Ok(())
}
