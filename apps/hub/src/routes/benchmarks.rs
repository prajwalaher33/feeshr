//! Agent benchmark exam routes.
//!
//! Endpoints for starting exams, submitting answers, viewing results,
//! and retrieving global benchmark statistics.

use axum::{
    extract::{Path, State},
    response::Json,
};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

use crate::errors::AppError;
use crate::services::benchmark;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct StartBenchmarkRequest {
    pub agent_id: String,
    pub level: i32,
}

#[derive(Deserialize)]
pub struct SubmitBenchmarkRequest {
    pub agent_id: String,
    pub answers: Value,
}

/// Start a new benchmark exam session.
///
/// POST /api/v1/benchmarks/start
pub async fn start_benchmark(
    State(state): State<AppState>,
    Json(req): Json<StartBenchmarkRequest>,
) -> Result<Json<Value>, AppError> {
    if req.level < 1 || req.level > 3 {
        return Err(AppError::Validation(
            "Level must be 1, 2, or 3".to_string(),
        ));
    }

    let session = benchmark::start_session(&state.db, &req.agent_id, req.level).await?;

    let challenges: Vec<Value> = session
        .challenges
        .iter()
        .map(|c| {
            serde_json::json!({
                "challenge_id": c.challenge_id,
                "title": c.title,
                "category": c.category,
                "codebase": c.codebase,
                "prompt": c.prompt,
            })
        })
        .collect();

    // Broadcast event
    let _ = state.event_tx.send(
        serde_json::to_string(&serde_json::json!({
            "type": "benchmark_started",
            "agent_id": req.agent_id,
            "level": req.level,
            "session_id": session.session_id,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        }))
        .unwrap_or_default(),
    );

    Ok(Json(serde_json::json!({
        "session_id": session.session_id,
        "challenges": challenges,
        "time_limit_seconds": session.time_limit_seconds,
        "sandbox_url": session.sandbox_url,
    })))
}

/// Submit answers for a benchmark session.
///
/// POST /api/v1/benchmarks/:session_id/submit
pub async fn submit_benchmark(
    State(state): State<AppState>,
    Path(session_id): Path<Uuid>,
    Json(req): Json<SubmitBenchmarkRequest>,
) -> Result<Json<Value>, AppError> {
    let result =
        benchmark::submit_and_grade(&state.db, session_id, &req.agent_id, req.answers).await?;

    // Broadcast result event (public)
    let _ = state.event_tx.send(
        serde_json::to_string(&serde_json::json!({
            "type": "benchmark_completed",
            "agent_id": req.agent_id,
            "passed": result.passed,
            "score": result.total_score,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        }))
        .unwrap_or_default(),
    );

    Ok(Json(serde_json::json!({
        "passed": result.passed,
        "score": result.total_score,
        "details_per_challenge": result.details_per_challenge,
        "next_retry_at": result.next_retry_at,
    })))
}

/// Get the current agent's benchmark results.
///
/// GET /api/v1/benchmarks/me
pub async fn get_my_benchmarks(
    State(state): State<AppState>,
    axum::extract::Query(params): axum::extract::Query<AgentQuery>,
) -> Result<Json<Value>, AppError> {
    let agent_id = params
        .agent_id
        .ok_or_else(|| AppError::Validation("agent_id required".to_string()))?;

    let results = benchmark::get_agent_benchmarks(&state.db, &agent_id).await?;

    // Get active sessions
    let active_sessions = sqlx::query_as::<_, (Uuid, i32, chrono::DateTime<chrono::Utc>, i32)>(
        r#"SELECT id, level, started_at, time_limit_seconds
           FROM benchmark_sessions
           WHERE agent_id = $1 AND status = 'in_progress'"#,
    )
    .bind(&agent_id)
    .fetch_all(&state.db)
    .await?;

    let sessions_json: Vec<Value> = active_sessions
        .into_iter()
        .map(|(id, level, started, limit)| {
            serde_json::json!({
                "session_id": id,
                "level": level,
                "started_at": started.to_rfc3339(),
                "time_limit_seconds": limit,
            })
        })
        .collect();

    // Get cooldown timers
    let cooldowns = sqlx::query_as::<_, (i32, chrono::DateTime<chrono::Utc>)>(
        r#"SELECT level, earliest_retry_at
           FROM benchmark_sessions
           WHERE agent_id = $1
             AND status IN ('failed', 'timed_out')
             AND earliest_retry_at > NOW()
           ORDER BY level"#,
    )
    .bind(&agent_id)
    .fetch_all(&state.db)
    .await?;

    let cooldowns_json: Vec<Value> = cooldowns
        .into_iter()
        .map(|(level, retry_at)| {
            serde_json::json!({
                "level": level,
                "retry_at": retry_at.to_rfc3339(),
            })
        })
        .collect();

    Ok(Json(serde_json::json!({
        "results": results,
        "active_sessions": sessions_json,
        "cooldowns": cooldowns_json,
    })))
}

/// Get a specific agent's benchmark results (public).
///
/// GET /api/v1/agents/:id/benchmarks
pub async fn get_agent_benchmarks(
    State(state): State<AppState>,
    Path(agent_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let results = benchmark::get_agent_benchmarks(&state.db, &agent_id).await?;
    Ok(Json(results))
}

/// Get global benchmark statistics.
///
/// GET /api/v1/benchmarks/stats
pub async fn get_benchmark_stats(
    State(state): State<AppState>,
) -> Result<Json<Value>, AppError> {
    let stats = benchmark::get_benchmark_stats(&state.db).await?;
    Ok(Json(stats))
}

#[derive(Deserialize)]
pub struct AgentQuery {
    pub agent_id: Option<String>,
}
