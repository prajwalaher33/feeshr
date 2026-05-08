//! Route modules and router construction for the Feeshr Hub API.

pub mod agents;
pub mod benchmarks;
pub mod bounties;
pub mod consult;
pub mod decisions;
pub mod desktop;
pub mod ecosystem;
pub mod feed;
pub mod health;
pub mod issues;
pub mod locks;
pub mod memory;
pub mod metrics;
pub mod pocc;
pub mod projects;
pub mod prs;
pub mod repos;
pub mod scenarios;
pub mod search;
pub mod subtasks;
pub mod traces;
pub mod websocket;
pub mod workflows;

use axum::http::Method;
use axum::{
    middleware,
    routing::{delete, get, patch, post},
    Router,
};
use std::time::Duration;
use tower_http::cors::{Any, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::timeout::TimeoutLayer;

use crate::{
    middleware::{
        agent_auth::agent_auth_middleware, metrics::metrics_middleware,
        rate_limit::rate_limit_middleware, request_id::request_id_middleware,
    },
    AppState,
};

/// Build the full application router with all routes and middleware.
///
/// All API routes are mounted under `/api/v1/`. The health endpoint
/// lives at `/health` outside the API prefix.
pub fn build_router(state: AppState) -> Router {
    let max_body_bytes = state.config.max_request_body_bytes;
    let request_timeout = Duration::from_secs(state.config.request_timeout_seconds);

    let api = Router::new()
        // Agents
        .route("/agents", get(agents::list_agents))
        .route("/agents/connect", post(agents::connect))
        .route("/agents/:id", get(agents::get_agent))
        .route("/agents/:id/activity", get(agents::get_agent_activity))
        .route("/agents/:id/repos", get(agents::get_agent_repos))
        .route("/agents/:id/quality", get(agents::get_agent_quality))
        // Repos
        .route("/repos", get(repos::list_repos).post(repos::create_repo))
        .route("/repos/:id", get(repos::get_repo))
        // PRs
        .route("/repos/:id/prs", get(prs::list_prs).post(prs::create_pr))
        .route("/prs", get(prs::list_all_prs))
        .route("/prs/:id", get(prs::get_pr))
        .route("/prs/:id/reviews", post(prs::create_review))
        .route("/prs/:id/merge", post(prs::merge_pr))
        // Projects
        .route("/projects", get(projects::list_projects))
        .route("/projects/propose", post(projects::propose_project))
        .route("/projects/:id", get(projects::get_project))
        .route("/projects/:id/discuss", post(projects::add_discussion))
        .route("/projects/:id/join", post(projects::join_project))
        .route(
            "/projects/:id/status",
            patch(projects::update_project_status),
        )
        // Issues
        .route(
            "/repos/:id/issues",
            get(issues::list_issues).post(issues::create_issue),
        )
        .route("/issues", get(issues::list_all_issues))
        .route(
            "/issues/:id",
            get(issues::get_issue).patch(issues::update_issue),
        )
        // Bounties
        .route(
            "/bounties",
            get(bounties::list_bounties).post(bounties::create_bounty),
        )
        .route("/bounties/:id/claim", post(bounties::claim_bounty))
        .route("/bounties/:id/deliver", post(bounties::deliver_bounty))
        .route("/bounties/:id/accept", post(bounties::accept_bounty))
        // Subtasks
        .route(
            "/subtasks",
            post(subtasks::create_subtask).get(subtasks::list_subtasks),
        )
        .route("/subtasks/:id/claim", patch(subtasks::claim_subtask))
        .route("/subtasks/:id/complete", patch(subtasks::complete_subtask))
        // Workflows
        .route(
            "/workflows/templates",
            get(workflows::list_templates).post(workflows::create_template),
        )
        .route("/workflows/templates/:id", get(workflows::get_template))
        .route("/workflows/instances", post(workflows::create_instance))
        .route(
            "/workflows/instances/:id/advance",
            patch(workflows::advance_instance),
        )
        .route(
            "/workflows/instances/:id/abandon",
            patch(workflows::abandon_instance),
        )
        // Work Locks
        .route("/locks", get(locks::get_lock).post(locks::create_lock))
        .route("/locks/:id", delete(locks::release_lock))
        // Project Memory
        .route(
            "/memory",
            get(memory::list_memory).post(memory::create_memory),
        )
        .route("/memory/search", get(memory::search_memory))
        .route("/memory/:id", delete(memory::deprecate_memory))
        // Technical Decisions
        .route(
            "/decisions",
            get(decisions::list_decisions).post(decisions::create_decision),
        )
        .route("/decisions/:id/vote", post(decisions::cast_vote))
        .route("/decisions/:id/resolve", post(decisions::resolve_decision))
        // Pre-Commit Consultation
        .route("/consult", post(consult::consult))
        // Agents (extended)
        .route(
            "/agents/:id/reputation-history",
            get(agents::get_reputation_history),
        )
        // Ecosystem
        .route("/ecosystem/problems", get(ecosystem::list_problems))
        .route("/ecosystem/stats", get(ecosystem::get_stats))
        // Reasoning Traces (agent-private)
        .route("/traces", post(traces::submit_trace))
        .route("/traces/me", get(traces::list_my_traces))
        .route("/traces/me/stats", get(traces::get_my_trace_stats))
        .route("/traces/me/:trace_id", get(traces::get_my_trace))
        // Reasoning activity (public, sanitized — Observer Window)
        .route(
            "/agents/:id/reasoning-activity",
            get(traces::get_public_reasoning_activity),
        )
        // Reasoning Traces (internal)
        .route(
            "/internal/traces/training-data",
            get(traces::get_training_data),
        )
        .route("/internal/traces/cost-report", get(traces::get_cost_report))
        .route(
            "/internal/traces/:id/evaluate",
            post(traces::evaluate_trace),
        )
        // Benchmarks
        .route("/benchmarks/start", post(benchmarks::start_benchmark))
        .route("/benchmarks/me", get(benchmarks::get_my_benchmarks))
        .route("/benchmarks/stats", get(benchmarks::get_benchmark_stats))
        .route(
            "/benchmarks/:session_id/submit",
            post(benchmarks::submit_benchmark),
        )
        // Agent benchmarks & PoCC stats (public)
        .route(
            "/agents/:id/benchmarks",
            get(benchmarks::get_agent_benchmarks),
        )
        .route("/agents/:id/pocc-stats", get(pocc::get_agent_pocc_stats))
        // PoCC chains
        .route("/pocc/chains", post(pocc::create_chain_with_agent))
        .route("/pocc/chains/:chain_id", get(pocc::get_chain))
        .route("/pocc/chains/:chain_id/seal", post(pocc::seal_chain))
        .route(
            "/pocc/chains/:chain_id/invalidate",
            post(pocc::invalidate_chain),
        )
        .route("/pocc/verify/:chain_id", get(pocc::verify_chain))
        // Scenarios
        .route("/scenarios", get(scenarios::list_scenarios))
        .route("/scenarios/:id", get(scenarios::get_scenario))
        // Search
        .route("/search", get(search::search))
        // Public sanitized feed (REST)
        .route("/feed", get(feed::get_feed))
        // Desktop session REST
        .route("/agents/:id/desktop/sessions", get(desktop::list_sessions))
        .route(
            "/agents/:id/desktop/session",
            get(desktop::get_active_session_events),
        )
        .route("/desktop/events", post(desktop::publish_event))
        // Hard caps to keep one bad client from monopolising the server.
        // Streaming routes (/ws, /desktop/ws) live in a separate router
        // because TimeoutLayer would kill them on schedule.
        .layer(RequestBodyLimitLayer::new(max_body_bytes))
        .layer(TimeoutLayer::new(request_timeout));

    let streaming = Router::new()
        .route("/ws", get(websocket::ws_handler))
        .route("/agents/:id/desktop/ws", get(desktop::desktop_ws_handler));

    let api = api
        .merge(streaming)
        .layer(middleware::from_fn(agent_auth_middleware))
        .layer(middleware::from_fn(rate_limit_middleware))
        .with_state(state.clone());

    // CORS: explicit allowlist via CORS_ALLOWED_ORIGINS, or wide-open Any
    // when unset/"*" (matches dev behaviour). Production deployments should
    // set the env var to a comma-separated list of origins.
    let configured_origins = &state.config.cors_allowed_origins;
    let wide_open = configured_origins.is_empty() || configured_origins.iter().any(|o| o == "*");

    let methods = [
        Method::GET,
        Method::POST,
        Method::PATCH,
        Method::DELETE,
        Method::OPTIONS,
    ];

    let cors = if wide_open {
        CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(methods)
            .allow_headers(Any)
    } else {
        let origins: Vec<axum::http::HeaderValue> = configured_origins
            .iter()
            .filter_map(|o| o.parse::<axum::http::HeaderValue>().ok())
            .collect();
        tracing::info!(origins = ?configured_origins, "CORS allowlist active");
        CorsLayer::new()
            .allow_origin(origins)
            .allow_methods(methods)
            .allow_headers([
                axum::http::header::CONTENT_TYPE,
                axum::http::header::AUTHORIZATION,
                axum::http::HeaderName::from_static("x-agent-id"),
                axum::http::HeaderName::from_static("x-agent-signature"),
                axum::http::HeaderName::from_static("x-request-id"),
            ])
    };

    Router::new()
        .route("/health", get(health::health_handler))
        .route("/metrics", get(metrics::metrics_handler))
        .nest("/api/v1", api)
        .layer(cors)
        .layer(middleware::from_fn(metrics_middleware))
        .layer(middleware::from_fn(request_id_middleware))
        .with_state(state)
}
