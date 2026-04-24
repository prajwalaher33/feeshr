//! Desktop session streaming endpoints for the agent virtual computer view.
//!
//! Provides:
//!   - GET  /api/v1/agents/:id/desktop/sessions — list sessions for an agent
//!   - GET  /api/v1/agents/:id/desktop/session  — get active session events
//!   - GET  /api/v1/agents/:id/desktop/ws       — per-agent desktop WebSocket
//!   - POST /api/v1/desktop/events               — agents publish desktop events
//!
//! Desktop events are sanitized before being sent to observers.
//! The WebSocket broadcasts only events for the requested agent.

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    response::IntoResponse,
    Json,
};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use crate::errors::AppError;
use crate::services::sanitizer;
use crate::AppState;

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct SessionListQuery {
    pub limit: Option<i64>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SessionSummary {
    pub id: String,
    pub agent_id: String,
    pub status: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub event_count: i64,
}

#[derive(Debug, Deserialize)]
pub struct SessionEventsQuery {
    pub limit: Option<i64>,
    pub since: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DesktopEventResponse {
    pub id: String,
    pub session_id: String,
    pub agent_id: String,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct PublishDesktopEvent {
    pub session_id: String,
    pub agent_id: String,
    pub event_type: String,
    pub payload: serde_json::Value,
    /// Optional work item linkage (set on session_start events).
    pub work_item_id: Option<String>,
    pub work_item_type: Option<String>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

type SessionSummaryRow = (
    String,
    String,
    String,
    chrono::DateTime<chrono::Utc>,
    Option<chrono::DateTime<chrono::Utc>>,
    i64,
);

/// GET /api/v1/agents/:id/desktop/sessions — list desktop sessions for an agent.
pub async fn list_sessions(
    State(state): State<AppState>,
    Path(agent_id): Path<String>,
    Query(params): Query<SessionListQuery>,
) -> Result<Json<Vec<SessionSummary>>, AppError> {
    let limit = params.limit.unwrap_or(10).min(50);

    let rows: Vec<SessionSummaryRow> = if let Some(ref status) = params.status {
        sqlx::query_as(
                "SELECT s.id::text, s.agent_id::text, s.status, s.started_at, s.ended_at, \
                     COALESCE((SELECT count(*) FROM desktop_events e WHERE e.session_id = s.id), 0) \
                 FROM desktop_sessions s \
                 WHERE s.agent_id = $1::uuid AND s.status = $2 \
                 ORDER BY s.started_at DESC LIMIT $3",
            )
            .bind(&agent_id)
            .bind(status)
            .bind(limit)
            .fetch_all(&state.db)
            .await?
    } else {
        sqlx::query_as(
                "SELECT s.id::text, s.agent_id::text, s.status, s.started_at, s.ended_at, \
                     COALESCE((SELECT count(*) FROM desktop_events e WHERE e.session_id = s.id), 0) \
                 FROM desktop_sessions s \
                 WHERE s.agent_id = $1::uuid \
                 ORDER BY s.started_at DESC LIMIT $2",
            )
            .bind(&agent_id)
            .bind(limit)
            .fetch_all(&state.db)
            .await?
    };

    let sessions: Vec<SessionSummary> = rows
        .into_iter()
        .map(
            |(id, agent_id, status, started_at, ended_at, event_count)| SessionSummary {
                id,
                agent_id,
                status,
                started_at: started_at.to_rfc3339(),
                ended_at: ended_at.map(|t| t.to_rfc3339()),
                event_count,
            },
        )
        .collect();

    Ok(Json(sessions))
}

/// GET /api/v1/agents/:id/desktop/session — get active session events (REST fallback).
pub async fn get_active_session_events(
    State(state): State<AppState>,
    Path(agent_id): Path<String>,
    Query(params): Query<SessionEventsQuery>,
) -> Result<Json<Vec<DesktopEventResponse>>, AppError> {
    let limit = params.limit.unwrap_or(50).min(200);

    let rows: Vec<(
        String,
        String,
        String,
        String,
        serde_json::Value,
        chrono::DateTime<chrono::Utc>,
    )> = if let Some(ref since) = params.since {
        let since_dt = chrono::DateTime::parse_from_rfc3339(since)
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .map_err(|_| AppError::Validation("Invalid 'since' timestamp".into()))?;
        sqlx::query_as(
                "SELECT e.id::text, e.session_id::text, e.agent_id::text, e.event_type, e.payload, e.created_at \
                 FROM desktop_events e \
                 JOIN desktop_sessions s ON s.id = e.session_id \
                 WHERE e.agent_id = $1::uuid AND s.status = 'active' AND e.created_at >= $2 \
                 ORDER BY e.created_at ASC LIMIT $3",
            )
            .bind(&agent_id)
            .bind(since_dt)
            .bind(limit)
            .fetch_all(&state.db)
            .await?
    } else {
        sqlx::query_as(
                "SELECT e.id::text, e.session_id::text, e.agent_id::text, e.event_type, e.payload, e.created_at \
                 FROM desktop_events e \
                 JOIN desktop_sessions s ON s.id = e.session_id \
                 WHERE e.agent_id = $1::uuid AND s.status = 'active' \
                 ORDER BY e.created_at ASC LIMIT $2",
            )
            .bind(&agent_id)
            .bind(limit)
            .fetch_all(&state.db)
            .await?
    };

    let events: Vec<DesktopEventResponse> = rows
        .into_iter()
        .map(
            |(id, session_id, agent_id, event_type, mut payload, created_at)| {
                sanitizer::sanitize_value(&mut payload);
                DesktopEventResponse {
                    id,
                    session_id,
                    agent_id,
                    event_type,
                    payload,
                    created_at: created_at.to_rfc3339(),
                }
            },
        )
        .collect();

    Ok(Json(events))
}

/// POST /api/v1/desktop/events — agents publish desktop events.
///
/// The event is persisted and broadcast to all observers watching this agent.
/// If event_type is "session_start" and work_item_id/work_item_type are provided,
/// the session is linked to that work item for traceability.
pub async fn publish_event(
    State(state): State<AppState>,
    Json(body): Json<PublishDesktopEvent>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Link session to work item if provided (typically on session_start)
    if body.event_type == "session_start" {
        if let (Some(ref item_id), Some(ref item_type)) = (&body.work_item_id, &body.work_item_type)
        {
            let valid_types = ["issue", "subtask", "bounty", "project"];
            if valid_types.contains(&item_type.as_str()) {
                let _ = sqlx::query(
                    "UPDATE desktop_sessions SET work_item_id = $1::uuid, work_item_type = $2 WHERE id = $3::uuid",
                )
                .bind(item_id)
                .bind(item_type)
                .bind(&body.session_id)
                .execute(&state.db)
                .await;
            }
        }
    }

    // Persist the event
    let row: (String, chrono::DateTime<chrono::Utc>) = sqlx::query_as(
        "INSERT INTO desktop_events (session_id, agent_id, event_type, payload) \
         VALUES ($1::uuid, $2::uuid, $3, $4) \
         RETURNING id::text, created_at",
    )
    .bind(&body.session_id)
    .bind(&body.agent_id)
    .bind(&body.event_type)
    .bind(&body.payload)
    .fetch_one(&state.db)
    .await?;

    // Build the broadcast payload
    let broadcast = serde_json::json!({
        "channel": "desktop",
        "agent_id": body.agent_id,
        "session_id": body.session_id,
        "event_type": body.event_type,
        "payload": body.payload,
        "created_at": row.1.to_rfc3339(),
    });

    // Broadcast via the existing event channel — desktop events get "channel":"desktop"
    // so the frontend can filter them.
    if let Ok(json_str) = serde_json::to_string(&broadcast) {
        // Sanitize before broadcast
        if let Some(sanitized) = sanitizer::sanitize_json(&json_str) {
            let _ = state.event_tx.send(sanitized);
        }
    }

    Ok(Json(serde_json::json!({
        "id": row.0,
        "created_at": row.1.to_rfc3339(),
    })))
}

/// GET /api/v1/agents/:id/desktop/ws — per-agent desktop WebSocket.
///
/// Observers subscribe to a specific agent's desktop events in real time.
/// Like the global feed WS, this is read-only; incoming messages are discarded.
pub async fn desktop_ws_handler(
    upgrade: WebSocketUpgrade,
    Path(agent_id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    upgrade.on_upgrade(move |socket| handle_desktop_socket(socket, state, agent_id))
}

/// Handle a per-agent desktop WebSocket connection.
async fn handle_desktop_socket(socket: WebSocket, state: AppState, agent_id: String) {
    info!(agent_id = %agent_id, "Desktop observer connected");

    let (mut sender, mut receiver) = socket.split();
    let mut event_rx = state.event_tx.subscribe();

    // Send welcome message
    let welcome = serde_json::json!({
        "type": "desktop_connected",
        "agent_id": agent_id,
        "message": "Connected to agent desktop stream.",
    });
    if let Ok(text) = serde_json::to_string(&welcome) {
        if sender.send(Message::Text(text)).await.is_err() {
            return;
        }
    }

    // Drain incoming messages — observers are read-only.
    let read_task = tokio::spawn(async move {
        while let Some(msg) = receiver.next().await {
            match msg {
                Ok(Message::Close(_)) | Err(_) => break,
                Ok(_) => {} // silently discard
            }
        }
    });

    // Forward only events for this agent's desktop channel.
    let target_agent = agent_id.clone();
    let write_task = tokio::spawn(async move {
        while let Ok(raw) = event_rx.recv().await {
            // Parse and check if this is a desktop event for our agent
            let parsed: Result<serde_json::Value, _> = serde_json::from_str(&raw);
            let should_send = match &parsed {
                Ok(val) => {
                    val.get("channel").and_then(|c| c.as_str()) == Some("desktop")
                        && val.get("agent_id").and_then(|a| a.as_str()) == Some(&target_agent)
                }
                Err(_) => false,
            };
            if !should_send {
                continue;
            }

            // Already sanitized at publish time, but defense-in-depth
            let sanitized = match sanitizer::sanitize_json(&raw) {
                Some(s) => s,
                None => {
                    warn!("Failed to sanitize desktop event, dropping");
                    continue;
                }
            };
            if sender.send(Message::Text(sanitized)).await.is_err() {
                break;
            }
        }
    });

    tokio::select! {
        _ = read_task => {},
        _ = write_task => {},
    }

    info!(agent_id = %agent_id, "Desktop observer disconnected");
}
