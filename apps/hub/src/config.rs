//! Configuration loading from environment variables.

use std::env;

/// Application configuration loaded from environment.
#[derive(Debug, Clone)]
pub struct Config {
    /// PostgreSQL connection URL (required).
    pub database_url: String,
    /// Redis connection URL.
    pub redis_url: String,
    /// HTTP server port.
    pub port: u16,
    /// Log level filter string.
    pub log_level: String,
    /// Qdrant vector database URL.
    pub qdrant_url: String,
    /// Internal git server URL.
    pub git_server_url: String,
    /// Default post-quantum signature algorithm for new agents.
    pub pq_signature_default: String,
    /// Whether to accept both HMAC and SPHINCS+ signatures (hybrid mode).
    pub pq_hybrid_mode: bool,
    /// Optional deadline after which HMAC-only signatures are rejected.
    pub pq_hmac_deprecation_date: Option<chrono::DateTime<chrono::Utc>>,
    /// Whether to enable post-quantum TLS (ML-KEM-768).
    pub pq_tls_enabled: bool,
    /// Whether to monitor OIDC token algorithms for quantum safety.
    pub pq_oidc_monitoring: bool,

    // -- Resilience knobs --
    /// Maximum number of database connections in the pool.
    pub db_max_connections: u32,
    /// Minimum number of warm connections in the pool.
    pub db_min_connections: u32,
    /// Time to wait for an available connection before erroring (seconds).
    pub db_acquire_timeout_seconds: u64,
    /// Idle connections older than this are evicted (seconds, 0 = never).
    pub db_idle_timeout_seconds: u64,
    /// Connections older than this are recycled (seconds, 0 = never).
    pub db_max_lifetime_seconds: u64,

    /// Maximum allowed request body size in bytes.
    pub max_request_body_bytes: usize,
    /// Per-request timeout in seconds for non-streaming routes.
    pub request_timeout_seconds: u64,

    /// Allowed CORS origins. Empty (or `["*"]`) means wide-open `Any`,
    /// which preserves dev behaviour. In production set
    /// `CORS_ALLOWED_ORIGINS=https://feeshr.com,https://www.feeshr.com`.
    pub cors_allowed_origins: Vec<String>,

    /// Run pending schema migrations on startup. Default: true. Set to false
    /// for pre-sqlx deployments that need the one-time backfill first.
    pub run_migrations_on_startup: bool,
}

fn parse_or<T: std::str::FromStr>(name: &str, default: T) -> T {
    env::var(name)
        .ok()
        .and_then(|v| v.parse::<T>().ok())
        .unwrap_or(default)
}

impl Config {
    /// Load configuration from environment variables.
    ///
    /// # Errors
    ///
    /// Returns an error if `DATABASE_URL` is not set.
    pub fn from_env() -> Result<Self, anyhow::Error> {
        let database_url = env::var("DATABASE_URL")
            .map_err(|_| anyhow::anyhow!("DATABASE_URL environment variable is required"))?;

        let redis_url =
            env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string());

        let port = env::var("PORT")
            .unwrap_or_else(|_| "8080".to_string())
            .parse::<u16>()
            .map_err(|e| anyhow::anyhow!("Invalid PORT value: {}", e))?;

        let log_level = env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string());

        let qdrant_url =
            env::var("QDRANT_URL").unwrap_or_else(|_| "http://localhost:6333".to_string());

        let git_server_url =
            env::var("GIT_SERVER_URL").unwrap_or_else(|_| "http://localhost:8081".to_string());

        let pq_signature_default =
            env::var("PQ_SIGNATURE_DEFAULT").unwrap_or_else(|_| "sphincs-sha3-256f".to_string());

        let pq_hybrid_mode = env::var("PQ_SIGNATURE_HYBRID_MODE")
            .unwrap_or_else(|_| "true".to_string())
            .parse::<bool>()
            .unwrap_or(true);

        let pq_hmac_deprecation_date = env::var("PQ_HMAC_DEPRECATION_DATE")
            .ok()
            .filter(|s| !s.is_empty())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc));

        let pq_tls_enabled = env::var("PQ_TLS_ENABLED")
            .unwrap_or_else(|_| "true".to_string())
            .parse::<bool>()
            .unwrap_or(true);

        let pq_oidc_monitoring = env::var("PQ_OIDC_MONITORING")
            .unwrap_or_else(|_| "true".to_string())
            .parse::<bool>()
            .unwrap_or(true);

        let db_max_connections = parse_or::<u32>("DB_MAX_CONNECTIONS", 20);
        let db_min_connections = parse_or::<u32>("DB_MIN_CONNECTIONS", 2);
        let db_acquire_timeout_seconds = parse_or::<u64>("DB_ACQUIRE_TIMEOUT_SECS", 5);
        // Default 10 minutes idle, 30 minute max lifetime — keeps the pool warm
        // but rotates connections so a flaky network never leaves us with all
        // dead sockets.
        let db_idle_timeout_seconds = parse_or::<u64>("DB_IDLE_TIMEOUT_SECS", 600);
        let db_max_lifetime_seconds = parse_or::<u64>("DB_MAX_LIFETIME_SECS", 1800);

        // 2 MB default — generous for JSON payloads, hard cap so a malicious
        // client can't OOM the process by streaming a giant body.
        let max_request_body_bytes = parse_or::<usize>("MAX_REQUEST_BODY_BYTES", 2 * 1024 * 1024);

        // 30s default request timeout. WebSocket upgrades and the long-poll
        // /feed handler are exempted at the layer site.
        let request_timeout_seconds = parse_or::<u64>("REQUEST_TIMEOUT_SECS", 30);

        let run_migrations_on_startup = env::var("RUN_MIGRATIONS_ON_STARTUP")
            .ok()
            .and_then(|v| v.parse::<bool>().ok())
            .unwrap_or(true);

        let cors_allowed_origins = env::var("CORS_ALLOWED_ORIGINS")
            .ok()
            .map(|raw| {
                raw.split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        Ok(Self {
            database_url,
            redis_url,
            port,
            log_level,
            qdrant_url,
            git_server_url,
            pq_signature_default,
            pq_hybrid_mode,
            pq_hmac_deprecation_date,
            pq_tls_enabled,
            pq_oidc_monitoring,
            db_max_connections,
            db_min_connections,
            db_acquire_timeout_seconds,
            db_idle_timeout_seconds,
            db_max_lifetime_seconds,
            max_request_body_bytes,
            request_timeout_seconds,
            cors_allowed_origins,
            run_migrations_on_startup,
        })
    }
}
