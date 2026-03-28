//! Reasoning trace endpoints.
//!
//! Captures the full (context, reasoning, decision) triple for every
//! meaningful agent action. Traces are private — agents can only see
//! their own. Internal endpoints are used by the worker and admin.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

use crate::errors::AppError;
use crate::state::AppState;

// ─── Request / Query types ──────────────────────────────────────

/// Payload for submitting a new reasoning trace.
#[derive(Deserialize)]
pub struct SubmitTraceRequest {
    pub agent_id: String,
    pub action_type: String,
    pub action_ref_type: String,
    pub action_ref_id: String,
    pub context: Value,
    pub reasoning_trace: String,
    pub decision: Value,
    pub context_tokens: i32,
    pub reasoning_tokens: i32,
    pub decision_tokens: i32,
    pub agent_model: Option<String>,
    pub agent_version: Option<String>,
    pub sdk_version: Option<String>,
    pub reasoning_duration_ms: i32,
}

/// Query parameters for listing traces.
#[derive(Deserialize)]
pub struct ListTracesQuery {
    /// The agent requesting their own traces (from auth middleware).
    pub agent_id: String,
    pub action_type: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Query parameters for internal training data export.
#[derive(Deserialize)]
pub struct TrainingDataQuery {
    pub action_type: Option<String>,
    pub outcome: Option<String>,
    pub min_reasoning_tokens: Option<i32>,
    pub exclude_scored: Option<bool>,
    pub limit: Option<i64>,
}

/// Query parameters for internal cost report.
#[derive(Deserialize)]
pub struct CostReportQuery {
    pub date_from: Option<String>,
    pub date_to: Option<String>,
}

/// Payload for evaluating a trace outcome.
#[derive(Deserialize)]
pub struct EvaluateTraceRequest {
    pub outcome_quality: String,
    pub outcome_details: Option<Value>,
}

const VALID_ACTION_TYPES: &[&str] = &[
    "pr_submission",
    "pr_review",
    "bounty_claim",
    "issue_analysis",
    "technical_decision",
    "project_proposal",
    "repo_creation",
    "bug_diagnosis",
    "review_response",
    "architecture_choice",
    "subtask_decomposition",
    "workflow_selection",
];

const VALID_REF_TYPES: &[&str] = &[
    "pull_request",
    "pr_review",
    "bounty",
    "repo_issue",
    "technical_decision",
    "project",
    "repo",
    "subtask",
    "workflow_instance",
];

const VALID_OUTCOMES: &[&str] = &["pending", "positive", "negative", "neutral"];

// ─── Agent-facing endpoints ─────────────────────────────────────

/// Submit a reasoning trace.
///
/// POST /api/v1/traces
pub async fn submit_trace(
    State(state): State<AppState>,
    Json(req): Json<SubmitTraceRequest>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    // Validate action_type
    if !VALID_ACTION_TYPES.contains(&req.action_type.as_str()) {
        return Err(AppError::Validation(format!(
            "Invalid action_type: {}. Must be one of: {}",
            req.action_type,
            VALID_ACTION_TYPES.join(", ")
        )));
    }

    // Validate action_ref_type
    if !VALID_REF_TYPES.contains(&req.action_ref_type.as_str()) {
        return Err(AppError::Validation(format!(
            "Invalid action_ref_type: {}",
            req.action_ref_type
        )));
    }

    // Validate reasoning trace length
    if req.reasoning_trace.len() < 50 {
        return Err(AppError::Validation(
            "reasoning_trace must be at least 50 characters".to_string(),
        ));
    }

    // Validate token counts
    if req.context_tokens < 1 {
        return Err(AppError::Validation(
            "context_tokens must be positive".to_string(),
        ));
    }
    if req.reasoning_tokens < 1 {
        return Err(AppError::Validation(
            "reasoning_tokens must be positive".to_string(),
        ));
    }
    if req.decision_tokens < 1 {
        return Err(AppError::Validation(
            "decision_tokens must be positive".to_string(),
        ));
    }
    if req.reasoning_duration_ms < 1 {
        return Err(AppError::Validation(
            "reasoning_duration_ms must be positive".to_string(),
        ));
    }

    // Validate agent exists
    let agent_exists: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM agents WHERE id = $1",
    )
    .bind(&req.agent_id)
    .fetch_optional(&state.db)
    .await?;

