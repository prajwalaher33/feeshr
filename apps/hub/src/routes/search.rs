//! Unified search endpoint using PostgreSQL full-text search.

use axum::{
    extract::{Query, State},
    Json,
};
use serde::{Deserialize, Serialize};

use crate::{errors::AppError, AppState};

/// Query parameters for the search endpoint.
#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    /// Search query string.
    pub q: String,
    /// Type filter: repos, agents, projects, or all.
    #[serde(default = "default_search_type")]
    pub r#type: String,
    /// Maximum results to return.
    #[serde(default = "default_limit")]
    pub limit: i64,
    /// Offset for pagination.
    #[serde(default)]
    pub offset: i64,
}

fn default_search_type() -> String {
    "all".to_string()
}

fn default_limit() -> i64 {
    20
}

/// A single search result with type and relevance score.
#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub id: String,
    pub result_type: String,
    pub title: String,
    pub description: String,
    pub score: f32,
}

/// Response from the search endpoint.
#[derive(Debug, Serialize)]
pub struct SearchResponse {
    pub results: Vec<SearchResult>,
    pub total: i64,
    pub query: String,
}

/// GET /api/v1/search — unified search across repos, agents, and projects.
///
/// Uses PostgreSQL `to_tsvector`/`to_tsquery` for full-text search with
/// relevance ranking via `ts_rank`.
pub async fn search(
    State(state): State<AppState>,
    Query(params): Query<SearchQuery>,
) -> Result<Json<SearchResponse>, AppError> {
    let q = params.q.trim();
    if q.is_empty() {
        return Err(AppError::Validation("Search query must not be empty".into()));
    }

    let limit = params.limit.min(100).max(1);
    let ts_query = q
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" & ");

    let mut results = Vec::new();

    if params.r#type == "all" || params.r#type == "repos" {
        let rows = sqlx::query_as::<_, (String, String, String, f32)>(
            "SELECT id::text, name, description,
                    ts_rank(to_tsvector('english', name || ' ' || description), to_tsquery('english', $1)) AS score
             FROM repos
             WHERE to_tsvector('english', name || ' ' || description) @@ to_tsquery('english', $1)
               AND status = 'active'
             ORDER BY score DESC
             LIMIT $2 OFFSET $3"
        )
        .bind(&ts_query)
        .bind(limit)
        .bind(params.offset)
        .fetch_all(&state.db)
        .await?;

        for (id, name, desc, score) in rows {
            results.push(SearchResult {
                id,
                result_type: "repo".into(),
                title: name,
                description: desc,
                score,
            });
        }
    }

    if params.r#type == "all" || params.r#type == "agents" {
        let rows = sqlx::query_as::<_, (String, String)>(
            "SELECT id, display_name FROM agents
             WHERE display_name ILIKE '%' || $1 || '%'
             LIMIT $2 OFFSET $3"
        )
        .bind(q)
        .bind(limit)
        .bind(params.offset)
        .fetch_all(&state.db)
        .await?;

        for (id, name) in rows {
            results.push(SearchResult {
                id,
                result_type: "agent".into(),
                title: name,
                description: String::new(),
                score: 1.0,
            });
        }
    }

    if params.r#type == "all" || params.r#type == "projects" {
        let rows = sqlx::query_as::<_, (String, String, String, f32)>(
            "SELECT id::text, title, description,
                    ts_rank(to_tsvector('english', title || ' ' || description), to_tsquery('english', $1)) AS score
             FROM projects
             WHERE to_tsvector('english', title || ' ' || description) @@ to_tsquery('english', $1)
             ORDER BY score DESC
             LIMIT $2 OFFSET $3"
        )
        .bind(&ts_query)
        .bind(limit)
        .bind(params.offset)
        .fetch_all(&state.db)
        .await?;

        for (id, title, desc, score) in rows {
            results.push(SearchResult {
                id,
                result_type: "project".into(),
                title,
                description: desc,
                score,
            });
        }
    }

    // Sort all results by score descending.
    results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    let total = results.len() as i64;

    Ok(Json(SearchResponse {
        results,
        total,
        query: q.to_string(),
    }))
}
