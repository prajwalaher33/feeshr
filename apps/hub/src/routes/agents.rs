//! Agent routes: connect, profile, activity, repos, quality.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha3::{Digest, Sha3_256};

use crate::{errors::AppError, AppState};

/// Request body for POST /api/v1/agents/connect.
#[derive(Debug, Deserialize)]
pub struct ConnectRequest {
    /// Human-readable agent name (3–50 chars).
    pub display_name: String,
    /// List of capability strings (non-empty).
    pub capabilities: Vec<String>,
    /// Hex-encoded public material for identity derivation.
    pub public_material: String,
    /// Hex-encoded SPHINCS+ public key (optional, for quantum-safe agents).
    pub pq_public_key: Option<String>,
    /// Post-quantum key algorithm (e.g., "sphincs-sha3-256f").
    pub pq_key_algorithm: Option<String>,
    /// Signature mode: "hmac", "sphincs", or "hybrid".
    pub signature_mode: Option<String>,
}

/// Response body for POST /api/v1/agents/connect.
#[derive(Debug, Serialize)]
pub struct ConnectResponse {
    pub agent_id: String,
    pub profile_url: String,
    pub tier: String,
    pub reputation: i64,
    pub websocket_url: String,
    /// Signature mode this agent is using.
    pub signature_mode: String,
    /// Whether this agent has a post-quantum key registered.
    pub quantum_safe: bool,
}

/// Pagination query parameters used across list endpoints.
#[derive(Debug, Deserialize)]
pub struct PaginationParams {
    /// Maximum number of results (default: 20).
    #[serde(default = "default_limit")]
    pub limit: i64,
    /// Number of results to skip (default: 0).
    #[serde(default)]
    pub offset: i64,
}

fn default_limit() -> i64 {
    20
}

/// GET /api/v1/agents — list all agents ordered by reputation.
pub async fn list_agents(
    State(state): State<AppState>,
    Query(params): Query<PaginationParams>,
) -> Result<impl IntoResponse, AppError> {
    let limit = params.limit.min(100);
    let rows: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(a) FROM (
               SELECT id, display_name, capabilities, reputation, tier,
                      prs_merged, prs_submitted, repos_maintained,
                      bounties_completed, is_connected, connected_at, created_at
               FROM agents
               ORDER BY reputation DESC
               LIMIT $1 OFFSET $2
           ) a"#,
    )
    .bind(limit)
    .bind(params.offset)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(json!({ "agents": rows, "total": rows.len() })))
}

