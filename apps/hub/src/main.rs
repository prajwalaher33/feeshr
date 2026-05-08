#![deny(warnings)]
//! Feeshr Hub — main entry point.

mod config;
mod errors;
mod middleware;
mod routes;
mod scenario;
mod services;
mod state;
mod telemetry;

pub use state::AppState;

use anyhow::Context;
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use std::sync::atomic::AtomicUsize;
use std::sync::Arc;
use std::time::Duration;
use tokio::net::TcpListener;
use tokio::signal;
use tokio::sync::broadcast;
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let cfg = config::Config::from_env().context("Failed to load configuration")?;

    telemetry::init(&cfg.log_level);
    routes::health::record_start_time();

    let mut pool_opts = PgPoolOptions::new()
        .max_connections(cfg.db_max_connections)
        .min_connections(cfg.db_min_connections)
        .acquire_timeout(Duration::from_secs(cfg.db_acquire_timeout_seconds))
        // sqlx tests connections before handing them out, so a half-broken
        // socket gets replaced instead of being returned to the caller.
        .test_before_acquire(true);
    if cfg.db_idle_timeout_seconds > 0 {
        pool_opts = pool_opts.idle_timeout(Duration::from_secs(cfg.db_idle_timeout_seconds));
    }
    if cfg.db_max_lifetime_seconds > 0 {
        pool_opts = pool_opts.max_lifetime(Duration::from_secs(cfg.db_max_lifetime_seconds));
    }
    let pool = pool_opts
        .connect(&cfg.database_url)
        .await
        .context("Failed to connect to PostgreSQL")?;

    info!(
        max_connections = cfg.db_max_connections,
        min_connections = cfg.db_min_connections,
        acquire_timeout_secs = cfg.db_acquire_timeout_seconds,
        idle_timeout_secs = cfg.db_idle_timeout_seconds,
        max_lifetime_secs = cfg.db_max_lifetime_seconds,
        "Database pool configured"
    );

    // Run pending schema migrations against the live database. sqlx takes
    // an internal Postgres advisory lock so multiple replicas booting in
    // parallel won't race. The migration files are baked into the binary
    // at compile time via the `migrations` symlink to packages/db/migrations.
    if cfg.run_migrations_on_startup {
        let migrator = sqlx::migrate!("./migrations");
        backfill_sqlx_migrations(&pool, &migrator).await?;
        info!("Running database migrations");
        migrator
            .run(&pool)
            .await
            .context("Database migration failed")?;
        info!("Database migrations complete");
    } else {
        info!("Skipping database migrations (RUN_MIGRATIONS_ON_STARTUP=false)");
    }

    let (event_tx, _) = broadcast::channel::<String>(1000);

    info!(port = cfg.port, "Feeshr Hub starting");

    let state = AppState {
        db: pool,
        config: cfg.clone(),
        event_tx,
        observer_count: Arc::new(AtomicUsize::new(0)),
    };

    let router = routes::build_router(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], cfg.port));
    let listener = TcpListener::bind(addr)
        .await
        .context("Failed to bind TCP listener")?;

    info!(addr = %addr, "Listening");

    axum::serve(listener, router)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("Server error")?;

    info!("Feeshr Hub shut down cleanly");
    Ok(())
}

/// Self-heal for pre-sqlx deployments: detect a database that already has
/// our schema applied (the canonical core table `agents` exists) but no
/// `_sqlx_migrations` bookkeeping. Without this, sqlx::migrate would try
/// to apply migration 001 and crash on `relation "agents" already exists`.
///
/// Strategy: if `agents` exists and `_sqlx_migrations` does not, create
/// `_sqlx_migrations` and seed marker rows for every migration sqlx knows
/// about — using the in-binary checksums so subsequent migrate calls
/// match exactly. The seeded rows mean migrate sees "all applied, nothing
/// to do" on first boot, then real new migrations apply normally on
/// future boots.
///
/// On a fresh database (neither table exists), this is a no-op and the
/// regular migrate call creates `_sqlx_migrations` itself.
async fn backfill_sqlx_migrations(
    pool: &sqlx::PgPool,
    migrator: &sqlx::migrate::Migrator,
) -> Result<(), anyhow::Error> {
    let bookkeeping_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables \
         WHERE table_name = '_sqlx_migrations')",
    )
    .fetch_one(pool)
    .await
    .context("Failed to probe for _sqlx_migrations")?;

    if bookkeeping_exists {
        return Ok(());
    }

    let agents_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables \
         WHERE table_name = 'agents')",
    )
    .fetch_one(pool)
    .await
    .context("Failed to probe for agents table")?;

    if !agents_exists {
        // Fresh database — let sqlx::migrate handle everything.
        return Ok(());
    }

    info!("Existing schema detected without _sqlx_migrations; seeding bookkeeping");

    sqlx::query(
        r#"CREATE TABLE IF NOT EXISTS _sqlx_migrations (
               version BIGINT PRIMARY KEY,
               description TEXT NOT NULL,
               installed_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
               success BOOLEAN NOT NULL,
               checksum BYTEA NOT NULL,
               execution_time BIGINT NOT NULL
           )"#,
    )
    .execute(pool)
    .await
    .context("Failed to create _sqlx_migrations")?;

    let mut seeded = 0usize;
    for migration in migrator.iter() {
        let res = sqlx::query(
            "INSERT INTO _sqlx_migrations \
             (version, description, success, checksum, execution_time) \
             VALUES ($1, $2, true, $3, 0) \
             ON CONFLICT (version) DO NOTHING",
        )
        .bind(migration.version)
        .bind(migration.description.as_ref())
        .bind(migration.checksum.as_ref())
        .execute(pool)
        .await
        .context("Failed to seed _sqlx_migrations row")?;
        if res.rows_affected() > 0 {
            seeded += 1;
        }
    }
    info!(
        seeded = seeded,
        "Seeded _sqlx_migrations from in-binary migration list"
    );
    Ok(())
}

/// Wait for SIGTERM or SIGINT, then return so axum can drain connections.
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

    info!("Shutdown signal received");
}
