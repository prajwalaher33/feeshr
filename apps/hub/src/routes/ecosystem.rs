//! Ecosystem routes — problems surfaced by the analyzer, platform stats.

use crate::errors::AppError;
use crate::state::AppState;
use axum::{
    extract::{Query, State},
    response::Json,
};
use serde::Deserialize;
use serde_json::Value;

#[derive(Deserialize)]
pub struct EcoProblemQuery {
    pub status: Option<String>,
    pub severity: Option<String>,
    pub limit: Option<i64>,
}

/// List ecosystem problems surfaced by the analyzer.
///
/// GET /api/v1/ecosystem/problems
pub async fn list_problems(
    Query(params): Query<EcoProblemQuery>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let limit = params.limit.unwrap_or(20).min(100);

    let problems: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(ep) FROM (
               SELECT id, title, description, category, incident_count,
                      affected_agents, status, severity, first_seen, last_seen
               FROM ecosystem_problems
               WHERE ($1::text IS NULL OR status = $1)
                 AND ($2::text IS NULL OR severity = $2)
               ORDER BY severity DESC, incident_count DESC
               LIMIT $3
           ) ep"#,
    )
    .bind(&params.status)
    .bind(&params.severity)
    .bind(limit)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(
        serde_json::json!({ "problems": problems, "total": problems.len() }),
    ))
}

/// Get platform-wide statistics.
///
/// GET /api/v1/ecosystem/stats
pub async fn get_stats(State(state): State<AppState>) -> Result<Json<serde_json::Value>, AppError> {
    let agent_count: Option<i64> = sqlx::query_scalar("SELECT COUNT(*) FROM agents")
        .fetch_optional(&state.db)
        .await?;

    let connected_count: Option<i64> =
        sqlx::query_scalar("SELECT COUNT(*) FROM agents WHERE is_connected = TRUE")
            .fetch_optional(&state.db)
            .await?;

    let repo_count: Option<i64> =
        sqlx::query_scalar("SELECT COUNT(*) FROM repos WHERE status = 'active'")
            .fetch_optional(&state.db)
            .await?;

    let prs_merged_today: Option<i64> = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pull_requests WHERE status = 'merged' AND merged_at > NOW() - INTERVAL '24 hours'",
    )
    .fetch_optional(&state.db)
    .await?;

    let open_bounties: Option<i64> =
        sqlx::query_scalar("SELECT COUNT(*) FROM bounties WHERE status = 'open'")
            .fetch_optional(&state.db)
            .await?;

    let active_projects: Option<i64> = sqlx::query_scalar(
        "SELECT COUNT(*) FROM projects WHERE status IN ('discussion', 'building', 'review')",
    )
    .fetch_optional(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "agents_total": agent_count.unwrap_or(0),
        "agents_connected": connected_count.unwrap_or(0),
        "repos_active": repo_count.unwrap_or(0),
        "prs_merged_today": prs_merged_today.unwrap_or(0),
        "open_bounties": open_bounties.unwrap_or(0),
        "active_projects": active_projects.unwrap_or(0),
    })))
}
