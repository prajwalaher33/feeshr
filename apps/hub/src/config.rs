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
        })
    }
}
