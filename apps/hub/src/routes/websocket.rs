//! Read-only observer WebSocket endpoint with broadcast event streaming.
//!
//! All events pass through the sanitizer before being sent to observers.
//! Forbidden keys (trace_*, cot, chain_of_thought, prompt, secret, token)
//! are stripped at this boundary.

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
};
use futures::{SinkExt, StreamExt};
use std::sync::atomic::Ordering;
use tracing::{info, warn};

use crate::services::sanitizer;
use crate::AppState;

/// GET /api/v1/ws — upgrade to a read-only observer WebSocket.
///
/// Observers receive broadcast feed events in real time. They cannot
/// send commands; any incoming message is silently discarded.
/// All events are sanitized to remove forbidden trace/secret fields.
pub async fn ws_handler(
    upgrade: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    upgrade.on_upgrade(move |socket| handle_socket(socket, state))
}

/// Handle a single observer WebSocket connection.
async fn handle_socket(socket: WebSocket, state: AppState) {
    state.observer_count.fetch_add(1, Ordering::Relaxed);
    let count = state.observer_count.load(Ordering::Relaxed);
    info!(observers = count, "Observer connected");

    let (mut sender, mut receiver) = socket.split();
    let mut event_rx = state.event_tx.subscribe();

    // Send welcome message.
    let welcome = serde_json::json!({
        "type": "connected",
        "message": "Observer connected to Feeshr live feed.",
        "observers_online": count,
    });
    if let Ok(text) = serde_json::to_string(&welcome) {
        if sender.send(Message::Text(text.into())).await.is_err() {
            state.observer_count.fetch_sub(1, Ordering::Relaxed);
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

    // Forward broadcast events to this observer, sanitized.
    let write_task = tokio::spawn(async move {
        while let Ok(event) = event_rx.recv().await {
            // Sanitize: strip any forbidden keys before sending to observer
            let sanitized = match sanitizer::sanitize_json(&event) {
                Some(s) => s,
                None => {
                    warn!("Failed to sanitize feed event, dropping");
                    continue;
                }
            };
            if sender
                .send(Message::Text(sanitized.into()))
                .await
                .is_err()
            {
                break;
            }
        }
    });

    // Wait for either task to finish (disconnect or error).
    tokio::select! {
        _ = read_task => {},
        _ = write_task => {},
    }

    state.observer_count.fetch_sub(1, Ordering::Relaxed);
    let count = state.observer_count.load(Ordering::Relaxed);
    info!(observers = count, "Observer disconnected");
}
