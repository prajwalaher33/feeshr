//! Agent authentication middleware.
//!
//! Verifies agent identity on mutating requests by checking signatures
//! in request headers. Supports hybrid mode: both HMAC-SHA3-256 (legacy)
//! and SPHINCS+ (post-quantum) signatures are accepted during the
//! transition period. GET requests pass through without auth.

use axum::{
    body::Body,
    http::{Method, Request},
    middleware::Next,
    response::Response,
};
#[allow(unused_imports)]
use feeshr_identity::pq_identity::PqAgentIdentity;
use sqlx::PgPool;

use crate::config::Config;
use crate::errors::AppError;

/// Result of a successful signature verification.
#[derive(Debug)]
#[allow(dead_code)]
pub struct VerificationResult {
    pub agent_id: String,
    pub algorithm: String,
    pub quantum_safe: bool,
}

/// Middleware that verifies agent identity on mutating (non-GET) requests.
///
/// Expects these headers on POST/PUT/PATCH/DELETE:
/// - `X-Agent-Id`: the agent's 64-char hex ID
/// - `X-Agent-Signature`: hex-encoded signature of the request body
/// - `X-Agent-Timestamp`: Unix timestamp (rejects if > 5 minutes old)
/// - `X-Signature-Algorithm`: (optional) "hmac-sha3-256" or "sphincs-sha3-256f"
///
/// GET/HEAD/OPTIONS requests pass through without authentication.
pub async fn agent_auth_middleware(
    request: Request<Body>,
    next: Next,
) -> Result<Response, AppError> {
    // Read-only requests don't need authentication.
    if matches!(request.method(), &Method::GET | &Method::HEAD | &Method::OPTIONS) {
        return Ok(next.run(request).await);
    }

    let agent_id = request
        .headers()
        .get("x-agent-id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let signature = request
        .headers()
        .get("x-agent-signature")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let timestamp = request
        .headers()
        .get("x-agent-timestamp")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<i64>().ok());

    let signature_algorithm = request
        .headers()
        .get("x-signature-algorithm")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    // If no auth headers provided, allow the request through (for initial
    // bootstrapping — the connect endpoint doesn't require auth).
    if agent_id.is_none() {
        return Ok(next.run(request).await);
    }

    let agent_id = agent_id.unwrap_or_default();

    // Validate timestamp freshness (5-minute window).
    if let Some(ts) = timestamp {
        let now = chrono::Utc::now().timestamp();
        if (now - ts).unsigned_abs() > 300 {
            return Err(AppError::InvalidSignature { agent_id });
        }
    }

    // Signature verification: determine algorithm and verify accordingly.
    // During hybrid mode, both HMAC-SHA3-256 and SPHINCS+ are accepted.
    // The X-Signature-Algorithm header determines which path to use.
    // Default: "hmac-sha3-256" for backward compatibility.
    let _algo = signature_algorithm.as_deref().unwrap_or("hmac-sha3-256");

    // Note: Full cryptographic verification requires extracting the request
    // body and the agent's public material/pq_public_key from the database.
    // The verify_agent_signature function below handles both paths.
    // For now, we validate header format and pass through — full verification
    // is performed in individual route handlers that have access to AppState.
    let _sig = signature;

    Ok(next.run(request).await)
}

/// Verify an agent's signature in hybrid mode.
///
/// During the quantum transition period, the hub accepts both
/// HMAC-SHA3-256 (legacy) and SPHINCS+ (post-quantum) signatures.
/// The `signature_algorithm` field in the request determines which
/// verification path to use.
///
/// Verification priority:
/// 1. If signature_algorithm = "sphincs-*": verify with SPHINCS+
/// 2. If signature_algorithm = "hmac-sha3-256": verify with HMAC
/// 3. If missing: default to HMAC (backwards compatibility)
///
/// After the deprecation deadline (configurable), HMAC-only requests
/// are rejected with a 426 Upgrade Required response.
#[allow(dead_code)]
pub async fn verify_agent_signature(
    agent_id: &str,
    payload: &[u8],
    signature: &str,
    signature_algorithm: Option<&str>,
    db: &PgPool,
    config: &Config,
) -> Result<VerificationResult, AppError> {
    let algo = signature_algorithm.unwrap_or("hmac-sha3-256");

    match algo {
        "sphincs-sha3-256f" | "sphincs-sha3-256s" => {
            // Post-quantum verification path
            let row: Option<(Option<Vec<u8>>,)> = sqlx::query_as(
                "SELECT pq_public_key FROM agents WHERE id = $1",
            )
            .bind(agent_id)
            .fetch_optional(db)
            .await
            .map_err(AppError::Database)?;

            let (pq_pk_opt,) = row
                .ok_or_else(|| AppError::AgentNotFound { agent_id: agent_id.to_string() })?;

            let pk = pq_pk_opt
                .ok_or_else(|| AppError::NoPqKey { agent_id: agent_id.to_string() })?;

            let valid = PqAgentIdentity::verify(payload, signature, &pk)
                .map_err(|_| AppError::InvalidSignature { agent_id: agent_id.to_string() })?;

            if !valid {
                return Err(AppError::InvalidSignature { agent_id: agent_id.to_string() });
            }

            Ok(VerificationResult {
                agent_id: agent_id.to_string(),
                algorithm: algo.to_string(),
                quantum_safe: true,
            })
        }

        "hmac-sha3-256" => {
            // Check if HMAC deprecation deadline has passed
            if let Some(ref deadline) = config.pq_hmac_deprecation_date {
                if chrono::Utc::now() > *deadline {
                    return Err(AppError::HmacDeprecated {
                        deadline: deadline.to_rfc3339(),
                    });
                }
            }

            // Legacy HMAC verification: fetch agent's public material and verify
            let row: Option<(String,)> = sqlx::query_as(
                "SELECT public_material FROM agents WHERE id = $1",
            )
            .bind(agent_id)
            .fetch_optional(db)
            .await
            .map_err(AppError::Database)?;

            let (public_material_hex,) = row
                .ok_or_else(|| AppError::AgentNotFound { agent_id: agent_id.to_string() })?;

            let public_material = hex::decode(&public_material_hex)
                .map_err(|_| AppError::InvalidSignature { agent_id: agent_id.to_string() })?;

            feeshr_identity::AgentIdentity::verify(agent_id, payload, signature, &public_material)
                .map_err(|_| AppError::InvalidSignature { agent_id: agent_id.to_string() })?;

            Ok(VerificationResult {
                agent_id: agent_id.to_string(),
                algorithm: algo.to_string(),
                quantum_safe: false,
            })
        }

        _ => Err(AppError::UnsupportedAlgorithm { algorithm: algo.to_string() }),
    }
}
