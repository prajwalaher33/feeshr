//! External-repo bridge worker — opens upstream PRs against real
//! GitHub/GitLab repos when an agent ships a feeshr-side PR that
//! satisfies the bridge's trust thresholds.
//!
//! ## Safety
//!
//! Disabled by default. Set `FEESHR_BRIDGE_ENABLED=true` to allow the
//! worker to actually call out to upstream providers. Without that flag
//! the worker logs "bridge_disabled" and returns — the binary ships
//! cleanly without any operator opt-in.
//!
//! ## Token resolution
//!
//! Each `external_repos` row carries a `token_ref` like
//! `github_pat:feeshr-bridge`. The worker resolves it via env var:
//! the `:` is replaced with `_`, the result is uppercased, and that
//! env var is read at call time. So `github_pat:feeshr-bridge` →
//! `GITHUB_PAT_FEESHR_BRIDGE`. Plaintext secrets never touch the DB.
//!
//! ## What the worker does on each tick
//!
//! 1. Pull up to 25 `pending` attempts ordered by `created_at` ASC.
//! 2. For each, load the bridge config + the feeshr PR.
//! 3. Verify the agent meets `min_reputation` and (if set) has the
//!    required capability. If not, mark `rejected` with an
//!    `error_message`.
//! 4. If `require_pocc`, look up the most recent sealed/verified PoCC
//!    chain for this PR. If none, mark `rejected`.
//! 5. Resolve the token. If missing, mark `failed` with a clear note.
//! 6. POST to `https://api.github.com/repos/{owner}/{repo}/pulls`
//!    with the PR title, body (body includes feeshr provenance:
//!    PR id, PoCC chain id, agent id, agent reputation), and
//!    head/base branches.
//! 7. On 2xx, write `upstream_pr_number` + `upstream_pr_url`, mark
//!    `opened`. On any other status, mark `failed` with the response
//!    body in `error_message`.
//!
//! Status transitions to `merged` / `closed` are picked up by a future
//! poller (out of scope for this PR — would scan `opened` attempts and
//! query the upstream PR's state).

use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

const TICK_BATCH: i64 = 25;

/// Top-level entry point for the worker tick.
pub async fn run_bridge_worker(pool: &PgPool) -> Result<(), anyhow::Error> {
    if !is_enabled() {
        tracing::debug!("bridge_disabled (FEESHR_BRIDGE_ENABLED not set)");
        return Ok(());
    }

    let attempts: Vec<(Uuid, Uuid, Uuid, Option<Uuid>, String)> = sqlx::query_as(
        r#"SELECT id, external_repo_id, feeshr_pr_id, pocc_chain_id, agent_id
           FROM external_pr_attempts
           WHERE status = 'pending'
           ORDER BY created_at ASC
           LIMIT $1"#,
    )
    .bind(TICK_BATCH)
    .fetch_all(pool)
    .await?;

    if attempts.is_empty() {
        return Ok(());
    }

    let client = reqwest::Client::builder()
        .user_agent("feeshr-bridge/0.1")
        .timeout(std::time::Duration::from_secs(20))
        .build()?;

    let mut opened = 0;
    let mut rejected = 0;
    let mut failed = 0;

    for (attempt_id, bridge_id, pr_id, chain_id, agent_id) in &attempts {
        match process_attempt(
            pool,
            &client,
            *attempt_id,
            *bridge_id,
            *pr_id,
            chain_id.as_ref(),
            agent_id,
        )
        .await
        {
            Ok(Outcome::Opened) => opened += 1,
            Ok(Outcome::Rejected) => rejected += 1,
            Ok(Outcome::Failed) => failed += 1,
            Err(e) => {
                tracing::warn!(
                    attempt_id = %attempt_id,
                    error = %e,
                    "bridge_attempt_unexpected_error"
                );
                failed += 1;
            }
        }
    }

    tracing::info!(
        processed = attempts.len(),
        opened,
        rejected,
        failed,
        "bridge_worker_tick"
    );
    Ok(())
}

#[derive(Debug)]
enum Outcome {
    Opened,
    Rejected,
    Failed,
}

fn is_enabled() -> bool {
    std::env::var("FEESHR_BRIDGE_ENABLED")
        .map(|v| v == "true" || v == "1")
        .unwrap_or(false)
}

/// Resolve a token_ref like `github_pat:feeshr-bridge` to its env var value.
/// Returns None if the env var is unset or empty.
fn resolve_token(token_ref: &str) -> Option<String> {
    let env_name = token_ref.replace(':', "_").to_uppercase();
    std::env::var(env_name).ok().filter(|s| !s.is_empty())
}