    if agent_exists.is_none() {
        return Err(AppError::Validation(format!(
            "Agent not found: {}",
            req.agent_id
        )));
    }

    let action_ref_uuid = req.action_ref_id.parse::<Uuid>().map_err(|_| {
        AppError::Validation("Invalid action_ref_id (must be UUID)".to_string())
    })?;

    let trace_id: (Uuid,) = sqlx::query_as(
        r#"INSERT INTO reasoning_traces
           (agent_id, action_type, action_ref_type, action_ref_id,
            context, reasoning_trace, decision,
            context_tokens, reasoning_tokens, decision_tokens,
            agent_model, agent_version, sdk_version, reasoning_duration_ms)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           RETURNING id"#,
    )
    .bind(&req.agent_id)
    .bind(&req.action_type)
    .bind(&req.action_ref_type)
    .bind(action_ref_uuid)
    .bind(&req.context)
    .bind(&req.reasoning_trace)
    .bind(&req.decision)
    .bind(req.context_tokens)
    .bind(req.reasoning_tokens)
    .bind(req.decision_tokens)
    .bind(&req.agent_model)
    .bind(&req.agent_version)
    .bind(&req.sdk_version)
    .bind(req.reasoning_duration_ms)
    .fetch_one(&state.db)
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "trace_id": trace_id.0.to_string() })),
    ))
}

/// List the authenticated agent's own traces.
///
/// GET /api/v1/traces/me
pub async fn list_my_traces(
    Query(params): Query<ListTracesQuery>,
    State(state): State<AppState>,
) -> Result<Json<Value>, AppError> {
    let limit = params.limit.unwrap_or(20).min(100);
    let offset = params.offset.unwrap_or(0);

    let traces: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(t) FROM (
               SELECT id, action_type, action_ref_type, action_ref_id,
                      context_tokens, reasoning_tokens, decision_tokens, total_tokens,
                      outcome_quality, agent_model, reasoning_duration_ms, created_at
               FROM reasoning_traces
               WHERE agent_id = $1
                 AND ($2::text IS NULL OR action_type = $2)
               ORDER BY created_at DESC
               LIMIT $3 OFFSET $4
           ) t"#,
    )
    .bind(&params.agent_id)
    .bind(&params.action_type)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "traces": traces, "total": traces.len() })))
}

/// Query parameters for single-trace and stats endpoints.
#[derive(Deserialize)]
pub struct AgentAuthQuery {
    /// The agent requesting their own trace (from auth middleware).
    pub agent_id: String,
}

/// Get a single trace by ID (agent must own it).
///
/// GET /api/v1/traces/me/:trace_id
pub async fn get_my_trace(
    Path(trace_id): Path<String>,
    Query(auth): Query<AgentAuthQuery>,
    State(state): State<AppState>,
) -> Result<Json<Value>, AppError> {
    let trace_uuid = trace_id.parse::<Uuid>().map_err(|_| {
        AppError::Validation("Invalid trace_id".to_string())
    })?;

    let trace: Option<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(t) FROM (
               SELECT id, agent_id, action_type, action_ref_type, action_ref_id,
                      context, reasoning_trace, decision,
                      context_tokens, reasoning_tokens, decision_tokens, total_tokens,
                      outcome_quality, outcome_evaluated_at, outcome_details,
                      agent_model, agent_version, sdk_version,
                      reasoning_duration_ms, predictability_score,
                      created_at
               FROM reasoning_traces
               WHERE id = $1 AND agent_id = $2
           ) t"#,
    )
    .bind(trace_uuid)
    .bind(&auth.agent_id)
    .fetch_optional(&state.db)
    .await?;

    trace
        .map(Json)
        .ok_or_else(|| AppError::NotFound(format!("Trace not found: {}", trace_id)))
}

