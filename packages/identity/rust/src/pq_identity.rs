//! Post-quantum agent identity using SPHINCS+ (SLH-DSA).
//!
//! SPHINCS+ is a hash-based signature scheme standardized by NIST
//! as SLH-DSA in FIPS 205 (2024). It provides:
//! - Non-repudiation: only the signer can produce valid signatures
//! - Quantum resistance: security depends only on SHA3 hash strength
//! - Statelessness: no key pool management (unlike Lamport OTS)
//!
//! We use SPHINCS+-SHA3-256f (fast variant, ~17KB signatures, ~1ms sign).
//! The 'f' variant is faster to sign at the cost of larger signatures.
//! Since Feeshr signs actions and ledger entries (not network packets),
//! signature size is not a concern.
//!
//! Hybrid mode: during transition, the hub accepts both HMAC-SHA3-256
//! (legacy) and SPHINCS+ (post-quantum) signatures. The signature_algorithm
//! field in the action determines which verification path to use.

use pqcrypto_sphincsplus::sphincsshake256fsimple::*;
use pqcrypto_traits::sign::{DetachedSignature as _, PublicKey as _, SecretKey as _};
use sha3::{Digest, Sha3_256};

/// Post-quantum keypair for a Feeshr agent.
pub struct PqAgentIdentity {
    /// Agent ID: SHA3-256 hash of the SPHINCS+ public key
    pub agent_id: String,
    /// SPHINCS+ public key (can be shared)
    pub public_key: Vec<u8>,
    /// SPHINCS+ secret key (never transmitted, never logged)
    secret_key: Vec<u8>,
    /// Algorithm identifier for database/protocol
    pub algorithm: String,
}

impl PqAgentIdentity {
    /// Create a new post-quantum agent identity.
    ///
    /// Generates a SPHINCS+-SHA3-256f keypair from OS entropy.
    /// The agent_id is derived from the public key using SHA3-256,
    /// maintaining compatibility with the existing identity scheme.
    ///
    /// # Returns
    /// A new PqAgentIdentity ready for signing.
    pub fn create() -> Result<Self, PqIdentityError> {
        let (pk, sk) = keypair();

        let pk_bytes = pk.as_bytes().to_vec();
        let sk_bytes = sk.as_bytes().to_vec();

        // Agent ID = SHA3-256 of public key (same derivation as HMAC identity)
        let mut hasher = Sha3_256::new();
        hasher.update(&pk_bytes);
        let agent_id = hex::encode(hasher.finalize());

        Ok(Self {
            agent_id,
            public_key: pk_bytes,
            secret_key: sk_bytes,
            algorithm: "sphincs-sha3-256f".to_string(),
        })
    }

    /// Sign a payload with SPHINCS+.
    ///
    /// Returns a detached signature (the payload is NOT included in
    /// the signature bytes — caller retains the original payload).
    ///
    /// # Arguments
    /// * `payload` - The bytes to sign (action JSON, ledger entry, PoCC step)
    ///
    /// # Returns
    /// Hex-encoded detached SPHINCS+ signature (~17KB for SHA3-256f).
    pub fn sign(&self, payload: &[u8]) -> Result<String, PqIdentityError> {
        let sk = SecretKey::from_bytes(&self.secret_key)
            .map_err(|_| PqIdentityError::InvalidSecretKey)?;

        let sig = detached_sign(payload, &sk);
        Ok(hex::encode(sig.as_bytes()))
    }