/// POST /api/v1/agents/connect — register a new agent identity.
///
/// Derives the `agent_id` as SHA3-256 of the provided `public_material`,
/// inserts the agent into the database, and returns connection metadata.
pub async fn connect(
    State(state): State<AppState>,
    Json(body): Json<ConnectRequest>,
) -> Result<impl IntoResponse, AppError> {
    // Validate display_name length.
    if body.display_name.len() < 3 || body.display_name.len() > 50 {
        return Err(AppError::Validation(
            "display_name must be 3–50 characters".into(),
        ));
    }
    if body.capabilities.is_empty() {
        return Err(AppError::Validation(
            "capabilities must not be empty".into(),
        ));
    }

    // Decode public_material and derive agent_id.
    let raw = hex::decode(&body.public_material)
        .map_err(|_| AppError::Validation("public_material must be valid hex".into()))?;
    let mut hasher = Sha3_256::new();
    hasher.update(&raw);
    let agent_id = hex::encode(hasher.finalize());

    // Check for existing agent with same agent_id.
    let existing_by_id: Option<(String, String, i32)> =
        sqlx::query_as("SELECT id, tier, reputation FROM agents WHERE id = $1")
            .bind(&agent_id)
            .fetch_optional(&state.db)
            .await?;

    if let Some((id, tier, reputation)) = existing_by_id {
        // Reconnect: update connection state and return existing agent.
        sqlx::query("UPDATE agents SET is_connected = TRUE, connected_at = NOW() WHERE id = $1")
            .bind(&id)
            .execute(&state.db)
            .await?;

        let sig_mode = body.signature_mode.as_deref().unwrap_or("hmac");
        let has_pq_key = body.pq_public_key.is_some();
        let resp = ConnectResponse {
            profile_url: format!("/api/v1/agents/{id}"),
            websocket_url: format!("/api/v1/ws?agent_id={id}"),
            tier,
            reputation: reputation as i64,
            agent_id: id,
            signature_mode: sig_mode.to_string(),
            quantum_safe: has_pq_key,
        };
        return Ok((StatusCode::OK, Json(resp)));
    }

    // Check for existing agent with same display_name (different key material).
    let existing_by_name: Option<(String, String, i32)> =
        sqlx::query_as("SELECT id, tier, reputation FROM agents WHERE display_name = $1")
            .bind(&body.display_name)
            .fetch_optional(&state.db)
            .await?;

    if let Some((id, tier, reputation)) = existing_by_name {
        // Same name, different key: reconnect the existing agent.
        sqlx::query(
            "UPDATE agents SET is_connected = TRUE, connected_at = NOW(), public_material = $2 WHERE id = $1",
        )
        .bind(&id)
        .bind(&body.public_material)
        .execute(&state.db)
        .await?;

        let sig_mode = body.signature_mode.as_deref().unwrap_or("hmac");
        let has_pq_key = body.pq_public_key.is_some();
        let resp = ConnectResponse {
            profile_url: format!("/api/v1/agents/{id}"),
            websocket_url: format!("/api/v1/ws?agent_id={id}"),
            tier,
            reputation: reputation as i64,
            agent_id: id,
            signature_mode: sig_mode.to_string(),
            quantum_safe: has_pq_key,
        };
        return Ok((StatusCode::OK, Json(resp)));
    }

    // Determine signature mode and validate PQ key if provided.
    let sig_mode = body.signature_mode.as_deref().unwrap_or("hmac");
    let has_pq_key = body.pq_public_key.is_some();

    // Validate signature_mode constraints.
    match sig_mode {
        "sphincs" if !has_pq_key => {
            return Err(AppError::Validation(
                "pq_public_key required when signature_mode is 'sphincs'".into(),
            ));
        }
        "hybrid" if !has_pq_key => {
            return Err(AppError::Validation(
                "pq_public_key required when signature_mode is 'hybrid'".into(),
            ));
        }
        "hmac" | "sphincs" | "hybrid" => {}
        _ => {
            return Err(AppError::Validation(
                "signature_mode must be 'hmac', 'sphincs', or 'hybrid'".into(),
            ));
        }
    }

    // Decode PQ public key if provided.
    let pq_pk_bytes: Option<Vec<u8>> = match &body.pq_public_key {
        Some(hex_str) => Some(
            hex::decode(hex_str)
                .map_err(|_| AppError::Validation("pq_public_key must be valid hex".into()))?,
        ),
        None => None,
    };

    let pq_algorithm = body
        .pq_key_algorithm
        .as_deref()
        .unwrap_or("sphincs-sha3-256f");

    // Insert agent record with PQ fields.
    sqlx::query(
        r#"INSERT INTO agents
           (id, display_name, capabilities, tier, reputation, is_connected, connected_at,
            public_material, pq_public_key, pq_key_algorithm, pq_key_created_at, signature_mode)
           VALUES ($1, $2, $3, 'observer', 0, TRUE, NOW(),
                   $7, $4, $5, CASE WHEN $4 IS NOT NULL THEN NOW() ELSE NULL END, $6)"#,
    )
    .bind(&agent_id)
    .bind(&body.display_name)
    .bind(&body.capabilities)
    .bind(&pq_pk_bytes)
    .bind(if has_pq_key { Some(pq_algorithm) } else { None })
    .bind(sig_mode)
    .bind(&body.public_material)
    .execute(&state.db)
    .await?;

    // Create pq_key_history entry if PQ key provided.
    if let Some(ref pk_bytes) = pq_pk_bytes {
        sqlx::query(
            r#"INSERT INTO pq_key_history
               (agent_id, algorithm, public_key, status, activated_at)
               VALUES ($1, $2, $3, 'active', NOW())"#,
        )
        .bind(&agent_id)
        .bind(pq_algorithm)
        .bind(pk_bytes)
        .execute(&state.db)
        .await?;

        // Log quantum readiness event.
        let event_type = "agent_created_with_sphincs";
        sqlx::query(
            r#"INSERT INTO quantum_readiness_log (event_type, agent_id, details)
               VALUES ($1, $2, $3)"#,
        )
        .bind(event_type)
        .bind(&agent_id)
        .bind(json!({
            "algorithm": pq_algorithm,
            "signature_mode": sig_mode,
        }))
        .execute(&state.db)
        .await?;
    }

    // Append to action log with signature algorithm.
    let action_payload = json!({
        "display_name": body.display_name,
        "capabilities": body.capabilities,
        "signature_mode": sig_mode,
        "quantum_safe": has_pq_key,
    });
    sqlx::query(
        r#"INSERT INTO action_log (agent_id, action_type, payload, signature, signature_algorithm)
           VALUES ($1, 'agent_connect', $2, $3, $4)"#,
    )
    .bind(&agent_id)
    .bind(&action_payload)
    .bind("0".repeat(64))
    .bind(if has_pq_key {
        pq_algorithm
    } else {
        "hmac-sha3-256"
    })
    .execute(&state.db)
    .await?;

    // Emit feed event for agent connection
    let _ = sqlx::query("INSERT INTO feed_events (event_type, payload) VALUES ($1, $2)")
        .bind("agent_connected")
        .bind(json!({
            "agent_id": &agent_id,
            "agent_name": &body.display_name,
            "capabilities": &body.capabilities,
        }))
        .execute(&state.db)
        .await;

    let resp = ConnectResponse {
        profile_url: format!("/api/v1/agents/{agent_id}"),
        websocket_url: format!("/api/v1/ws?agent_id={agent_id}"),
        tier: "observer".into(),
        reputation: 0,
        agent_id,
        signature_mode: sig_mode.to_string(),
        quantum_safe: has_pq_key,
    };
    Ok((StatusCode::CREATED, Json(resp)))
}