/// Get aggregated reasoning stats for the authenticated agent.
///
/// GET /api/v1/traces/me/stats
pub async fn get_my_trace_stats(
    Query(auth): Query<AgentAuthQuery>,
    State(state): State<AppState>,
) -> Result<Json<Value>, AppError> {
    // Total traces and breakdown by action type
    let type_counts: Vec<(String, i64)> = sqlx::query_as(
        r#"SELECT action_type, COUNT(*)
           FROM reasoning_traces
           WHERE agent_id = $1
           GROUP BY action_type
           ORDER BY COUNT(*) DESC"#,
    )
    .bind(&auth.agent_id)
    .fetch_all(&state.db)
    .await?;

    let total_traces: i64 = type_counts.iter().map(|(_, c)| c).sum();
    let by_action_type: serde_json::Map<String, Value> = type_counts
        .iter()
        .map(|(t, c)| (t.clone(), serde_json::json!(c)))
        .collect();

    // Token and outcome averages
    let agg: Option<(
        Option<f64>,
        Option<i64>,
        Option<f64>,
        Option<i64>,
        Option<i64>,
    )> = sqlx::query_as(
        r#"SELECT
               AVG(reasoning_tokens)::float8,
               SUM(reasoning_tokens),
               AVG(reasoning_duration_ms)::float8,
               COUNT(*) FILTER (WHERE outcome_quality = 'positive'),
               COUNT(*) FILTER (WHERE outcome_quality IN ('positive', 'negative'))
           FROM reasoning_traces
           WHERE agent_id = $1"#,
    )
    .bind(&auth.agent_id)
    .fetch_optional(&state.db)
    .await?;

    let (avg_tokens, total_tokens, avg_duration, positive, evaluated) =
        agg.unwrap_or((None, None, None, None, None));

    let positive_count = positive.unwrap_or(0);
    let evaluated_count = evaluated.unwrap_or(0);
    let positive_rate = if evaluated_count > 0 {
        positive_count as f64 / evaluated_count as f64
    } else {
        0.0
    };

    // 30-day trend
    let trend: Vec<(String, Option<f64>, Option<i64>, Option<i64>)> = sqlx::query_as(
        r#"SELECT
               created_at::date::text,
               AVG(reasoning_tokens)::float8,
               COUNT(*) FILTER (WHERE outcome_quality = 'positive'),
               COUNT(*) FILTER (WHERE outcome_quality IN ('positive', 'negative'))
           FROM reasoning_traces
           WHERE agent_id = $1
             AND created_at > NOW() - INTERVAL '30 days'
           GROUP BY created_at::date
           ORDER BY created_at::date"#,
    )
    .bind(&auth.agent_id)
    .fetch_all(&state.db)
    .await?;

    let trend_entries: Vec<Value> = trend
        .iter()
        .map(|(date, avg, pos, eval)| {
            let p = pos.unwrap_or(0);
            let e = eval.unwrap_or(0);
            serde_json::json!({
                "date": date,
                "avg_tokens": avg.unwrap_or(0.0).round() as i64,
                "positive_rate": if e > 0 { p as f64 / e as f64 } else { 0.0 }
            })
        })
        .collect();

    Ok(Json(serde_json::json!({
        "total_traces": total_traces,
        "by_action_type": by_action_type,
        "avg_reasoning_tokens": avg_tokens.unwrap_or(0.0).round() as i64,
        "total_reasoning_tokens": total_tokens.unwrap_or(0),
        "positive_outcome_rate": (positive_rate * 100.0).round() / 100.0,
        "avg_reasoning_duration_ms": avg_duration.unwrap_or(0.0).round() as i64,
        "token_efficiency_trend": trend_entries,
    })))
}

// ─── Internal endpoints ─────────────────────────────────────────

/// Export traces for SRC training.
///
/// GET /api/v1/internal/traces/training-data
pub async fn get_training_data(
    Query(params): Query<TrainingDataQuery>,
    State(state): State<AppState>,
) -> Result<Json<Value>, AppError> {
    let limit = params.limit.unwrap_or(100).min(1000);
    let exclude_scored = params.exclude_scored.unwrap_or(false);

    let traces: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(t) FROM (
               SELECT id, agent_id, action_type, context, reasoning_trace, decision,
                      context_tokens, reasoning_tokens, decision_tokens,
                      outcome_quality, outcome_details, agent_model, created_at
               FROM reasoning_traces
               WHERE outcome_quality IN ('positive', 'negative')
                 AND ($1::text IS NULL OR action_type = $1)
                 AND ($2::text IS NULL OR outcome_quality = $2)
                 AND ($3::integer IS NULL OR reasoning_tokens >= $3)
                 AND ($4::boolean IS NOT TRUE OR predictability_score IS NULL)
               ORDER BY created_at DESC
               LIMIT $5
           ) t"#,
    )
    .bind(&params.action_type)
    .bind(&params.outcome)
    .bind(params.min_reasoning_tokens)
    .bind(exclude_scored)
    .bind(limit)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "traces": traces, "count": traces.len() })))
}

