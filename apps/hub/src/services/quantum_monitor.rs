//! OIDC token algorithm monitoring for quantum safety.
//!
//! Checks JWT token headers to identify quantum-vulnerable algorithms
//! (RSA, ECDSA) and logs/metrics for migration tracking. Does NOT
//! reject vulnerable tokens — only monitors until providers upgrade.

use serde_json::json;
use sqlx::PgPool;

/// Quantum safety classification of a JWT signing algorithm.
#[derive(Debug)]
pub enum QuantumSafety {
    /// Algorithm is quantum-safe (hash-based or lattice-based).
    Safe { algorithm: String, category: String },
    /// Algorithm is quantum-resistant but lacks non-repudiation (symmetric).
    Resistant { algorithm: String, note: String },
    /// Algorithm is broken by Shor's algorithm (RSA, ECDSA).
    Vulnerable { algorithm: String, reason: String },
    /// Unknown algorithm — treat as potentially vulnerable.
    Unknown { algorithm: String },
}

/// Check if a JWT algorithm is quantum-safe.
///
/// Currently, most OIDC providers (GitHub, Google) use RS256 (RSA)
/// or ES256 (ECDSA), both of which are broken by Shor's algorithm.
/// This function classifies the algorithm and returns the assessment.
///
/// We don't REJECT quantum-vulnerable tokens yet (that would break
/// all publishing until providers upgrade). We MONITOR and ALERT
/// so we know when providers start supporting PQ algorithms.
pub fn check_oidc_token_quantum_safety(algorithm: &str) -> QuantumSafety {
    match algorithm {
        // Quantum-VULNERABLE algorithms (broken by Shor's)
        "RS256" | "RS384" | "RS512" => QuantumSafety::Vulnerable {
            algorithm: algorithm.to_string(),
            reason: "RSA is broken by Shor's algorithm".into(),
        },
        "ES256" | "ES384" | "ES512" => QuantumSafety::Vulnerable {
            algorithm: algorithm.to_string(),
            reason: "ECDSA is broken by Shor's algorithm".into(),
        },
        "PS256" | "PS384" | "PS512" => QuantumSafety::Vulnerable {
            algorithm: algorithm.to_string(),
            reason: "RSA-PSS is broken by Shor's algorithm".into(),
        },

        // Quantum-SAFE algorithms (hash-based or lattice-based)
        "XMSS" | "LMS" | "HSS" => QuantumSafety::Safe {
            algorithm: algorithm.to_string(),
            category: "hash-based".into(),
        },
        "MLDSA44" | "MLDSA65" | "MLDSA87" => QuantumSafety::Safe {
            algorithm: algorithm.to_string(),
            category: "lattice-based (ML-DSA)".into(),
        },
        "SLHDSA" => QuantumSafety::Safe {
            algorithm: algorithm.to_string(),
            category: "hash-based (SPHINCS+)".into(),
        },

        // Symmetric algorithms (quantum-resistant but no non-repudiation)
        "HS256" | "HS384" | "HS512" => QuantumSafety::Resistant {
            algorithm: algorithm.to_string(),
            note: "HMAC is quantum-resistant but lacks non-repudiation".into(),
        },

        // Unknown — treat as potentially vulnerable
        other => QuantumSafety::Unknown {
            algorithm: other.to_string(),
        },
    }
}

/// Log an OIDC token's quantum safety assessment to the database and metrics.
///
/// Records the assessment in the quantum_readiness_log table for dashboard
/// tracking. Does NOT reject any tokens — monitoring only.
pub async fn log_oidc_quantum_assessment(
    db: &PgPool,
    algorithm: &str,
    issuer: &str,
) -> Result<(), sqlx::Error> {
    let safety = check_oidc_token_quantum_safety(algorithm);

    match safety {
        QuantumSafety::Vulnerable {
            ref algorithm,
            ref reason,
        } => {
            tracing::warn!(
                algorithm = %algorithm,
                reason = %reason,
                issuer = %issuer,
                "OIDC token uses quantum-vulnerable algorithm"
            );

            sqlx::query(
                r#"INSERT INTO quantum_readiness_log (event_type, details)
                   VALUES ('oidc_quantum_vulnerable_detected', $1)"#,
            )
            .bind(json!({
                "algorithm": algorithm,
                "issuer": issuer,
                "reason": reason,
            }))
            .execute(db)
            .await?;
        }

        QuantumSafety::Safe {
            ref algorithm,
            ref category,
        } => {
            tracing::info!(
                algorithm = %algorithm,
                category = %category,
                issuer = %issuer,
                "OIDC token uses quantum-safe algorithm"
            );

            sqlx::query(
                r#"INSERT INTO quantum_readiness_log (event_type, details)
                   VALUES ('oidc_quantum_safe_detected', $1)"#,
            )
            .bind(json!({
                "algorithm": algorithm,
                "category": category,
                "issuer": issuer,
            }))
            .execute(db)
            .await?;
        }

        _ => {} // Unknown or resistant — no special logging
    }

    Ok(())
}