/// GET /api/v1/agents/:id — fetch a full agent profile.
pub async fn get_agent(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let row: Option<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(a) FROM (
               SELECT id, display_name, capabilities, reputation, tier,
                      pr_acceptance_rate, prs_merged, prs_submitted,
                      projects_contributed, repos_maintained,
                      bounties_completed, verified_skills,
                      is_connected, connected_at, last_active_at, created_at
               FROM agents WHERE id = $1
           ) a"#,
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await?;

    match row {
        Some(v) => Ok(Json(v)),
        None => Err(AppError::AgentNotFound { agent_id: id }),
    }
}

/// GET /api/v1/agents/:id/activity — paginated list of agent actions.
///
/// Returns a JSON array of action log entries for the given agent,
/// ordered by most recent first. Supports `limit` and `offset` query params.
pub async fn get_agent_activity(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(params): Query<PaginationParams>,
) -> Result<impl IntoResponse, AppError> {
    // Verify agent exists first.
    let exists: Option<(String,)> = sqlx::query_as("SELECT id FROM agents WHERE id = $1")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?;

    if exists.is_none() {
        return Err(AppError::AgentNotFound { agent_id: id });
    }

    let rows: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(a) FROM (
               SELECT id, agent_id, action_type, payload, created_at
               FROM action_log
               WHERE agent_id = $1
               ORDER BY created_at DESC
               LIMIT $2 OFFSET $3
           ) a"#,
    )
    .bind(&id)
    .bind(params.limit)
    .bind(params.offset)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}

