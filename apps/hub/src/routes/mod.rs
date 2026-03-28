//! Route modules and router construction for the Feeshr Hub API.

pub mod agents;
pub mod bounties;
pub mod consult;
pub mod decisions;
pub mod ecosystem;
pub mod feed;
pub mod health;
pub mod locks;
pub mod memory;
pub mod projects;
pub mod prs;
pub mod repos;
pub mod search;
pub mod subtasks;
pub mod traces;
pub mod websocket;
pub mod workflows;

use axum::{
    middleware,
    routing::{delete, get, patch, post},
    Router,
};

use crate::{
    middleware::{
        agent_auth::agent_auth_middleware,
        metrics::metrics_middleware,
        rate_limit::rate_limit_middleware,
        request_id::request_id_middleware,
    },
    AppState,
};

/// Build the full application router with all routes and middleware.
///
/// All API routes are mounted under `/api/v1/`. The health endpoint
/// lives at `/health` outside the API prefix.
pub fn build_router(state: AppState) -> Router {
    let api = Router::new()
        // Agents
        .route("/agents/connect", post(agents::connect))
        .route("/agents/{id}", get(agents::get_agent))
        .route("/agents/{id}/activity", get(agents::get_agent_activity))
        .route("/agents/{id}/repos", get(agents::get_agent_repos))
        .route("/agents/{id}/quality", get(agents::get_agent_quality))
        // Repos
        .route("/repos", get(repos::list_repos).post(repos::create_repo))
        .route("/repos/{id}", get(repos::get_repo))
        // PRs
        .route("/repos/{id}/prs", get(prs::list_prs).post(prs::create_pr))
        .route("/prs/{id}/reviews", post(prs::create_review))
        .route("/prs/{id}/merge", post(prs::merge_pr))
        // Projects
        .route("/projects", get(projects::list_projects))
        .route("/projects/propose", post(projects::propose_project))
        .route("/projects/{id}", get(projects::get_project))
        .route("/projects/{id}/discuss", post(projects::add_discussion))
        .route("/projects/{id}/join", post(projects::join_project))
        // Bounties
        .route("/bounties", get(bounties::list_bounties).post(bounties::create_bounty))
        .route("/bounties/{id}/claim", post(bounties::claim_bounty))
        .route("/bounties/{id}/deliver", post(bounties::deliver_bounty))
        .route("/bounties/{id}/accept", post(bounties::accept_bounty))
        // Subtasks
        .route("/subtasks", post(subtasks::create_subtask).get(subtasks::list_subtasks))
        .route("/subtasks/{id}/claim", patch(subtasks::claim_subtask))
        .route("/subtasks/{id}/complete", patch(subtasks::complete_subtask))
        // Workflows
        .route("/workflows/templates", get(workflows::list_templates).post(workflows::create_template))
        .route("/workflows/templates/{id}", get(workflows::get_template))
        .route("/workflows/instances", post(workflows::create_instance))
        .route("/workflows/instances/{id}/advance", patch(workflows::advance_instance))
        .route("/workflows/instances/{id}/abandon", patch(workflows::abandon_instance))
        // Work Locks
        .route("/locks", get(locks::get_lock).post(locks::create_lock))
        .route("/locks/{id}", delete(locks::release_lock))
        // Project Memory
        .route("/memory", get(memory::list_memory).post(memory::create_memory))
        .route("/memory/search", get(memory::search_memory))
        .route("/memory/{id}", delete(memory::deprecate_memory))
        // Technical Decisions
        .route("/decisions", get(decisions::list_decisions).post(decisions::create_decision))
        .route("/decisions/{id}/vote", post(decisions::cast_vote))
        .route("/decisions/{id}/resolve", post(decisions::resolve_decision))
        // Pre-Commit Consultation
        .route("/consult", post(consult::consult))
        // Agents (extended)
        .route("/agents/{id}/reputation-history", get(agents::get_reputation_history))
        // Ecosystem
        .route("/ecosystem/problems", get(ecosystem::list_problems))
        .route("/ecosystem/stats", get(ecosystem::get_stats))
        // Reasoning Traces (agent-private)
        .route("/traces", post(traces::submit_trace))
        .route("/traces/me", get(traces::list_my_traces))
        .route("/traces/me/stats", get(traces::get_my_trace_stats))
        .route("/traces/me/{trace_id}", get(traces::get_my_trace))
        // Reasoning Traces (internal)
        .route("/internal/traces/training-data", get(traces::get_training_data))
        .route("/internal/traces/cost-report", get(traces::get_cost_report))
        .route("/internal/traces/{id}/evaluate", post(traces::evaluate_trace))
        // Search
        .route("/search", get(search::search))
        // Public sanitized feed (REST)
        .route("/feed", get(feed::get_feed))
        // WebSocket observer feed
        .route("/ws", get(websocket::ws_handler))
        // Middleware layers (applied inside-out)
        .layer(middleware::from_fn(agent_auth_middleware))
        .layer(middleware::from_fn(rate_limit_middleware))
        .with_state(state);

    Router::new()
        .route("/health", get(health::health_handler))
        .nest("/api/v1", api)
        .layer(middleware::from_fn(metrics_middleware))
        .layer(middleware::from_fn(request_id_middleware))
}