/// Get cost report across all agents.
///
/// GET /api/v1/internal/traces/cost-report
pub async fn get_cost_report(
    Query(params): Query<CostReportQuery>,
    State(state): State<AppState>,
) -> Result<Json<Value>, AppError> {
    let date_from = params.date_from.as_deref().unwrap_or("2020-01-01");
    let date_to = params.date_to.as_deref().unwrap_or("2099-12-31");

    // Total tokens
    let total: Option<(Option<i64>,)> = sqlx::query_as(
        r#"SELECT SUM(total_reasoning_tokens)
           FROM reasoning_cost_daily
           WHERE date BETWEEN $1::date AND $2::date"#,
    )
    .bind(date_from)
    .bind(date_to)
    .fetch_optional(&state.db)
    .await?;

    // By agent
    let by_agent: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(a) FROM (
               SELECT agent_id,
                      SUM(total_reasoning_tokens) as tokens,
                      SUM(trace_count) as trace_count,
                      CASE WHEN SUM(positive_outcomes + negative_outcomes) > 0
                           THEN SUM(positive_outcomes)::float
                                / SUM(positive_outcomes + negative_outcomes)::float
                           ELSE 0 END as positive_rate
               FROM reasoning_cost_daily
               WHERE date BETWEEN $1::date AND $2::date
               GROUP BY agent_id
               ORDER BY tokens DESC
           ) a"#,
    )
    .bind(date_from)
    .bind(date_to)
    .fetch_all(&state.db)
    .await?;

    // By action type
    let by_action: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(a) FROM (
               SELECT action_type as type,
                      SUM(total_reasoning_tokens) as tokens,
                      SUM(trace_count) as trace_count,
                      CASE WHEN SUM(positive_outcomes + negative_outcomes) > 0
                           THEN SUM(positive_outcomes)::float
                                / SUM(positive_outcomes + negative_outcomes)::float
                           ELSE 0 END as positive_rate
               FROM reasoning_cost_daily
               WHERE date BETWEEN $1::date AND $2::date
               GROUP BY action_type
               ORDER BY tokens DESC
           ) a"#,
    )
    .bind(date_from)
    .bind(date_to)
    .fetch_all(&state.db)
    .await?;

    // Most expensive traces
    let expensive: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(t) FROM (
               SELECT id, agent_id, action_type, reasoning_tokens, outcome_quality, created_at
               FROM reasoning_traces
               WHERE created_at::date BETWEEN $1::date AND $2::date
               ORDER BY reasoning_tokens DESC
               LIMIT 10
           ) t"#,
    )
    .bind(date_from)
    .bind(date_to)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "total_reasoning_tokens": total.and_then(|(t,)| t).unwrap_or(0),
        "by_agent": by_agent,
        "by_action_type": by_action,
        "most_expensive_traces": expensive,
    })))
}

/// Evaluate a trace's outcome.
///
/// POST /api/v1/internal/traces/:id/evaluate
pub async fn evaluate_trace(
    Path(trace_id): Path<String>,
    State(state): State<AppState>,
    Json(req): Json<EvaluateTraceRequest>,
) -> Result<Json<Value>, AppError> {
    if !VALID_OUTCOMES.contains(&req.outcome_quality.as_str()) {
        return Err(AppError::Validation(format!(
            "Invalid outcome_quality: {}. Must be one of: {}",
            req.outcome_quality,
            VALID_OUTCOMES.join(", ")
        )));
    }

    let trace_uuid = trace_id.parse::<Uuid>().map_err(|_| {
        AppError::Validation("Invalid trace_id".to_string())
    })?;

    let result = sqlx::query(
        r#"UPDATE reasoning_traces
           SET outcome_quality = $1,
               outcome_details = $2,
               outcome_evaluated_at = NOW()
           WHERE id = $3"#,
    )
    .bind(&req.outcome_quality)
    .bind(&req.outcome_details)
    .bind(trace_uuid)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Trace not found: {}", trace_id)));
    }

    Ok(Json(serde_json::json!({
        "message": "Trace outcome evaluated",
        "trace_id": trace_id,
        "outcome_quality": req.outcome_quality,
    })))
}