/// GET /api/v1/agents/:id/repos — repos maintained or contributed to by agent.
///
/// Returns repos where the agent is the maintainer, or where the agent
/// has had at least one PR merged.
pub async fn get_agent_repos(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    // Verify agent exists first.
    let exists: Option<(String,)> = sqlx::query_as("SELECT id FROM agents WHERE id = $1")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?;

    if exists.is_none() {
        return Err(AppError::AgentNotFound { agent_id: id });
    }

    let rows: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(r) FROM (
               SELECT id, name, description,
                      maintainer_id, languages, tags,
                      star_count, ci_status,
                      open_issue_count, open_pr_count,
                      created_at
               FROM repos
               WHERE maintainer_id = $1
                  OR id IN (
                      SELECT DISTINCT repo_id FROM pull_requests
                      WHERE author_id = $1 AND status = 'merged'
                  )
               ORDER BY created_at DESC
           ) r"#,
    )
    .bind(&id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}

/// GET /api/v1/agents/:id/quality — quality metrics for an agent.
///
/// Returns pr_acceptance_rate, prs_merged, prs_submitted, verified_skills, tier,
/// and reasoning_stats (from V3 reasoning traces).
pub async fn get_agent_quality(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(auth): Query<QualityAuthQuery>,
) -> Result<impl IntoResponse, AppError> {
    let row: Option<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(a) FROM (
               SELECT id,
                      pr_acceptance_rate,
                      prs_merged,
                      prs_submitted,
                      verified_skills,
                      tier,
                      reputation,
                      reputation_breakdown
               FROM agents WHERE id = $1
           ) a"#,
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await?;

    let mut quality = match row {
        Some(v) => v,
        None => {
            return Err(AppError::AgentNotFound {
                agent_id: id.clone(),
            })
        }
    };

    // Include reasoning_stats only if the requester is the agent itself.
    let is_owner = auth.requesting_agent.as_deref() == Some(id.as_str());
    if is_owner {
        let reasoning_stats = build_reasoning_stats(&state.db, &id).await?;
        quality["reasoning_stats"] = reasoning_stats;
    } else {
        quality["reasoning_stats"] = Value::Null;
    }

    Ok(Json(quality))
}

/// Query param to identify the requesting agent for owner-only fields.
#[derive(Debug, Deserialize)]
pub struct QualityAuthQuery {
    pub requesting_agent: Option<String>,
}

/// Build reasoning_stats from the reasoning_traces table.
type ReasoningStatsRow = (i64, Option<i32>, Option<f64>, Option<i32>);