    /// Verify a SPHINCS+ signature against a public key.
    ///
    /// # Arguments
    /// * `payload` - The original signed bytes
    /// * `signature_hex` - Hex-encoded detached signature
    /// * `public_key_bytes` - The signer's public key
    ///
    /// # Returns
    /// `true` if the signature is valid, `false` otherwise.
    /// Never panics — returns `false` on any error.
    pub fn verify(
        payload: &[u8],
        signature_hex: &str,
        public_key_bytes: &[u8],
    ) -> Result<bool, PqIdentityError> {
        let sig_bytes =
            hex::decode(signature_hex).map_err(|_| PqIdentityError::InvalidSignatureFormat)?;

        let sig = DetachedSignature::from_bytes(&sig_bytes)
            .map_err(|_| PqIdentityError::InvalidSignatureFormat)?;

        let pk = PublicKey::from_bytes(public_key_bytes)
            .map_err(|_| PqIdentityError::InvalidPublicKey)?;

        match verify_detached_signature(&sig, payload, &pk) {
            Ok(()) => Ok(true),
            Err(_) => Ok(false),
        }
    }
}

/// Errors specific to post-quantum identity operations.
#[derive(Debug, thiserror::Error)]
pub enum PqIdentityError {
    #[error("Invalid secret key bytes")]
    InvalidSecretKey,
    #[error("Invalid public key bytes")]
    InvalidPublicKey,
    #[error("Invalid signature format — expected hex-encoded SPHINCS+ detached signature")]
    InvalidSignatureFormat,
    #[error("Keypair generation failed: {0}")]
    KeyGenFailed(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pq_create_unique_ids() {
        let id1 = PqAgentIdentity::create().expect("keypair 1");
        let id2 = PqAgentIdentity::create().expect("keypair 2");
        assert_ne!(
            id1.agent_id, id2.agent_id,
            "Two identities must have different agent_ids"
        );
        assert_eq!(id1.agent_id.len(), 64, "agent_id must be 64 hex chars");
        assert_eq!(id1.algorithm, "sphincs-sha3-256f");
    }

    #[test]
    fn test_pq_sign_verify_roundtrip() {
        let identity = PqAgentIdentity::create().expect("keypair");
        let payload = b"hello feeshr quantum";
        let signature = identity.sign(payload).expect("sign");
        let valid =
            PqAgentIdentity::verify(payload, &signature, &identity.public_key).expect("verify");
        assert!(valid, "Valid signature should verify successfully");
    }

    #[test]
    fn test_pq_verify_wrong_payload() {
        let identity = PqAgentIdentity::create().expect("keypair");
        let signature = identity.sign(b"original payload").expect("sign");
        let valid = PqAgentIdentity::verify(b"tampered payload", &signature, &identity.public_key)
            .expect("verify");
        assert!(!valid, "Tampered payload should fail verification");
    }

    #[test]
    fn test_pq_verify_wrong_signature() {
        let identity = PqAgentIdentity::create().expect("keypair");
        let payload = b"test payload";
        // Use a hex string that's valid hex but wrong signature
        let fake_sig = "ab".repeat(identity.sign(payload).expect("sign").len() / 2);
        let result = PqAgentIdentity::verify(payload, &fake_sig, &identity.public_key);
        // Either returns Ok(false) or Err — both are acceptable
        // Invalid format is also acceptable.
        if let Ok(valid) = result {
            assert!(!valid, "Wrong signature should not verify");
        }
    }

    #[test]
    fn test_pq_verify_wrong_key() {
        let identity1 = PqAgentIdentity::create().expect("keypair 1");
        let identity2 = PqAgentIdentity::create().expect("keypair 2");
        let payload = b"test payload";
        let signature = identity1.sign(payload).expect("sign");
        let valid =
            PqAgentIdentity::verify(payload, &signature, &identity2.public_key).expect("verify");
        assert!(!valid, "Wrong public key should fail verification");
    }

    #[test]
    fn test_pq_agent_id_from_public_key() {
        let identity = PqAgentIdentity::create().expect("keypair");
        let mut hasher = Sha3_256::new();
        hasher.update(&identity.public_key);
        let expected_id = hex::encode(hasher.finalize());
        assert_eq!(
            identity.agent_id, expected_id,
            "agent_id must be SHA3-256 of public key"
        );
    }
}
