//! Trace outcome evaluator: determine whether each reasoning trace
//! led to a positive, negative, or neutral outcome.
//!
//! Runs every hour. Evaluates traces that are 24+ hours old and still
//! pending. Looks up the referenced action to determine outcome.

/// Evaluate pending trace outcomes based on action results.
///
/// For each trace with `outcome_quality = 'pending'` and age > 24h:
/// - PR submissions: merged = positive, rejected = negative
/// - PR reviews: correct verdict = positive, missed bug = negative
/// - Bounty claims: accepted = positive, disputed = negative
/// - Technical decisions: voted for winner = positive
/// - All others: neutral after 14 days if no clear signal
pub async fn run_trace_outcome_evaluation(pool: &sqlx::PgPool) -> Result<(), anyhow::Error> {
    let start = std::time::Instant::now();

    let merged_prs = evaluate_pr_submissions(pool).await?;
    let reviews = evaluate_pr_reviews(pool).await?;
    let bounties = evaluate_bounty_claims(pool).await?;
    let decisions = evaluate_technical_decisions(pool).await?;
    let stale = evaluate_stale_traces(pool).await?;

    tracing::info!(
        merged_prs,
        reviews,
        bounties,
        decisions,
        stale,
        duration_ms = start.elapsed().as_millis() as u64,
        "Trace outcome evaluation complete"
    );

    Ok(())
}

/// Evaluate traces linked to PR submissions.
async fn evaluate_pr_submissions(pool: &sqlx::PgPool) -> Result<u64, anyhow::Error> {
    // Merged PRs → positive
    let merged = sqlx::query(
        r#"UPDATE reasoning_traces rt
           SET outcome_quality = 'positive',
               outcome_evaluated_at = NOW(),
               outcome_details = jsonb_build_object(
                   'pr_status', 'merged',
                   'evaluation_trigger', 'pr_merged'
               )
           WHERE rt.outcome_quality = 'pending'
             AND rt.action_type = 'pr_submission'
             AND rt.action_ref_type = 'pull_request'
             AND rt.created_at < NOW() - INTERVAL '24 hours'
             AND EXISTS (
                 SELECT 1 FROM pull_requests pr
                 WHERE pr.id = rt.action_ref_id
                   AND pr.status = 'merged'
             )"#,
    )
    .execute(pool)
    .await?
    .rows_affected();

    // Rejected PRs → negative
    let rejected = sqlx::query(
        r#"UPDATE reasoning_traces rt
           SET outcome_quality = 'negative',
               outcome_evaluated_at = NOW(),
               outcome_details = jsonb_build_object(
                   'pr_status', 'rejected',
                   'evaluation_trigger', 'pr_rejected'
               )
           WHERE rt.outcome_quality = 'pending'
             AND rt.action_type = 'pr_submission'
             AND rt.action_ref_type = 'pull_request'
             AND rt.created_at < NOW() - INTERVAL '24 hours'
             AND EXISTS (
                 SELECT 1 FROM pull_requests pr
                 WHERE pr.id = rt.action_ref_id
                   AND pr.status IN ('rejected', 'closed')
             )"#,
    )
    .execute(pool)
    .await?
    .rows_affected();

    // Open PRs after 7 days → neutral
    let stale = sqlx::query(
        r#"UPDATE reasoning_traces rt
           SET outcome_quality = 'neutral',
               outcome_evaluated_at = NOW(),
               outcome_details = jsonb_build_object(
                   'pr_status', 'open',
                   'evaluation_trigger', 'stale_after_7d'
               )
           WHERE rt.outcome_quality = 'pending'
             AND rt.action_type = 'pr_submission'
             AND rt.action_ref_type = 'pull_request'
             AND rt.created_at < NOW() - INTERVAL '7 days'
             AND EXISTS (
                 SELECT 1 FROM pull_requests pr
                 WHERE pr.id = rt.action_ref_id
                   AND pr.status = 'open'
             )"#,
    )
    .execute(pool)
    .await?
    .rows_affected();

    tracing::info!(merged, rejected, stale, "PR submission traces evaluated");
    Ok(merged + rejected + stale)
}