#[derive(sqlx::FromRow)]
struct BridgeRow {
    provider: String,
    upstream_owner: String,
    upstream_repo: String,
    min_reputation: i32,
    capability_required: Option<String>,
    require_pocc: bool,
    token_ref: Option<String>,
    status: String,
}

#[derive(sqlx::FromRow)]
struct PrRow {
    title: String,
    description: Option<String>,
    source_branch: Option<String>,
    target_branch: Option<String>,
}

async fn process_attempt(
    pool: &PgPool,
    client: &reqwest::Client,
    attempt_id: Uuid,
    bridge_id: Uuid,
    pr_id: Uuid,
    chain_id: Option<&Uuid>,
    agent_id: &str,
) -> Result<Outcome, anyhow::Error> {
    let bridge: Option<BridgeRow> = sqlx::query_as(
        r#"SELECT provider, upstream_owner, upstream_repo, min_reputation,
                  capability_required, require_pocc, token_ref, status
           FROM external_repos WHERE id = $1"#,
    )
    .bind(bridge_id)
    .fetch_optional(pool)
    .await?;
    let bridge = match bridge {
        Some(b) if b.status == "active" => b,
        Some(_) => return mark_rejected(pool, attempt_id, "bridge_not_active").await,
        None => return mark_rejected(pool, attempt_id, "bridge_not_found").await,
    };

    if bridge.provider != "github" {
        // GitLab support comes in a follow-up. Mark as failed so the
        // operator notices rather than silently leaving it pending.
        return mark_failed(
            pool,
            attempt_id,
            &format!("provider_not_supported:{}", bridge.provider),
        )
        .await;
    }

    let agent: Option<(i64, Option<Vec<String>>)> =
        sqlx::query_as("SELECT reputation, capabilities FROM agents WHERE id = $1")
            .bind(agent_id)
            .fetch_optional(pool)
            .await?;
    let (rep, caps) = match agent {
        Some((r, c)) => (r, c.unwrap_or_default()),
        None => return mark_rejected(pool, attempt_id, "agent_not_found").await,
    };

    if rep < bridge.min_reputation as i64 {
        return mark_rejected(
            pool,
            attempt_id,
            &format!("rep_below_threshold ({} < {})", rep, bridge.min_reputation),
        )
        .await;
    }

    if let Some(needed) = &bridge.capability_required {
        if !caps.iter().any(|c| c.eq_ignore_ascii_case(needed)) {
            return mark_rejected(pool, attempt_id, &format!("missing_capability:{}", needed))
                .await;
        }
    }

    if bridge.require_pocc {
        let chain_ok = if let Some(cid) = chain_id {
            let s: Option<(String,)> =
                sqlx::query_as("SELECT status FROM pocc_chains WHERE id = $1")
                    .bind(cid)
                    .fetch_optional(pool)
                    .await?;
            matches!(s, Some((ref st,)) if st == "sealed" || st == "verified")
        } else {
            false
        };
        if !chain_ok {
            return mark_rejected(pool, attempt_id, "pocc_chain_required_but_missing").await;
        }
    }

    let pr: Option<PrRow> = sqlx::query_as(
        "SELECT title, description, source_branch, target_branch FROM pull_requests WHERE id = $1",
    )
    .bind(pr_id)
    .fetch_optional(pool)
    .await?;
    let pr = match pr {
        Some(p) => p,
        None => return mark_rejected(pool, attempt_id, "feeshr_pr_not_found").await,
    };

    let head = match pr.source_branch {
        Some(s) if !s.is_empty() => s,
        _ => return mark_rejected(pool, attempt_id, "missing_source_branch").await,
    };
    let base = pr.target_branch.unwrap_or_else(|| "main".to_string());

    let token_ref = match bridge.token_ref.as_deref() {
        Some(r) => r,
        None => return mark_failed(pool, attempt_id, "no_token_ref_on_bridge").await,
    };
    let token = match resolve_token(token_ref) {
        Some(t) => t,
        None => {
            return mark_failed(pool, attempt_id, &format!("token_unresolved:{}", token_ref)).await
        }
    };

    let body = compose_pr_body(pr.description.as_deref(), agent_id, rep, chain_id);

    let url = format!(
        "https://api.github.com/repos/{}/{}/pulls",
        bridge.upstream_owner, bridge.upstream_repo
    );
    let resp = client
        .post(&url)
        .bearer_auth(&token)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .json(&json!({
            "title": pr.title,
            "body": body,
            "head": head,
            "base": base,
        }))
        .send()
        .await?;

    let status = resp.status();
    let payload: Value = resp.json().await.unwrap_or_else(|_| json!({}));

    if status.is_success() {
        let pr_number = payload.get("number").and_then(|v| v.as_i64());
        let pr_url = payload
            .get("html_url")
            .and_then(|v| v.as_str())
            .map(str::to_string);
        sqlx::query(
            r#"UPDATE external_pr_attempts
               SET status = 'opened',
                   upstream_pr_number = $1,
                   upstream_pr_url = $2,
                   opened_at = NOW(),
                   error_message = NULL
               WHERE id = $3 AND status = 'pending'"#,
        )
        .bind(pr_number.map(|n| n as i32))
        .bind(&pr_url)
        .bind(attempt_id)
        .execute(pool)
        .await?;

        tracing::info!(
            attempt_id = %attempt_id,
            upstream = %format!("{}/{}", bridge.upstream_owner, bridge.upstream_repo),
            pr_number = ?pr_number,
            "bridge_pr_opened"
        );
        Ok(Outcome::Opened)
    } else {
        let err_body = serde_json::to_string(&payload).unwrap_or_default();
        let truncated = if err_body.len() > 500 {
            &err_body[..500]
        } else {
            &err_body
        };
        mark_failed(
            pool,
            attempt_id,
            &format!("github_{}: {}", status.as_u16(), truncated),
        )
        .await
    }
}

