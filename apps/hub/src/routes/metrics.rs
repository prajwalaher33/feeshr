//! Prometheus metrics endpoint.
//!
//! GET /metrics — exposes canonical Feeshr metrics in Prometheus exposition format.
//! This is a simple text-based implementation that reads counters from AppState.
//! For production, wire in a proper prometheus client crate.

use axum::{extract::State, response::IntoResponse};
use std::sync::atomic::Ordering;

use crate::AppState;

/// GET /metrics — Prometheus scrape endpoint.
pub async fn metrics_handler(State(state): State<AppState>) -> impl IntoResponse {
    let observers = state.observer_count.load(Ordering::Relaxed);

    // Build Prometheus exposition format
    let mut lines = Vec::new();

    // Global / gateway metrics
    lines.push("# HELP feeshr_ws_connections Current WebSocket observer connections".into());
    lines.push("# TYPE feeshr_ws_connections gauge".into());
    lines.push(format!("feeshr_ws_connections {observers}"));

    lines.push("# HELP feeshr_http_requests_total Total HTTP requests".into());
    lines.push("# TYPE feeshr_http_requests_total counter".into());
    lines.push("feeshr_http_requests_total 0".to_string());

    lines.push("# HELP feeshr_public_feed_events_total Total public feed events emitted".into());
    lines.push("# TYPE feeshr_public_feed_events_total counter".into());
    lines.push("feeshr_public_feed_events_total 0".to_string());

    lines.push("# HELP feeshr_public_feed_lag_seconds Seconds since last feed event".into());
    lines.push("# TYPE feeshr_public_feed_lag_seconds gauge".into());
    lines.push("feeshr_public_feed_lag_seconds 0".to_string());

    lines.push("# HELP feeshr_ws_messages_sent_total Total WS messages sent".into());
    lines.push("# TYPE feeshr_ws_messages_sent_total counter".into());
    lines.push("feeshr_ws_messages_sent_total 0".to_string());

    lines.push("# HELP feeshr_ws_messages_dropped_total Total WS messages dropped".into());
    lines.push("# TYPE feeshr_ws_messages_dropped_total counter".into());
    lines.push("feeshr_ws_messages_dropped_total 0".to_string());

    // Hub metrics
    lines.push("# HELP feeshr_agent_registrations_total Total agent registrations".into());
    lines.push("# TYPE feeshr_agent_registrations_total counter".into());
    lines.push("feeshr_agent_registrations_total 0".to_string());

    lines.push("# HELP feeshr_agent_sessions_active Current active sessions".into());
    lines.push("# TYPE feeshr_agent_sessions_active gauge".into());
    lines.push("feeshr_agent_sessions_active 0".to_string());

    // Coordination metrics
    lines.push("# HELP feeshr_lock_acquire_total Total lock acquire attempts".into());
    lines.push("# TYPE feeshr_lock_acquire_total counter".into());
    lines.push("feeshr_lock_acquire_total 0".to_string());

    lines.push("# HELP feeshr_lock_conflicts_total Total lock conflicts".into());
    lines.push("# TYPE feeshr_lock_conflicts_total counter".into());
    lines.push("feeshr_lock_conflicts_total 0".to_string());

    lines.push("# HELP feeshr_lock_expirations_total Total lock expirations".into());
    lines.push("# TYPE feeshr_lock_expirations_total counter".into());
    lines.push("feeshr_lock_expirations_total 0".to_string());

    lines.push("# HELP feeshr_consultations_total Total consultations".into());
    lines.push("# TYPE feeshr_consultations_total counter".into());
    lines.push("feeshr_consultations_total 0".to_string());

    // SCM/CI metrics
    lines.push("# HELP feeshr_pr_submissions_total Total PR submissions".into());
    lines.push("# TYPE feeshr_pr_submissions_total counter".into());
    lines.push("feeshr_pr_submissions_total 0".to_string());

    lines.push("# HELP feeshr_ci_runs_total Total CI runs".into());
    lines.push("# TYPE feeshr_ci_runs_total counter".into());
    lines.push("feeshr_ci_runs_total 0".to_string());

    lines.push("# HELP feeshr_ci_run_failures_total Total CI run failures".into());
    lines.push("# TYPE feeshr_ci_run_failures_total counter".into());
    lines.push("feeshr_ci_run_failures_total 0".to_string());

    lines.push("# HELP feeshr_ci_sandbox_start_failures_total Sandbox start failures".into());
    lines.push("# TYPE feeshr_ci_sandbox_start_failures_total counter".into());
    lines.push("feeshr_ci_sandbox_start_failures_total 0".to_string());

    // Review & Reputation metrics
    lines.push("# HELP feeshr_reviews_assigned_total Total reviews assigned".into());
    lines.push("# TYPE feeshr_reviews_assigned_total counter".into());
    lines.push("feeshr_reviews_assigned_total 0".to_string());

    lines.push("# HELP feeshr_reviews_submitted_total Total reviews submitted".into());
    lines.push("# TYPE feeshr_reviews_submitted_total counter".into());
    lines.push("feeshr_reviews_submitted_total 0".to_string());

    lines.push("# HELP feeshr_reputation_updates_total Total reputation updates".into());
    lines.push("# TYPE feeshr_reputation_updates_total counter".into());
    lines.push("feeshr_reputation_updates_total 0".to_string());

    lines.push("# HELP feeshr_collusion_flags_total Total collusion flags".into());
    lines.push("# TYPE feeshr_collusion_flags_total counter".into());
    lines.push("feeshr_collusion_flags_total 0".to_string());

    lines.push("# HELP feeshr_reputation_gini Reputation Gini coefficient".into());
    lines.push("# TYPE feeshr_reputation_gini gauge".into());
    lines.push("feeshr_reputation_gini 0".to_string());

    // Observatory metrics
    lines.push("# HELP feeshr_traces_ingested_total Total traces ingested".into());
    lines.push("# TYPE feeshr_traces_ingested_total counter".into());
    lines.push("feeshr_traces_ingested_total 0".to_string());

    lines.push("# HELP feeshr_trace_ingest_failures_total Trace ingest failures".into());
    lines.push("# TYPE feeshr_trace_ingest_failures_total counter".into());
    lines.push("feeshr_trace_ingest_failures_total 0".to_string());

    // Benchmark metrics
    lines.push("# HELP feeshr_benchmark_attempts_total Total benchmark attempts".into());
    lines.push("# TYPE feeshr_benchmark_attempts_total counter".into());
    lines.push("feeshr_benchmark_attempts_total{level=\"1\"} 0".to_string());
    lines.push("feeshr_benchmark_attempts_total{level=\"2\"} 0".to_string());
    lines.push("feeshr_benchmark_attempts_total{level=\"3\"} 0".to_string());

    lines.push("# HELP feeshr_benchmark_passes_total Total benchmark passes".into());
    lines.push("# TYPE feeshr_benchmark_passes_total counter".into());
    lines.push("feeshr_benchmark_passes_total{level=\"1\"} 0".to_string());
    lines.push("feeshr_benchmark_passes_total{level=\"2\"} 0".to_string());
    lines.push("feeshr_benchmark_passes_total{level=\"3\"} 0".to_string());

    lines.push("# HELP feeshr_benchmark_failures_total Total benchmark failures".into());
    lines.push("# TYPE feeshr_benchmark_failures_total counter".into());
    lines.push("feeshr_benchmark_failures_total{level=\"1\"} 0".to_string());
    lines.push("feeshr_benchmark_failures_total{level=\"2\"} 0".to_string());
    lines.push("feeshr_benchmark_failures_total{level=\"3\"} 0".to_string());

    lines.push("# HELP feeshr_benchmark_pass_rate Benchmark pass rate".into());
    lines.push("# TYPE feeshr_benchmark_pass_rate gauge".into());

    lines.push("# HELP feeshr_benchmark_avg_score Average benchmark score".into());
    lines.push("# TYPE feeshr_benchmark_avg_score gauge".into());

    lines.push("# HELP feeshr_benchmark_timeout_total Benchmark timeouts".into());
    lines.push("# TYPE feeshr_benchmark_timeout_total counter".into());
    lines.push("feeshr_benchmark_timeout_total 0".to_string());

    lines.push("# HELP feeshr_benchmark_cooldown_active_total Active cooldowns".into());
    lines.push("# TYPE feeshr_benchmark_cooldown_active_total gauge".into());

    lines.push("# HELP feeshr_benchmark_expiry_total Expired benchmarks".into());
    lines.push("# TYPE feeshr_benchmark_expiry_total counter".into());
    lines.push("feeshr_benchmark_expiry_total 0".to_string());

    lines.push("# HELP feeshr_benchmark_challenge_pool_size Active challenge pool size".into());
    lines.push("# TYPE feeshr_benchmark_challenge_pool_size gauge".into());

    // PoCC metrics
    lines.push("# HELP feeshr_pocc_chains_created_total Total PoCC chains created".into());
    lines.push("# TYPE feeshr_pocc_chains_created_total counter".into());
    lines.push("feeshr_pocc_chains_created_total 0".to_string());

    lines.push("# HELP feeshr_pocc_chains_sealed_total Total PoCC chains sealed".into());
    lines.push("# TYPE feeshr_pocc_chains_sealed_total counter".into());
    lines.push("feeshr_pocc_chains_sealed_total 0".to_string());

    lines.push("# HELP feeshr_pocc_chains_invalid_total Total invalid PoCC chains".into());
    lines.push("# TYPE feeshr_pocc_chains_invalid_total counter".into());
    lines.push("feeshr_pocc_chains_invalid_total 0".to_string());

    lines.push("# HELP feeshr_pocc_steps_total Total PoCC steps".into());
    lines.push("# TYPE feeshr_pocc_steps_total counter".into());
    lines.push("feeshr_pocc_steps_total 0".to_string());

    lines.push(
        "# HELP feeshr_pocc_consistency_failures_total Steps with is_consistent=false".into(),
    );
    lines.push("# TYPE feeshr_pocc_consistency_failures_total counter".into());
    lines.push("feeshr_pocc_consistency_failures_total 0".to_string());

    lines.push("# HELP feeshr_pocc_verification_requests_total Verification requests".into());
    lines.push("# TYPE feeshr_pocc_verification_requests_total counter".into());
    lines.push("feeshr_pocc_verification_requests_total 0".to_string());

    lines.push("# HELP feeshr_pocc_verification_pass_rate Verification pass rate".into());
    lines.push("# TYPE feeshr_pocc_verification_pass_rate gauge".into());

    // Proof of Work Ledger metrics
    lines.push("# HELP feeshr_pow_ledger_entries_total Total ledger entries".into());
    lines.push("# TYPE feeshr_pow_ledger_entries_total counter".into());
    lines.push("feeshr_pow_ledger_entries_total 0".to_string());

    lines.push("# HELP feeshr_pow_ledger_chain_length Total ledger chain length".into());
    lines.push("# TYPE feeshr_pow_ledger_chain_length gauge".into());
    lines.push("feeshr_pow_ledger_chain_length 0".to_string());

    // Histogram placeholders (proper histograms require prometheus crate)
    lines.push("# HELP feeshr_http_request_duration_seconds HTTP request duration".into());
    lines.push("# TYPE feeshr_http_request_duration_seconds histogram".into());

    lines.push("# HELP feeshr_ci_run_duration_seconds CI run duration".into());
    lines.push("# TYPE feeshr_ci_run_duration_seconds histogram".into());

    lines.push("# HELP feeshr_review_turnaround_seconds Review turnaround time".into());
    lines.push("# TYPE feeshr_review_turnaround_seconds histogram".into());

    lines.push("# HELP feeshr_benchmark_completion_seconds Benchmark completion time".into());
    lines.push("# TYPE feeshr_benchmark_completion_seconds histogram".into());

    let body = lines.join("\n") + "\n";

    (
        [(
            axum::http::header::CONTENT_TYPE,
            "text/plain; version=0.0.4; charset=utf-8",
        )],
        body,
    )
}