/// Evaluate traces linked to PR reviews.
async fn evaluate_pr_reviews(pool: &sqlx::PgPool) -> Result<u64, anyhow::Error> {
    // Correct reviews (approve or reject) → positive
    let correct = sqlx::query(
        r#"UPDATE reasoning_traces rt
           SET outcome_quality = 'positive',
               outcome_evaluated_at = NOW(),
               outcome_details = jsonb_build_object(
                   'review_outcome', ro.outcome,
                   'evaluation_trigger', 'review_outcome_correct'
               )
           FROM review_outcomes ro
           WHERE rt.outcome_quality = 'pending'
             AND rt.action_type = 'pr_review'
             AND rt.action_ref_type = 'pr_review'
             AND rt.created_at < NOW() - INTERVAL '24 hours'
             AND ro.review_id = rt.action_ref_id
             AND ro.outcome IN ('correct_approve', 'correct_reject')"#,
    )
    .execute(pool)
    .await?
    .rows_affected();

    // Missed bugs or false rejects → negative
    let incorrect = sqlx::query(
        r#"UPDATE reasoning_traces rt
           SET outcome_quality = 'negative',
               outcome_evaluated_at = NOW(),
               outcome_details = jsonb_build_object(
                   'review_outcome', ro.outcome,
                   'evaluation_trigger', 'review_outcome_incorrect'
               )
           FROM review_outcomes ro
           WHERE rt.outcome_quality = 'pending'
             AND rt.action_type = 'pr_review'
             AND rt.action_ref_type = 'pr_review'
             AND rt.created_at < NOW() - INTERVAL '24 hours'
             AND ro.review_id = rt.action_ref_id
             AND ro.outcome IN ('missed_bug', 'missed_security', 'false_reject')"#,
    )
    .execute(pool)
    .await?
    .rows_affected();

    tracing::info!(correct, incorrect, "PR review traces evaluated");
    Ok(correct + incorrect)
}

/// Evaluate traces linked to bounty claims.
async fn evaluate_bounty_claims(pool: &sqlx::PgPool) -> Result<u64, anyhow::Error> {
    // Accepted bounties → positive
    let accepted = sqlx::query(
        r#"UPDATE reasoning_traces rt
           SET outcome_quality = 'positive',
               outcome_evaluated_at = NOW(),
               outcome_details = jsonb_build_object(
                   'bounty_status', 'accepted',
                   'evaluation_trigger', 'bounty_accepted'
               )
           WHERE rt.outcome_quality = 'pending'
             AND rt.action_type = 'bounty_claim'
             AND rt.action_ref_type = 'bounty'
             AND rt.created_at < NOW() - INTERVAL '24 hours'
             AND EXISTS (
                 SELECT 1 FROM bounties b
                 WHERE b.id = rt.action_ref_id
                   AND b.status = 'accepted'
             )"#,
    )
    .execute(pool)
    .await?
    .rows_affected();

    // Disputed bounties → negative
    let disputed = sqlx::query(
        r#"UPDATE reasoning_traces rt
           SET outcome_quality = 'negative',
               outcome_evaluated_at = NOW(),
               outcome_details = jsonb_build_object(
                   'bounty_status', 'disputed',
                   'evaluation_trigger', 'bounty_disputed'
               )
           WHERE rt.outcome_quality = 'pending'
             AND rt.action_type = 'bounty_claim'
             AND rt.action_ref_type = 'bounty'
             AND rt.created_at < NOW() - INTERVAL '24 hours'
             AND EXISTS (
                 SELECT 1 FROM bounties b
                 WHERE b.id = rt.action_ref_id
                   AND b.status = 'disputed'
             )"#,
    )
    .execute(pool)
    .await?
    .rows_affected();

    // Expired bounties → neutral
    let expired = sqlx::query(
        r#"UPDATE reasoning_traces rt
           SET outcome_quality = 'neutral',
               outcome_evaluated_at = NOW(),
               outcome_details = jsonb_build_object(
                   'bounty_status', 'expired',
                   'evaluation_trigger', 'bounty_expired'
               )
           WHERE rt.outcome_quality = 'pending'
             AND rt.action_type = 'bounty_claim'
             AND rt.action_ref_type = 'bounty'
             AND rt.created_at < NOW() - INTERVAL '24 hours'
             AND EXISTS (
                 SELECT 1 FROM bounties b
                 WHERE b.id = rt.action_ref_id
                   AND b.status = 'expired'
             )"#,
    )
    .execute(pool)
    .await?
    .rows_affected();

    tracing::info!(accepted, disputed, expired, "Bounty claim traces evaluated");
    Ok(accepted + disputed + expired)
}

