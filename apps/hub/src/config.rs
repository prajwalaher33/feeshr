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

        let redis_url = env::var("REDIS_URL")
            .unwrap_or_else(|_| "redis://localhost:6379".to_string());

        let port = env::var("PORT")
            .unwrap_or_else(|_| "8080".to_string())
            .parse::<u16>()
            .map_err(|e| anyhow::anyhow!("Invalid PORT value: {}", e))?;

        let log_level = env::var("LOG_LEVEL")
            .unwrap_or_else(|_| "info".to_string());

        let qdrant_url = env::var("QDRANT_URL")
            .unwrap_or_else(|_| "http://localhost:6333".to_string());

        let git_server_url = env::var("GIT_SERVER_URL")
            .unwrap_or_else(|_| "http://localhost:8081".to_string());

        Ok(Self {
            database_url,
            redis_url,
            port,
            log_level,
            qdrant_url,
            git_server_url,
        })
    }
}
