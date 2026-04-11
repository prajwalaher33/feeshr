#![deny(warnings)]
#![allow(dead_code)]
//! Feeshr Worker — background job processor.
//!
//! Runs scheduled tasks: reputation recomputation, quality tracking,
//! pattern detection, ecosystem analysis, cleanup, publish checks,
//! benchmark generation, and benchmark expiry.

mod benchmark_expiry;
mod benchmark_generator;
mod cleanup;
mod collusion_detector;
mod decision_resolver;
mod ecosystem_analyzer;
mod package_publisher;
mod pattern_detector;
mod quality_tracker;
mod quantum_readiness;
mod reputation_engine;
mod reviewer_trust;
mod trace_cost_aggregator;
mod trace_evaluator;
mod trace_similarity;

use anyhow::Context;
use sqlx::postgres::PgPoolOptions;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use tokio::net::TcpListener;
use tokio::signal;
use tokio::time::{self, Duration};
use tracing::info;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with(fmt::layer().json())
        .init();

    info!("Feeshr Worker starting...");

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://feeshr:feeshr@localhost:5432/feeshr".into());

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .context("Failed to connect to PostgreSQL")?;

    info!("Connected to database");

    // Interval timers for each task.
    let mut reputation_interval = time::interval(Duration::from_secs(300));     // 5 min
    let mut quality_interval = time::interval(Duration::from_secs(3600));       // 1 hour
    let mut pattern_interval = time::interval(Duration::from_secs(86400));      // 24 hours
    let mut ecosystem_interval = time::interval(Duration::from_secs(21600));    // 6 hours
    let mut cleanup_interval = time::interval(Duration::from_secs(86400));      // 24 hours
    let mut publish_interval = time::interval(Duration::from_secs(300));        // 5 min
    let mut lock_expiry_interval = time::interval(Duration::from_secs(300));   // 5 min
    let mut decision_interval = time::interval(Duration::from_secs(300));      // 5 min
    let mut trust_interval = time::interval(Duration::from_secs(86400));       // 24 hours
    let mut collusion_interval = time::interval(Duration::from_secs(86400));   // 24 hours
    let mut cat_rep_interval = time::interval(Duration::from_secs(300));       // 5 min
    let mut decay_interval = time::interval(Duration::from_secs(86400));       // 24 hours
    let mut trace_eval_interval = time::interval(Duration::from_secs(3600));  // 1 hour
    let mut trace_cost_interval = time::interval(Duration::from_secs(86400)); // 24 hours
    let mut trace_sim_interval = time::interval(Duration::from_secs(604800)); // 7 days
    let mut bench_gen_interval = time::interval(Duration::from_secs(86400));  // 24 hours (checks monthly)
    let mut bench_expiry_interval = time::interval(Duration::from_secs(86400)); // 24 hours
    let mut bench_timeout_interval = time::interval(Duration::from_secs(60));   // 1 min
    let mut quantum_interval = time::interval(Duration::from_secs(86400));     // 24 hours

    // Health check counter — incremented on each tick so health server can report liveness.
    let tick_count = Arc::new(AtomicU64::new(0));
    let health_ticks = Arc::clone(&tick_count);

    // Spawn a minimal TCP health server on WORKER_HEALTH_PORT (default 8090).
    let health_port: u16 = std::env::var("WORKER_HEALTH_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8090);
    tokio::spawn(async move {
        let listener = match TcpListener::bind(format!("0.0.0.0:{health_port}")).await {
            Ok(l) => l,
            Err(e) => {
                tracing::warn!(error = %e, "Health server failed to bind on port {health_port}");
                return;
            }
        };
        info!("Worker health server on :{health_port}");
        loop {
            if let Ok((mut stream, _)) = listener.accept().await {
                let ticks = health_ticks.load(Ordering::Relaxed);
                let body = format!("{{\"status\":\"ok\",\"ticks\":{ticks}}}");
                let resp = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = stream.write_all(resp.as_bytes()).await;
            }
        }
    });

    info!("Worker loop started. Press Ctrl-C to shut down.");

    loop {
        tokio::select! {
            _ = reputation_interval.tick() => {
                tick_count.fetch_add(1, Ordering::Relaxed);
                info!("Running reputation recomputation...");
                if let Err(e) = reputation_engine::run_reputation_recompute(&pool).await {
                    tracing::error!(error = %e, "Reputation recomputation failed");
                }
            }
            _ = quality_interval.tick() => {
                info!("Running quality tracking...");
                if let Err(e) = quality_tracker::run_quality_tracking(&pool).await {
                    tracing::error!(error = %e, "Quality tracking failed");
                }
            }
            _ = pattern_interval.tick() => {
                info!("Running pattern detection...");
                if let Err(e) = pattern_detector::run_pattern_detection(&pool).await {
                    tracing::error!(error = %e, "Pattern detection failed");
                }
            }
            _ = ecosystem_interval.tick() => {
                info!("Running ecosystem analysis...");
                if let Err(e) = ecosystem_analyzer::run_ecosystem_analysis(&pool).await {
                    tracing::error!(error = %e, "Ecosystem analysis failed");
                }
            }
            _ = cleanup_interval.tick() => {
                info!("Running nightly cleanup...");
                if let Err(e) = cleanup::run_cleanup(&pool).await {
                    tracing::error!(error = %e, "Cleanup failed");
                }
            }
            _ = publish_interval.tick() => {
                info!("Checking for packages to publish...");
                if let Err(e) = package_publisher::run_publish_check(&pool).await {
                    tracing::error!(error = %e, "Publish check failed");
                }
            }
            _ = lock_expiry_interval.tick() => {
                if let Err(e) = cleanup::expire_work_locks(&pool).await {
                    tracing::error!(error = %e, "Lock expiry failed");
                }
            }
            _ = decision_interval.tick() => {
                if let Err(e) = decision_resolver::run_decision_resolution(&pool).await {
                    tracing::error!(error = %e, "Decision resolution failed");
                }
            }
            _ = trust_interval.tick() => {
                info!("Running reviewer trust update...");
                if let Err(e) = reviewer_trust::run_reviewer_trust_update(&pool).await {
                    tracing::error!(error = %e, "Reviewer trust update failed");
                }
            }
            _ = collusion_interval.tick() => {
                info!("Running collusion detection...");
                if let Err(e) = collusion_detector::run_collusion_detection(&pool).await {
                    tracing::error!(error = %e, "Collusion detection failed");
                }
            }
            _ = cat_rep_interval.tick() => {
                if let Err(e) = reputation_engine::run_categorical_recompute(&pool).await {
                    tracing::error!(error = %e, "Categorical reputation recompute failed");
                }
            }
            _ = decay_interval.tick() => {
                info!("Running smart decay...");
                if let Err(e) = reputation_engine::run_smart_decay(&pool).await {
                    tracing::error!(error = %e, "Smart decay failed");
                }
            }
            _ = trace_eval_interval.tick() => {
                info!("Running trace outcome evaluation...");
                if let Err(e) = trace_evaluator::run_trace_outcome_evaluation(&pool).await {
                    tracing::error!(error = %e, "Trace outcome evaluation failed");
                }
            }
            _ = trace_cost_interval.tick() => {
                info!("Running daily trace cost aggregation...");
                if let Err(e) = trace_cost_aggregator::run_daily_cost_aggregation(&pool).await {
                    tracing::error!(error = %e, "Trace cost aggregation failed");
                }
            }
            _ = trace_sim_interval.tick() => {
                info!("Running trace similarity analysis...");
                if let Err(e) = trace_similarity::run_trace_similarity_analysis(&pool).await {
                    tracing::error!(error = %e, "Trace similarity analysis failed");
                }
            }
            _ = bench_gen_interval.tick() => {
                info!("Checking benchmark challenge pool...");
                if let Err(e) = benchmark_generator::run_challenge_generation(&pool).await {
                    tracing::error!(error = %e, "Benchmark challenge generation failed");
                }
            }
            _ = bench_expiry_interval.tick() => {
                info!("Running benchmark expiry check...");
                if let Err(e) = benchmark_expiry::run_benchmark_expiry(&pool).await {
                    tracing::error!(error = %e, "Benchmark expiry check failed");
                }
                if let Err(e) = benchmark_expiry::run_benchmark_expiry_warnings(&pool).await {
                    tracing::error!(error = %e, "Benchmark expiry warnings failed");
                }
            }
            _ = bench_timeout_interval.tick() => {
                if let Err(e) = benchmark_expiry::run_session_timeout_check(&pool).await {
                    tracing::error!(error = %e, "Benchmark session timeout check failed");
                }
            }
            _ = quantum_interval.tick() => {
                info!("Running quantum readiness check...");
                if let Err(e) = quantum_readiness::run_quantum_readiness_check(&pool).await {
                    tracing::error!(error = %e, "Quantum readiness check failed");
                }
            }
            _ = shutdown_signal() => {
                info!("Worker shutting down");
                break;
            }
        }
    }

    Ok(())
}

/// Wait for SIGTERM or SIGINT.
async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("Failed to install CTRL+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("Failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
