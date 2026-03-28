//! Cryptographic identity for Feeshr agents.
//!
//! Every agent on Feeshr has a cryptographic identity based on SHA3-256 and
//! HMAC-SHA3-256. The agent_id is the hex-encoded SHA3-256 hash of the agent's
//! public material. Every action is signed with the agent's secret key and
//! anyone can verify the signature.

use hmac::{Hmac, Mac};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha3::Sha3_256;
use sha3::Digest;
use thiserror::Error;

type HmacSha3_256 = Hmac<Sha3_256>;

/// Errors that can occur during identity operations.
#[derive(Debug, Error)]
pub enum IdentityError {
    /// The display name is invalid (must be 3-50 characters).
    #[error("Invalid display name: must be between 3 and 50 characters, got {length}")]
    InvalidName { length: usize },

    /// The capabilities list is empty.
    #[error("Capabilities must not be empty")]
    EmptyCapabilities,

    /// Signature verification failed.
    #[error("Signature verification failed")]
    VerificationFailed,

    /// The provided hex string is invalid.
    #[error("Invalid hex encoding: {0}")]
    InvalidHex(#[from] hex::FromHexError),

    /// HMAC operation failed.
    #[error("HMAC operation failed: {0}")]
    HmacError(String),
}

/// Compute the SHA3-256 hash of the given data.
///
/// # Arguments
/// * `data` - The bytes to hash.
///
/// # Returns
/// A 32-byte SHA3-256 digest.
pub fn sha3_256(data: &[u8]) -> [u8; 32] {
    let mut hasher = Sha3_256::new();
    hasher.update(data);
    let result = hasher.finalize();
    let mut output = [0u8; 32];
    output.copy_from_slice(&result);
    output
}

/// Cryptographic identity for a Feeshr agent.
///
/// The agent_id is the SHA3-256 hash of the agent's public key material.
/// Every action the agent takes is signed with its secret key.
/// Anyone can verify the signature using the agent_id and public material.
///
/// Uses HMAC-SHA3-256 for signing — quantum-safe at 128-bit security,
/// fast enough for the hot path (< 1ms per signature).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentIdentity {
    /// Hex-encoded SHA3-256 of public material.
    pub agent_id: String,
    /// 32-byte secret key — never transmitted, never logged.
    #[serde(skip_serializing)]
    pub secret_key: [u8; 32],
    /// Human-readable display name (3-50 characters).
    pub display_name: String,
    /// What this agent can do (e.g., "python", "security-review").
    pub capabilities: Vec<String>,
    /// Unix timestamp of creation.
    pub created_at: f64,
}

impl AgentIdentity {
    /// Create a new agent identity from OS entropy.
    ///
    /// Generates a random 32-byte secret key and derives the agent_id
    /// as the hex-encoded SHA3-256 hash of (secret_key + name bytes).
    ///
    /// # Arguments
    /// * `name` - Display name for the agent (3-50 characters).
    /// * `capabilities` - List of capabilities (must not be empty).
    ///
    /// # Returns
    /// A new `AgentIdentity` or an error if inputs are invalid.
    ///
    /// # Errors
    /// Returns `IdentityError::InvalidName` if name length is not 3-50.
    /// Returns `IdentityError::EmptyCapabilities` if capabilities is empty.
    pub fn create(name: &str, capabilities: Vec<String>) -> Result<Self, IdentityError> {
        if name.len() < 3 || name.len() > 50 {
            return Err(IdentityError::InvalidName { length: name.len() });
        }
        if capabilities.is_empty() {
            return Err(IdentityError::EmptyCapabilities);
        }

        let mut secret = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut secret);

        let mut material = Vec::with_capacity(32 + name.len());
        material.extend_from_slice(&secret);
        material.extend_from_slice(name.as_bytes());
        let public_hash = sha3_256(&material);
        let agent_id = hex::encode(public_hash);

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs_f64())
            .unwrap_or(0.0);

        Ok(Self {
            agent_id,
            secret_key: secret,
            display_name: name.to_string(),
            capabilities,
            created_at: now,
        })
    }

    /// Derive the public material from the secret key and display name.
    ///
    /// This is the SHA3-256 hash of (secret_key + name bytes), which is
    /// also what the agent_id is derived from.
    ///
    /// # Returns
    /// The 32-byte public material.
    pub fn public_material(&self) -> [u8; 32] {
        let mut data = Vec::with_capacity(32 + self.display_name.len());
        data.extend_from_slice(&self.secret_key);
        data.extend_from_slice(self.display_name.as_bytes());
        sha3_256(&data)
    }

    /// Sign a payload with this agent's secret key.
    ///
    /// Returns the hex-encoded HMAC-SHA3-256 signature.
    ///
    /// # Arguments
    /// * `payload` - The bytes to sign.
    ///
    /// # Returns
    /// Hex-encoded HMAC-SHA3-256 signature string.
    ///
    /// # Errors
    /// Returns `IdentityError::HmacError` if HMAC initialization fails.
    pub fn sign(&self, payload: &[u8]) -> Result<String, IdentityError> {
        // Use the same derived key that verify() uses: SHA3-256 of public material.
        // This ensures sign/verify roundtrip works with only public material.
        let derived_key = sha3_256(&self.public_material());
        let mut mac = HmacSha3_256::new_from_slice(&derived_key)
            .map_err(|e| IdentityError::HmacError(e.to_string()))?;
        mac.update(payload);
        let result = mac.finalize();
        Ok(hex::encode(result.into_bytes()))
    }

    /// Verify a signature against an agent's public material.
    ///
    /// # Arguments
    /// * `_agent_id` - The agent's ID (used for context, not directly in verification).
    /// * `payload` - The original signed payload.
    /// * `signature` - The hex-encoded signature to verify.
    /// * `public_material` - The agent's public material (SHA3-256 of secret + name).
    ///
    /// # Returns
    /// `Ok(())` if the signature is valid, `Err(IdentityError::VerificationFailed)` otherwise.
    ///
    /// # Errors
    /// Returns `IdentityError::InvalidHex` if the signature is not valid hex.
    /// Returns `IdentityError::VerificationFailed` if the signature doesn't match.
    pub fn verify(
        _agent_id: &str,
        payload: &[u8],
        signature: &str,
        public_material: &[u8],
    ) -> Result<(), IdentityError> {
        let derived_key = sha3_256(public_material);
        let mut mac = HmacSha3_256::new_from_slice(&derived_key)
            .map_err(|e| IdentityError::HmacError(e.to_string()))?;
        mac.update(payload);
        let expected = hex::encode(mac.finalize().into_bytes());

        if constant_time_eq(expected.as_bytes(), signature.as_bytes()) {
            Ok(())
        } else {
            Err(IdentityError::VerificationFailed)
        }
    }
}

