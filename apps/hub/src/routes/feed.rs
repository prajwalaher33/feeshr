//! Public sanitized feed endpoint (REST).
//!
//! GET /api/v1/feed — paginated, sanitized feed events.
//! This endpoint NEVER returns trace fields, prompts, or secrets.

use axum::{
    extract::{Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use tracing::warn;

use crate::errors::AppError;
use crate::services::sanitizer;
use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct FeedQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub event_type: Option<String>,
    pub since: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct FeedResponse {
    pub events: Vec<serde_json::Value>,
    pub cursor: Option<String>,
}

/// GET /api/v1/feed — paginated public feed with sanitization.
pub async fn get_feed(
    State(state): State<AppState>,
    Query(params): Query<FeedQuery>,
) -> Result<Json<FeedResponse>, AppError> {
    let limit = params.limit.unwrap_or(20).min(100);
    let offset = params.offset.unwrap_or(0);

    // Build query for feed_events table
    let rows: Vec<(serde_json::Value, chrono::DateTime<chrono::Utc>)> =
        if let Some(ref event_type) = params.event_type {
            sqlx::query_as(
                "SELECT payload, created_at FROM feed_events \
                 WHERE event_type = $1 \
                 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
            )
            .bind(event_type)
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.db)
            .await
            .unwrap_or_default()
        } else if let Some(ref since) = params.since {
            let since_dt = chrono::DateTime::parse_from_rfc3339(since)
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .map_err(|_| AppError::Validation("Invalid 'since' timestamp".into()))?;
            sqlx::query_as(
                "SELECT payload, created_at FROM feed_events \
                 WHERE created_at >= $1 \
                 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
            )
            .bind(since_dt)
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.db)
            .await
            .unwrap_or_default()
        } else {
            sqlx::query_as(
                "SELECT payload, created_at FROM feed_events \
                 ORDER BY created_at DESC LIMIT $1 OFFSET $2",
            )
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.db)
            .await
            .unwrap_or_default()
        };

    // Sanitize every event before returning
    let events: Vec<serde_json::Value> = rows
        .into_iter()
        .filter_map(|(mut payload, _)| {
            let removed = sanitizer::sanitize_value(&mut payload);
            if removed > 0 {
                warn!(
                    removed_keys = removed,
                    "Sanitizer stripped keys from stored feed event"
                );
            }
            Some(payload)
        })
        .collect();

    let cursor = if events.len() == limit as usize {
        Some(format!("{}", offset + limit))
    } else {
        None
    };

    Ok(Json(FeedResponse { events, cursor }))
}
