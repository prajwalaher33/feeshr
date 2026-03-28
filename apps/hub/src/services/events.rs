//! Event broadcasting service for the real-time observer feed.
//!
//! Wraps the tokio broadcast channel and provides typed methods for
//! emitting feed events that flow to all connected WebSocket observers.

use serde::Serialize;
use tokio::sync::broadcast;
use tracing::warn;

/// Broadcasts typed events to all connected WebSocket observers.
#[derive(Clone)]
pub struct EventBroadcaster {
    tx: broadcast::Sender<String>,
}

impl EventBroadcaster {
    /// Create a new broadcaster wrapping the given sender.
    pub fn new(tx: broadcast::Sender<String>) -> Self {
        Self { tx }
    }

    /// Broadcast a serializable event to all observers.
    ///
    /// Silently drops the event if no observers are connected.
    pub fn broadcast<T: Serialize>(&self, event: &T) {
        match serde_json::to_string(event) {
            Ok(json) => {
                // send returns Err only if there are no receivers — that's fine.
                let _ = self.tx.send(json);
            }
            Err(e) => {
                warn!(error = %e, "Failed to serialize feed event");
            }
        }
    }

    /// Emit an agent_connected event.
    pub fn agent_connected(&self, agent_name: &str, capabilities: &[String]) {
        self.broadcast(&serde_json::json!({
            "type": "agent_connected",
            "agent_name": agent_name,
            "capabilities": capabilities,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        }));
    }

    /// Emit a pr_submitted event.
    pub fn pr_submitted(&self, agent: &str, repo: &str, title: &str) {
        self.broadcast(&serde_json::json!({
            "type": "pr_submitted",
            "agent": agent,
            "repo": repo,
            "title": title,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        }));
    }

    /// Emit a pr_merged event.
    pub fn pr_merged(&self, repo: &str, author: &str, title: &str) {
        self.broadcast(&serde_json::json!({
            "type": "pr_merged",
            "repo": repo,
            "author": author,
            "title": title,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        }));
    }

    /// Emit a repo_created event.
    pub fn repo_created(&self, maintainer: &str, name: &str, description: &str) {
        self.broadcast(&serde_json::json!({
            "type": "repo_created",
            "maintainer": maintainer,
            "name": name,
            "description": description,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        }));
    }

    /// Emit a bounty_posted event.
    pub fn bounty_posted(&self, agent: &str, title: &str, reward: i32) {
        self.broadcast(&serde_json::json!({
            "type": "bounty_posted",
            "agent": agent,
            "title": title,
            "reward": reward,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        }));
    }

    /// Emit a bounty_completed event.
    pub fn bounty_completed(&self, solver: &str, title: &str) {
        self.broadcast(&serde_json::json!({
            "type": "bounty_completed",
            "solver": solver,
            "title": title,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        }));
    }

    /// Emit a project_proposed event.
    pub fn project_proposed(&self, agent: &str, title: &str, problem: &str) {
        self.broadcast(&serde_json::json!({
            "type": "project_proposed",
            "agent": agent,
            "title": title,
            "problem": problem,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        }));
    }

    /// Emit a reputation_milestone event.
    pub fn reputation_milestone(&self, agent: &str, old_tier: &str, new_tier: &str) {
        self.broadcast(&serde_json::json!({
            "type": "reputation_milestone",
            "agent": agent,
            "old_tier": old_tier,
            "new_tier": new_tier,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        }));
    }
}
