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
mod stake_resolver;
mod trace_cost_aggregator;
mod trace_evaluator;
mod trace_similarity;

use anyhow::Context;
use sqlx::postgres::PgPoolOptions;
use std::future::Future;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use tokio::net::TcpListener;
use tokio::signal;
use tokio::time::{self, Duration, MissedTickBehavior};
use tracing::info;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

fn parse_env_or<T: std::str::FromStr>(name: &str, default: T) -> T {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse::<T>().ok())
        .unwrap_or(default)
}

/// Build a tokio interval that skips missed ticks instead of bursting.
/// Default tokio behaviour is "burst", which means after a slow tick the
/// worker would fire the same task back-to-back. Skip keeps cadence honest
/// at the cost of dropping missed firings.
fn job_interval(period: Duration) -> time::Interval {
    let mut iv = time::interval(period);
    iv.set_missed_tick_behavior(MissedTickBehavior::Skip);
    iv
}

/// Run a job with a hard deadline so a hung query can't stall the whole
/// worker forever. Generic over the success type so jobs that return
/// `Result<u64, _>` (e.g. row counts) work without extra wrapping.
async fn run_job<F, T>(name: &str, deadline: Duration, fut: F)
where
    F: Future<Output = Result<T, anyhow::Error>>,
{
    let started = std::time::Instant::now();
    match tokio::time::timeout(deadline, fut).await {
        Ok(Ok(_)) => {
            tracing::debug!(
                job = name,
                elapsed_ms = started.elapsed().as_millis() as u64,
                "Job done"
            );
        }
        Ok(Err(e)) => {
            tracing::error!(job = name, error = %e, elapsed_ms = started.elapsed().as_millis() as u64, "Job failed");
        }
        Err(_) => {
            tracing::error!(
                job = name,
                deadline_secs = deadline.as_secs(),
                "Job timed out"
            );
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with(fmt::layer().json())
        .init();

    info!("Feeshr Worker starting...");

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://feeshr:feeshr@localhost:5432/feeshr".into());

    let max_conns = parse_env_or::<u32>("WORKER_DB_MAX_CONNECTIONS", 5);
    let min_conns = parse_env_or::<u32>("WORKER_DB_MIN_CONNECTIONS", 1);
    let acquire_secs = parse_env_or::<u64>("WORKER_DB_ACQUIRE_TIMEOUT_SECS", 5);
    let idle_secs = parse_env_or::<u64>("WORKER_DB_IDLE_TIMEOUT_SECS", 600);
    let lifetime_secs = parse_env_or::<u64>("WORKER_DB_MAX_LIFETIME_SECS", 1800);
    // Per-job hard deadline. Most jobs finish in seconds; the cap exists so a
    // pathological query can't keep the loop occupied indefinitely.
    let job_deadline = Duration::from_secs(parse_env_or::<u64>("WORKER_JOB_DEADLINE_SECS", 600));

    let mut pool_opts = PgPoolOptions::new()
        .max_connections(max_conns)
        .min_connections(min_conns)
        .acquire_timeout(Duration::from_secs(acquire_secs))
        .test_before_acquire(true);
    if idle_secs > 0 {
        pool_opts = pool_opts.idle_timeout(Duration::from_secs(idle_secs));
    }
    if lifetime_secs > 0 {
        pool_opts = pool_opts.max_lifetime(Duration::from_secs(lifetime_secs));
    }
    let pool = pool_opts
        .connect(&database_url)
        .await
        .context("Failed to connect to PostgreSQL")?;

    info!(
        max_connections = max_conns,
        min_connections = min_conns,
        acquire_timeout_secs = acquire_secs,
        idle_timeout_secs = idle_secs,
        max_lifetime_secs = lifetime_secs,
        job_deadline_secs = job_deadline.as_secs(),
        "Connected to database"
    );

    // Interval timers for each task.
    let mut reputation_interval = job_interval(Duration::from_secs(300)); // 5 min
    let mut quality_interval = job_interval(Duration::from_secs(3600)); // 1 hour
    let mut pattern_interval = job_interval(Duration::from_secs(86400)); // 24 hours
    let mut ecosystem_interval = job_interval(Duration::from_secs(21600)); // 6 hours
    let mut cleanup_interval = job_interval(Duration::from_secs(86400)); // 24 hours
    let mut publish_interval = job_interval(Duration::from_secs(300)); // 5 min
    let mut lock_expiry_interval = job_interval(Duration::from_secs(300)); // 5 min
    let mut decision_interval = job_interval(Duration::from_secs(300)); // 5 min
    let mut trust_interval = job_interval(Duration::from_secs(86400)); // 24 hours
    let mut collusion_interval = job_interval(Duration::from_secs(86400)); // 24 hours
    let mut cat_rep_interval = job_interval(Duration::from_secs(300)); // 5 min
    let mut decay_interval = job_interval(Duration::from_secs(86400)); // 24 hours
    let mut trace_eval_interval = job_interval(Duration::from_secs(3600)); // 1 hour
    let mut trace_cost_interval = job_interval(Duration::from_secs(86400)); // 24 hours
    let mut trace_sim_interval = job_interval(Duration::from_secs(604800)); // 7 days
    let mut bench_gen_interval = job_interval(Duration::from_secs(86400)); // 24 hours
    let mut bench_expiry_interval = job_interval(Duration::from_secs(86400)); // 24 hours
    let mut bench_timeout_interval = job_interval(Duration::from_secs(60)); // 1 min
    let mut quantum_interval = job_interval(Duration::from_secs(86400)); // 24 hours
    let mut stake_resolver_interval = job_interval(Duration::from_secs(300)); // 5 min

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
                run_job("reputation_recompute", job_deadline, reputation_engine::run_reputation_recompute(&pool)).await;
            }
            _ = quality_interval.tick() => {
                tick_count.fetch_add(1, Ordering::Relaxed);
                run_job("quality_tracking", job_deadline, quality_tracker::run_quality_tracking(&pool)).await;
            }
            _ = pattern_interval.tick() => {
                tick_count.fetch_add(1, Ordering::Relaxed);
                run_job("pattern_detection", job_deadline, pattern_detector::run_pattern_detection(&pool)).await;
            }
            _ = ecosystem_interval.tick() => {
                tick_count.fetch_add(1, Ordering::Relaxed);
                run_job("ecosystem_analysis", job_deadline, ecosystem_analyzer::run_ecosystem_analysis(&pool)).await;
            }
            _ = cleanup_interval.tick() => {
                tick_count.fetch_add(1, Ordering::Relaxed);
                run_job("cleanup", job_deadline, cleanup::run_cleanup(&pool)).await;
            }
            _ = publish_interval.tick() => {
                tick_count.fetch_add(1, Ordering::Relaxed);
                run_job("publish_check", job_deadline, package_publisher::run_publish_check(&pool)).await;
            }
            _ = lock_expiry_interval.tick() => {
                tick_count.fetch_add(1, Ordering::Relaxed);
                run_job("lock_expiry", job_deadline, cleanup::expire_work_locks(&pool)).await;
            }
            _ = decision_interval.tick() => {
                tick_count.fetch_add(1, Ordering::Relaxed);
                run_job("decision_resolution", job_deadline, decision_resolver::run_decision_resolution(&pool)).await;
            }
            _ = stake_resolver_interval.tick() => {
                tick_count.fetch_add(1, Ordering::Relaxed);
                run_job("stake_resolution", job_deadline, stake_resolver::run_stake_resolution(&pool)).await;
            }
            _ = trust_interval.tick() => {
                tick_count.fetch_add(1, Ordering::Relaxed);
                run_job("reviewer_trust_update", job_deadline, reviewer_trust::run_reviewer_trust_update(&pool)).await;
            }
            _ = collusion_interval.tick() => {
                tick_count.fetch_add(1, Ordering::Relaxed);
                run_job("collusion_detection", job_deadline, collusion_detector::run_collusion_detection(&pool)).await;
            }
            _ = cat_rep_interval.tick() => {
                tick_count.fetch_add(1, Ordering::Relaxed);
                run_job("categorical_reputation", job_deadline, reputation_engine::run_categorical_recompute(&pool)).await;
            }
            _ = decay_interval.tick() => {
                tick_count.fetch_add(1, Ordering::Relaxed);
                run_job("smart_decay", job_deadline, reputation_engine::run_smart_decay(&pool)).await;
            }
            _ = trace_eval_interval.tick() => {
                tick_count.fetch_add(1, Ordering::Relaxed);
                run_job("trace_outcome_eval", job_deadline, trace_evaluator::run_trace_outcome_evaluation(&pool)).await;
            }
            _ = trace_cost_interval.tick() => {
                tick_count.fetch_add(1, Ordering::Relaxed);
                run_job("trace_cost_aggregation", job_deadline, trace_cost_aggregator::run_daily_cost_aggregation(&pool)).await;
            }
            _ = trace_sim_interval.tick() => {
                tick_count.fetch_add(1, Ordering::Relaxed);
                run_job("trace_similarity", job_deadline, trace_similarity::run_trace_similarity_analysis(&pool)).await;
            }
            _ = bench_gen_interval.tick() => {
                tick_count.fetch_add(1, Ordering::Relaxed);
                run_job("benchmark_generation", job_deadline, benchmark_generator::run_challenge_generation(&pool)).await;
            }
            _ = bench_expiry_interval.tick() => {
                tick_count.fetch_add(1, Ordering::Relaxed);
                run_job("benchmark_expiry", job_deadline, benchmark_expiry::run_benchmark_expiry(&pool)).await;
                run_job("benchmark_expiry_warnings", job_deadline, benchmark_expiry::run_benchmark_expiry_warnings(&pool)).await;
            }
            _ = bench_timeout_interval.tick() => {
                tick_count.fetch_add(1, Ordering::Relaxed);
                run_job("benchmark_session_timeout", job_deadline, benchmark_expiry::run_session_timeout_check(&pool)).await;
            }
            _ = quantum_interval.tick() => {
                tick_count.fetch_add(1, Ordering::Relaxed);
                run_job("quantum_readiness", job_deadline, quantum_readiness::run_quantum_readiness_check(&pool)).await;
            }
            _ = shutdown_signal() => {
                info!("Worker shutting down");
                break;
            }
        }
    }

    info!("Worker stopped cleanly");
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
