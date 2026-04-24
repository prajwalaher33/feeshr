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
    let rows: Vec<(String, serde_json::Value, chrono::DateTime<chrono::Utc>)> =
        if let Some(ref event_type) = params.event_type {
            sqlx::query_as(
                "SELECT event_type, payload, created_at FROM feed_events \
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
                "SELECT event_type, payload, created_at FROM feed_events \
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
                "SELECT event_type, payload, created_at FROM feed_events \
                 ORDER BY created_at DESC LIMIT $1 OFFSET $2",
            )
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.db)
            .await
            .unwrap_or_default()
        };

    // Sanitize every event before returning, inject event_type as "type"
    let events: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|(event_type, mut payload, created_at)| {
            let removed = sanitizer::sanitize_value(&mut payload);
            if removed > 0 {
                warn!(
                    removed_keys = removed,
                    "Sanitizer stripped keys from stored feed event"
                );
            }
            // Inject type and timestamp into payload
            if let Some(obj) = payload.as_object_mut() {
                obj.insert("type".to_string(), serde_json::Value::String(event_type));
                obj.insert(
                    "timestamp".to_string(),
                    serde_json::Value::String(created_at.to_rfc3339()),
                );
            }
            payload
        })
        .collect();

    let cursor = if events.len() == limit as usize {
        Some(format!("{}", offset + limit))
    } else {
        None
    };

    Ok(Json(FeedResponse { events, cursor }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_feed_query_defaults() {
        let q = FeedQuery {
            limit: None,
            offset: None,
            event_type: None,
            since: None,
        };
        assert_eq!(q.limit.unwrap_or(20).min(100), 20);
        assert_eq!(q.offset.unwrap_or(0), 0);
    }

    #[test]
    fn test_feed_query_limit_clamped() {
        let q = FeedQuery {
            limit: Some(999),
            offset: None,
            event_type: None,
            since: None,
        };
        assert_eq!(q.limit.unwrap_or(20).min(100), 100);
    }

    #[test]
    fn test_feed_response_cursor_logic() {
        // When events.len() == limit, cursor should be Some
        let limit: i64 = 20;
        let offset: i64 = 0;
        let events_len = 20;
        let cursor = if events_len == limit as usize {
            Some(format!("{}", offset + limit))
        } else {
            None
        };
        assert_eq!(cursor, Some("20".to_string()));

        // When events.len() < limit, cursor should be None
        let events_len = 15;
        let cursor = if events_len == limit as usize {
            Some(format!("{}", offset + limit))
        } else {
            None
        };
        assert_eq!(cursor, None);
    }

    #[test]
    fn test_sanitization_strips_forbidden_from_stored_events() {
        // Simulates the sanitization step in get_feed
        let mut payload = json!({
            "type": "agent_connected",
            "agent_name": "bot",
            "trace_context": "should be stripped",
            "prompt": "should be stripped"
        });
        let removed = crate::services::sanitizer::sanitize_value(&mut payload);
        assert_eq!(removed, 2);
        assert!(payload.get("trace_context").is_none());
        assert!(payload.get("prompt").is_none());
        assert_eq!(payload["agent_name"], "bot");
    }
}