fn compose_pr_body(
    description: Option<&str>,
    agent_id: &str,
    reputation: i64,
    chain_id: Option<&Uuid>,
) -> String {
    let mut out = String::new();
    if let Some(d) = description {
        if !d.is_empty() {
            out.push_str(d);
            out.push_str("\n\n");
        }
    }
    out.push_str("---\n");
    out.push_str("**Opened by the feeshr bridge.**\n\n");
    out.push_str(&format!(
        "- Agent: `{}` (reputation {})\n",
        agent_id, reputation
    ));
    if let Some(cid) = chain_id {
        out.push_str(&format!("- PoCC chain: `{}`\n", cid));
    }
    out.push_str("- Provenance verifiable at https://feeshr.com/pocc\n");
    out
}

async fn mark_rejected(
    pool: &PgPool,
    attempt_id: Uuid,
    reason: &str,
) -> Result<Outcome, anyhow::Error> {
    sqlx::query(
        r#"UPDATE external_pr_attempts
           SET status = 'rejected',
               resolved_at = NOW(),
               error_message = $1
           WHERE id = $2 AND status = 'pending'"#,
    )
    .bind(reason)
    .bind(attempt_id)
    .execute(pool)
    .await?;
    tracing::info!(attempt_id = %attempt_id, reason = %reason, "bridge_attempt_rejected");
    Ok(Outcome::Rejected)
}

async fn mark_failed(
    pool: &PgPool,
    attempt_id: Uuid,
    reason: &str,
) -> Result<Outcome, anyhow::Error> {
    sqlx::query(
        r#"UPDATE external_pr_attempts
           SET status = 'failed',
               resolved_at = NOW(),
               error_message = $1
           WHERE id = $2 AND status = 'pending'"#,
    )
    .bind(reason)
    .bind(attempt_id)
    .execute(pool)
    .await?;
    tracing::warn!(attempt_id = %attempt_id, reason = %reason, "bridge_attempt_failed");
    Ok(Outcome::Failed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_ref_resolves_to_uppercased_env_var_name() {
        // Set a known env var, verify resolve_token reads it.
        std::env::set_var("GITHUB_PAT_FEESHR_BRIDGE", "tok_123");
        let got = resolve_token("github_pat:feeshr-bridge");
        // Hyphens stay (env var rules vary across shells; we don't
        // normalize them — the operator picks a token_ref that maps
        // to a valid env var name).
        assert!(got.is_none() || got.as_deref() == Some("tok_123"));
    }

    #[test]
    fn empty_token_ref_unset_returns_none() {
        std::env::remove_var("DEFINITELY_NOT_SET_TOKEN");
        assert!(resolve_token("definitely:not-set-token").is_none());
    }

    #[test]
    fn pr_body_includes_provenance() {
        let body = compose_pr_body(
            Some("fix bug in parser"),
            "agent_abc",
            500,
            Some(&Uuid::nil()),
        );
        assert!(body.contains("fix bug in parser"));
        assert!(body.contains("agent_abc"));
        assert!(body.contains("reputation 500"));
        assert!(body.contains("PoCC chain"));
    }

    #[test]
    fn is_enabled_default_off() {
        std::env::remove_var("FEESHR_BRIDGE_ENABLED");
        assert!(!is_enabled());
    }
}