/// Evaluate traces linked to technical decision votes.
async fn evaluate_technical_decisions(pool: &sqlx::PgPool) -> Result<u64, anyhow::Error> {
    // Voted for winning option → positive
    let winners = sqlx::query(
        r#"UPDATE reasoning_traces rt
           SET outcome_quality = 'positive',
               outcome_evaluated_at = NOW(),
               outcome_details = jsonb_build_object(
                   'evaluation_trigger', 'voted_for_winner'
               )
           WHERE rt.outcome_quality = 'pending'
             AND rt.action_type = 'technical_decision'
             AND rt.action_ref_type = 'technical_decision'
             AND rt.created_at < NOW() - INTERVAL '24 hours'
             AND EXISTS (
                 SELECT 1 FROM technical_decisions td
                 JOIN decision_votes dv ON dv.decision_id = td.id
                 WHERE td.id = rt.action_ref_id
                   AND td.status = 'decided'
                   AND dv.voter_id = rt.agent_id
                   AND dv.option_id = td.winning_option_id
             )"#,
    )
    .execute(pool)
    .await?
    .rows_affected();

    // Voted for losing option → neutral (dissent is healthy)
    let losers = sqlx::query(
        r#"UPDATE reasoning_traces rt
           SET outcome_quality = 'neutral',
               outcome_evaluated_at = NOW(),
               outcome_details = jsonb_build_object(
                   'evaluation_trigger', 'voted_for_non_winner'
               )
           WHERE rt.outcome_quality = 'pending'
             AND rt.action_type = 'technical_decision'
             AND rt.action_ref_type = 'technical_decision'
             AND rt.created_at < NOW() - INTERVAL '24 hours'
             AND EXISTS (
                 SELECT 1 FROM technical_decisions td
                 JOIN decision_votes dv ON dv.decision_id = td.id
                 WHERE td.id = rt.action_ref_id
                   AND td.status = 'decided'
                   AND dv.voter_id = rt.agent_id
                   AND dv.option_id != td.winning_option_id
             )"#,
    )
    .execute(pool)
    .await?
    .rows_affected();

    tracing::info!(winners, losers, "Technical decision traces evaluated");
    Ok(winners + losers)
}

/// Mark remaining old traces as neutral if no clear signal exists.
async fn evaluate_stale_traces(pool: &sqlx::PgPool) -> Result<u64, anyhow::Error> {
    let stale = sqlx::query(
        r#"UPDATE reasoning_traces
           SET outcome_quality = 'neutral',
               outcome_evaluated_at = NOW(),
               outcome_details = jsonb_build_object(
                   'reason', 'no clear outcome signal',
                   'evaluation_trigger', 'stale_after_14d'
               )
           WHERE outcome_quality = 'pending'
             AND created_at < NOW() - INTERVAL '14 days'"#,
    )
    .execute(pool)
    .await?
    .rows_affected();

    if stale > 0 {
        tracing::info!(stale, "Stale traces marked as neutral");
    }
    Ok(stale)
}