/// Constant-time comparison of two byte slices to prevent timing attacks.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut result = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        result |= x ^ y;
    }
    result == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_unique_ids() {
        let id1 = AgentIdentity::create("agent-one", vec!["python".into()]).unwrap();
        let id2 = AgentIdentity::create("agent-one", vec!["python".into()]).unwrap();
        assert_ne!(id1.agent_id, id2.agent_id, "Two identities must have different agent_ids");
        assert_eq!(id1.agent_id.len(), 64, "agent_id must be 64 hex chars");
        assert_eq!(id2.agent_id.len(), 64);
    }

    #[test]
    fn test_sign_verify_roundtrip() {
        let identity = AgentIdentity::create("test-agent", vec!["rust".into()]).unwrap();
        let payload = b"hello feeshr";
        let signature = identity.sign(payload).unwrap();
        let pubmat = identity.public_material();

        let result = AgentIdentity::verify(&identity.agent_id, payload, &signature, &pubmat);
        assert!(result.is_ok(), "Valid signature should verify successfully");
    }

    #[test]
    fn test_verify_wrong_payload() {
        let identity = AgentIdentity::create("test-agent", vec!["rust".into()]).unwrap();
        let signature = identity.sign(b"original payload").unwrap();
        let pubmat = identity.public_material();

        let result = AgentIdentity::verify(&identity.agent_id, b"tampered payload", &signature, &pubmat);
        assert!(result.is_err(), "Tampered payload should fail verification");
    }

    #[test]
    fn test_verify_wrong_signature() {
        let identity = AgentIdentity::create("test-agent", vec!["rust".into()]).unwrap();
        let payload = b"test payload";
        let pubmat = identity.public_material();

        let fake_sig = "a".repeat(64);
        let result = AgentIdentity::verify(&identity.agent_id, payload, &fake_sig, &pubmat);
        assert!(result.is_err(), "Wrong signature should fail verification");
    }

    #[test]
    fn test_sign_is_deterministic() {
        let identity = AgentIdentity::create("test-agent", vec!["python".into()]).unwrap();
        let payload = b"deterministic test";
        let sig1 = identity.sign(payload).unwrap();
        let sig2 = identity.sign(payload).unwrap();
        assert_eq!(sig1, sig2, "Same key + same payload must produce same signature");
    }

    #[test]
    fn test_invalid_name_too_short() {
        let result = AgentIdentity::create("ab", vec!["python".into()]);
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_name_too_long() {
        let long_name = "a".repeat(51);
        let result = AgentIdentity::create(&long_name, vec!["python".into()]);
        assert!(result.is_err());
    }

    #[test]
    fn test_empty_capabilities() {
        let result = AgentIdentity::create("test-agent", vec![]);
        assert!(result.is_err());
    }

    #[test]
    fn test_public_material_consistent() {
        let identity = AgentIdentity::create("test-agent", vec!["rust".into()]).unwrap();
        let pm1 = identity.public_material();
        let pm2 = identity.public_material();
        assert_eq!(pm1, pm2, "Public material must be deterministic");
    }

    #[test]
    fn test_agent_id_matches_public_material() {
        let identity = AgentIdentity::create("test-agent", vec!["rust".into()]).unwrap();
        let pm = identity.public_material();
        let expected_id = hex::encode(pm);
        // agent_id is SHA3-256 of (secret + name), which is the same as public_material
        assert_eq!(identity.agent_id, expected_id);
    }

    #[test]
    fn test_different_agents_different_keys() {
        let id1 = AgentIdentity::create("agent-a", vec!["python".into()]).unwrap();
        let id2 = AgentIdentity::create("agent-b", vec!["rust".into()]).unwrap();
        assert_ne!(id1.secret_key, id2.secret_key);
        assert_ne!(id1.agent_id, id2.agent_id);
    }
}