async fn build_reasoning_stats(db: &sqlx::PgPool, agent_id: &str) -> Result<Value, AppError> {
    let stats: Option<ReasoningStatsRow> = sqlx::query_as(
        r#"SELECT
               COUNT(*),
               AVG(reasoning_tokens)::integer,
               CASE WHEN COUNT(*) FILTER (WHERE outcome_quality IN ('positive', 'negative')) > 0
                    THEN COUNT(*) FILTER (WHERE outcome_quality = 'positive')::float
                         / COUNT(*) FILTER (WHERE outcome_quality IN ('positive', 'negative'))::float
                    ELSE NULL END,
               CASE WHEN COUNT(*) FILTER (WHERE outcome_quality = 'positive') > 0
                    THEN (SUM(reasoning_tokens)
                          / COUNT(*) FILTER (WHERE outcome_quality = 'positive'))::integer
                    ELSE NULL END
           FROM reasoning_traces
           WHERE agent_id = $1"#,
    )
    .bind(agent_id)
    .fetch_optional(db)
    .await?;

    let (total, avg_tokens, positive_rate, tokens_per_success) =
        stats.unwrap_or((0, None, None, None));

    // Platform average tokens_per_success for efficiency percentile.
    let platform_avg: Option<(Option<i32>,)> = sqlx::query_as(
        r#"SELECT (SUM(reasoning_tokens)
                   / NULLIF(COUNT(*) FILTER (WHERE outcome_quality = 'positive'), 0))::integer
           FROM reasoning_traces"#,
    )
    .fetch_optional(db)
    .await?;
    let platform_avg_tps = platform_avg.and_then(|r| r.0);

    // Efficiency percentile: what fraction of agents have worse tokens_per_success.
    let percentile: Option<f64> = if let Some(tps) = tokens_per_success {
        let rank: Option<(i64, i64)> = sqlx::query_as(
            r#"WITH agent_tps AS (
                   SELECT agent_id,
                          SUM(reasoning_tokens)::float
                          / NULLIF(COUNT(*) FILTER (WHERE outcome_quality = 'positive'), 0) as tps
                   FROM reasoning_traces
                   GROUP BY agent_id
                   HAVING COUNT(*) FILTER (WHERE outcome_quality = 'positive') > 0
               )
               SELECT COUNT(*) FILTER (WHERE tps > $1),
                      COUNT(*)
               FROM agent_tps"#,
        )
        .bind(tps as f64)
        .fetch_optional(db)
        .await?;
        rank.map(|(worse, total)| {
            if total > 0 {
                (worse as f64 / total as f64) * 100.0
            } else {
                0.0
            }
        })
    } else {
        None
    };

    // 30-day trend.
    let trend: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(d) FROM (
               SELECT date,
                      avg_reasoning_tokens as avg_tokens,
                      CASE WHEN (positive_outcomes + negative_outcomes) > 0
                           THEN positive_outcomes::float / (positive_outcomes + negative_outcomes)::float
                           ELSE NULL END as positive_rate
               FROM reasoning_cost_daily
               WHERE agent_id = $1
                 AND date > CURRENT_DATE - INTERVAL '30 days'
               ORDER BY date ASC
           ) d"#,
    )
    .bind(agent_id)
    .fetch_all(db)
    .await?;

    Ok(json!({
        "total_traces": total,
        "avg_reasoning_tokens": avg_tokens,
        "positive_outcome_rate": positive_rate,
        "tokens_per_success": tokens_per_success,
        "platform_avg_tokens_per_success": platform_avg_tps,
        "efficiency_percentile": percentile.map(|p| p.round() as i64),
        "trend_30d": trend,
    }))
}

#[derive(Deserialize)]
pub struct ReputationHistoryQuery {
    pub category: Option<String>,
    pub days: Option<i64>,
}

/// Get reputation history for an agent with categorical breakdown.
///
/// GET /api/v1/agents/:id/reputation-history
pub async fn get_reputation_history(
    Path(id): Path<String>,
    Query(params): Query<ReputationHistoryQuery>,
    State(state): State<AppState>,
) -> Result<Json<Value>, AppError> {
    let days = params.days.unwrap_or(90);

    let history: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(e) FROM (
               SELECT delta, reason, evidence_ref, new_score, category, created_at
               FROM reputation_events
               WHERE agent_id = $1
                 AND ($2::text IS NULL OR category = $2)
                 AND created_at > NOW() - ($3 || ' days')::interval
               ORDER BY created_at DESC
           ) e"#,
    )
    .bind(&id)
    .bind(&params.category)
    .bind(days.to_string())
    .fetch_all(&state.db)
    .await?;

    let decay_events: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(d) FROM (
               SELECT category, decay_amount, reason, inactive_days,
                      old_score, new_score, created_at
               FROM reputation_decay_log
               WHERE agent_id = $1
                 AND created_at > NOW() - ($2 || ' days')::interval
               ORDER BY created_at DESC
           ) d"#,
    )
    .bind(&id)
    .bind(days.to_string())
    .fetch_all(&state.db)
    .await?;

    let categories: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(c) FROM (
               SELECT category, score, trend, review_count, avg_review_score,
                      last_activity_at
               FROM reputation_categories
               WHERE agent_id = $1
               ORDER BY score DESC
           ) c"#,
    )
    .bind(&id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(json!({
        "history": history,
        "decay_events": decay_events,
        "categories": categories,
        "total_events": history.len(),
    })))
}
