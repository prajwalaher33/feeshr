//! Typed application error hierarchy.

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

/// All possible errors in the Feeshr Hub API.
#[derive(Debug, thiserror::Error)]
#[allow(dead_code)]
pub enum AppError {
    /// The requested agent was not found.
    #[error("Agent not found: {agent_id}")]
    AgentNotFound { agent_id: String },

    /// The requested repo was not found.
    #[error("Repo not found: {repo_id}")]
    RepoNotFound { repo_id: String },

    /// The requested PR was not found.
    #[error("PR not found: {pr_id}")]
    PrNotFound { pr_id: String },

    /// Agent does not have enough reputation for this action.
    #[error("Insufficient reputation: agent {agent_id} has {reputation}, needs {required}")]
    InsufficientReputation {
        agent_id: String,
        reputation: i64,
        required: i64,
    },

    /// Signature verification failed.
    #[error("Invalid signature for agent {agent_id}")]
    InvalidSignature { agent_id: String },

    /// Agent has no post-quantum key registered.
    #[error("No post-quantum key registered for agent {agent_id}")]
    NoPqKey { agent_id: String },

    /// HMAC signatures deprecated after deadline.
    #[error("HMAC-SHA3-256 signatures deprecated since {deadline}. Upgrade to SPHINCS+.")]
    HmacDeprecated { deadline: String },

    /// Unsupported signature algorithm.
    #[error("Unsupported signature algorithm: {algorithm}")]
    UnsupportedAlgorithm { algorithm: String },

    /// An agent attempted to review their own PR.
    #[error("Agent {agent_id} cannot review their own PR {pr_id}")]
    SelfReviewForbidden { agent_id: String, pr_id: String },

    /// A database error occurred.
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    /// Input validation failed.
    #[error("Validation error: {0}")]
    Validation(String),

    /// Rate limit exceeded for this agent.
    #[error("Rate limit exceeded for agent {agent_id}")]
    RateLimitExceeded { agent_id: String },

    /// Resource conflict (e.g., work lock already exists).
    #[error("{message}")]
    Conflict { message: String },

    /// The requested resource was not found (generic).
    #[error("{0}")]
    NotFound(String),

    /// The agent is not authorized for this action.
    #[error("{0}")]
    Forbidden(String),

    /// Agent has not passed the required benchmark level.
    #[error("Benchmark required: agent {agent_id} must pass level {required_level} benchmark before performing this action. Start at POST /api/v1/benchmarks/start")]
    BenchmarkRequired {
        agent_id: String,
        required_level: i32,
    },
}

impl IntoResponse for AppError {
    /// Convert the error into an HTTP response with JSON body.
    fn into_response(self) -> Response {
        let status = match &self {
            AppError::AgentNotFound { .. } => StatusCode::NOT_FOUND,
            AppError::RepoNotFound { .. } => StatusCode::NOT_FOUND,
            AppError::PrNotFound { .. } => StatusCode::NOT_FOUND,
            AppError::InsufficientReputation { .. } => StatusCode::FORBIDDEN,
            AppError::InvalidSignature { .. } => StatusCode::UNAUTHORIZED,
            AppError::NoPqKey { .. } => StatusCode::UNAUTHORIZED,
            AppError::HmacDeprecated { .. } => StatusCode::UPGRADE_REQUIRED,
            AppError::UnsupportedAlgorithm { .. } => StatusCode::BAD_REQUEST,
            AppError::SelfReviewForbidden { .. } => StatusCode::FORBIDDEN,
            AppError::Database(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::Validation(_) => StatusCode::UNPROCESSABLE_ENTITY,
            AppError::RateLimitExceeded { .. } => StatusCode::TOO_MANY_REQUESTS,
            AppError::Conflict { .. } => StatusCode::CONFLICT,
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::Forbidden(_) => StatusCode::FORBIDDEN,
            AppError::BenchmarkRequired { .. } => StatusCode::FORBIDDEN,
        };

        let body = Json(json!({ "error": self.to_string() }));
        (status, body).into_response()
    }
}
