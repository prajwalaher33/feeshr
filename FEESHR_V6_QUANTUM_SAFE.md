# FEESHR V6 — FULL QUANTUM-SAFE UPGRADE
# Standalone prompt — execute on top of V1-V5
#
# THREE CHANGES that make Feeshr 100% quantum-proof:
# 1. Replace HMAC-SHA3-256 signing with SPHINCS+ (SLH-DSA) — true non-repudiation
# 2. Upgrade all inter-service TLS to post-quantum (ML-KEM-768 hybrid)
# 3. Add OIDC token algorithm monitoring — detect quantum-vulnerable tokens
#
# After this upgrade, every cryptographic operation in Feeshr is quantum-safe:
# - Identity hashing: SHA3-256 (already quantum-resistant)
# - Action signing: SPHINCS+ (NIST-standardized post-quantum)
# - Chain linking: SHA3-256 hash chains (quantum-resistant)
# - TLS transport: ML-KEM-768 + X25519 hybrid (quantum-resistant key exchange)
# - OIDC monitoring: Alert on quantum-vulnerable token algorithms
#
# ASSUMES: V1-V5 all deployed and running. Existing HMAC-SHA3-256 signatures
# continue to work during transition (hybrid mode).

---

## GROUND RULES

### Hybrid transition — never break existing agents
- All changes run in HYBRID MODE: accept both old (HMAC-SHA3-256) and new (SPHINCS+)
- Existing agents keep working without any SDK upgrade
- New agents get SPHINCS+ keys by default
- After 6 months, deprecate HMAC-only agents (configurable deadline)
- No agent loses reputation, PoCC chains, or ledger entries during transition

### Discovery first
1. Scan codebase — identify every file that creates, signs, or verifies signatures
2. Map all TLS configuration points (inter-service, external-facing, WebSocket)
3. Identify all OIDC token verification paths
4. Present plan before executing

### Code standards (match existing)
- Rust: `#![deny(warnings)]`, no `unwrap()`, typed errors
- Python: type hints, specific exceptions, Pydantic models
- Every public function documented
- Tests for every change

---

## CHANGE 1: SPHINCS+ (SLH-DSA) SIGNATURES

### 1.1 — Why SPHINCS+ over other post-quantum signature schemes

NIST standardized three post-quantum signature schemes in 2024:
- ML-DSA (Dilithium): Lattice-based. Smaller signatures (~2.4KB). Faster.
  But lattice security assumptions are newer and less battle-tested.
- SLH-DSA (SPHINCS+): Hash-based. Larger signatures (~7-40KB). Slower.
  But security depends ONLY on hash function security — the most
  conservative and well-understood assumption in cryptography.
- FN-DSA (Falcon): Lattice-based. Compact. But complex to implement
  correctly — side-channel vulnerabilities are a real risk.

Feeshr should use SPHINCS+ because:
1. It depends only on SHA3, which Feeshr already uses everywhere
2. Hash-based security is the gold standard — no new math assumptions
3. Signature size doesn't matter for Feeshr (signing actions and ledger
   entries, not network packets — 7KB signatures are fine)
4. Implementation simplicity reduces the chance of security bugs
5. If SHA3 holds (and it will), SPHINCS+ holds — no separate risk

### 1.2 — Database Migration: `012_quantum_signatures.sql`

```sql
-- ─── Quantum-Safe Signature Upgrade ─────────────────────────────

-- Store agent's post-quantum public key alongside existing identity
ALTER TABLE agents ADD COLUMN IF NOT EXISTS
    pq_public_key       BYTEA;          -- SPHINCS+ public key (32-64 bytes)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS
    pq_key_algorithm    TEXT DEFAULT NULL
                        CHECK (pq_key_algorithm IN ('sphincs-sha3-256f', 'sphincs-sha3-256s',
                                                     'sphincs-sha3-192f', 'sphincs-sha3-192s',
                                                     NULL));
ALTER TABLE agents ADD COLUMN IF NOT EXISTS
    pq_key_created_at   TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS
    signature_mode      TEXT NOT NULL DEFAULT 'hmac'
                        CHECK (signature_mode IN ('hmac', 'sphincs', 'hybrid'));
-- 'hmac': legacy HMAC-SHA3-256 only
-- 'sphincs': SPHINCS+ only (post-transition)
-- 'hybrid': accepts both, prefers SPHINCS+ (transition period)

-- Track key rotation history for post-quantum keys
CREATE TABLE IF NOT EXISTS pq_key_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id            TEXT NOT NULL REFERENCES agents(id),
    algorithm           TEXT NOT NULL,
    public_key          BYTEA NOT NULL,
    -- Key lifecycle
    status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'rotated', 'revoked')),
    activated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rotated_at          TIMESTAMPTZ,
    revoked_at          TIMESTAMPTZ,
    revocation_reason   TEXT,
    -- Which key replaced this one
    replaced_by         UUID REFERENCES pq_key_history(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pq_key_agent ON pq_key_history(agent_id, status);
CREATE UNIQUE INDEX idx_pq_key_active ON pq_key_history(agent_id)
    WHERE status = 'active';

-- Update action_log to support both signature types
ALTER TABLE action_log ADD COLUMN IF NOT EXISTS
    signature_algorithm TEXT NOT NULL DEFAULT 'hmac-sha3-256';
-- Values: 'hmac-sha3-256', 'sphincs-sha3-256f', 'sphincs-sha3-256s'

-- Update proof_of_work_ledger — already has signature_algorithm column (V5)
-- Just ensure it accepts the new values
ALTER TABLE proof_of_work_ledger DROP CONSTRAINT IF EXISTS
    proof_of_work_ledger_signature_algorithm_check;
ALTER TABLE proof_of_work_ledger ADD CONSTRAINT
    proof_of_work_ledger_signature_algorithm_check
    CHECK (signature_algorithm IN ('hmac-sha3-256',
                                    'sphincs-sha3-256f', 'sphincs-sha3-256s'));

-- Update PoCC chains — already has signature_algorithm column (V5)
ALTER TABLE pocc_chains DROP CONSTRAINT IF EXISTS
    pocc_chains_signature_algorithm_check;
ALTER TABLE pocc_chains ADD CONSTRAINT
    pocc_chains_signature_algorithm_check
    CHECK (signature_algorithm IN ('hmac-sha3-256',
                                    'sphincs-sha3-256f', 'sphincs-sha3-256s',
                                    NULL));

-- ─── Quantum Readiness Tracking ─────────────────────────────────
-- Track the platform's migration progress toward full quantum safety

CREATE TABLE quantum_readiness_log (
    id                  BIGSERIAL PRIMARY KEY,
    event_type          TEXT NOT NULL CHECK (event_type IN (
        'agent_upgraded_to_sphincs',
        'agent_created_with_sphincs',
        'hmac_only_agent_warning',
        'hmac_deprecation_enforced',
        'oidc_quantum_vulnerable_detected',
        'oidc_quantum_safe_detected',
        'tls_pq_handshake_success',
        'tls_pq_handshake_failure'
    )),
    agent_id            TEXT,
    details             JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quantum_log_type ON quantum_readiness_log(event_type, created_at DESC);
```

### 1.3 — Rust Implementation: SPHINCS+ Signing

Modify: `packages/identity/rust/`

Add to `Cargo.toml`:
```toml
[dependencies]
pqcrypto-sphincsplus = "0.7"  # SPHINCS+ implementation
pqcrypto-traits = "0.3"       # Common traits for pqcrypto
```

Create file: `packages/identity/rust/src/pq_identity.rs`

```rust
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

use pqcrypto_sphincsplus::sphincssha3256fsimple::*;
use pqcrypto_traits::sign::{PublicKey as PqPublicKey, SecretKey as PqSecretKey,
                             SignedMessage, DetachedSignature};
use sha3::{Sha3_256, Digest};

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
        let sig_bytes = hex::decode(signature_hex)
            .map_err(|_| PqIdentityError::InvalidSignatureFormat)?;

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
```

### 1.4 — Hybrid Verification in Hub Middleware

Modify: `apps/hub/src/middleware/agent_auth.rs`

```rust
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
pub async fn verify_agent_signature(
    agent_id: &str,
    payload: &[u8],
    signature: &str,
    signature_algorithm: Option<&str>,
    db: &PgPool,
    config: &AppConfig,
) -> Result<VerificationResult, AuthError> {
    let algo = signature_algorithm.unwrap_or("hmac-sha3-256");

    match algo {
        "sphincs-sha3-256f" | "sphincs-sha3-256s" => {
            // Post-quantum verification path
            let agent = sqlx::query!(
                "SELECT pq_public_key FROM agents WHERE id = $1",
                agent_id
            )
            .fetch_optional(db)
            .await
            .map_err(|e| AuthError::DatabaseError(e.to_string()))?
            .ok_or(AuthError::AgentNotFound(agent_id.to_string()))?;

            let pk = agent.pq_public_key
                .ok_or(AuthError::NoPqKey(agent_id.to_string()))?;

            let valid = PqAgentIdentity::verify(payload, signature, &pk)
                .map_err(|e| AuthError::VerificationFailed(e.to_string()))?;

            if !valid {
                return Err(AuthError::InvalidSignature);
            }

            Ok(VerificationResult {
                agent_id: agent_id.to_string(),
                algorithm: algo.to_string(),
                quantum_safe: true,
            })
        }

        "hmac-sha3-256" => {
            // Check if HMAC deprecation deadline has passed
            if config.hmac_deprecated_after.is_some() {
                let deadline = config.hmac_deprecated_after.unwrap();
                if chrono::Utc::now() > deadline {
                    return Err(AuthError::HmacDeprecated {
                        deadline,
                        message: "HMAC-SHA3-256 signatures are no longer accepted. \
                                  Upgrade your agent SDK to use SPHINCS+ signatures.".into(),
                    });
                }
            }

            // Legacy HMAC verification (existing code path)
            let valid = verify_hmac_signature(agent_id, payload, signature, db).await?;
            if !valid {
                return Err(AuthError::InvalidSignature);
            }

            Ok(VerificationResult {
                agent_id: agent_id.to_string(),
                algorithm: algo.to_string(),
                quantum_safe: false,
            })
        }

        _ => Err(AuthError::UnsupportedAlgorithm(algo.to_string())),
    }
}
```

### 1.5 — Python SDK: SPHINCS+ Agent Identity

Modify: `packages/identity/python/feeshr_identity/identity.py`

Add to `requirements.txt` / `pyproject.toml`:
```
pqcrypto >= 0.1.0
```

```python
# NEW FILE: packages/identity/python/feeshr_identity/pq_identity.py

"""
Post-quantum agent identity using SPHINCS+ (SLH-DSA).

This module provides SPHINCS+-SHA3-256f signatures for Feeshr agents.
It's a drop-in replacement for the existing HMAC-based AgentIdentity,
with the same interface but true non-repudiation and quantum resistance.

Usage:
    from feeshr_identity.pq_identity import PqAgentIdentity

    # Create a new quantum-safe identity
    identity = PqAgentIdentity.create("my-agent", ["python", "security"])

    # Sign an action
    signature = identity.sign(payload_bytes)

    # Verify (anyone can verify with just the public key)
    is_valid = PqAgentIdentity.verify(payload_bytes, signature, public_key_bytes)
"""

import hashlib
import time
from dataclasses import dataclass, field
from typing import ClassVar

try:
    from pqcrypto.sign.sphincs_sha3_256f_simple import (
        generate_keypair, sign, verify, SIGNATURE_SIZE, PUBLIC_KEY_SIZE
    )
    PQ_AVAILABLE = True
except ImportError:
    PQ_AVAILABLE = False


@dataclass
class PqAgentIdentity:
    """
    Quantum-safe cryptographic identity for a Feeshr agent.

    Uses SPHINCS+-SHA3-256f (fast variant) for signatures.
    The agent_id is the SHA3-256 hash of the SPHINCS+ public key,
    maintaining the same format as legacy HMAC identities.

    Attributes:
        agent_id: Hex-encoded SHA3-256 of public key (64 chars)
        public_key: SPHINCS+ public key bytes (can be shared)
        secret_key: SPHINCS+ secret key bytes (NEVER share, transmit, or log)
        display_name: Human-readable agent name
        capabilities: List of skills/capabilities
        algorithm: Always 'sphincs-sha3-256f'
    """
    agent_id: str
    public_key: bytes
    secret_key: bytes  # NEVER transmitted, NEVER logged
    display_name: str
    capabilities: list[str]
    algorithm: str = "sphincs-sha3-256f"
    created_at: float = field(default_factory=time.time)

    ALGORITHM: ClassVar[str] = "sphincs-sha3-256f"

    @classmethod
    def create(cls, name: str, capabilities: list[str]) -> 'PqAgentIdentity':
        """
        Create a new quantum-safe agent identity from OS entropy.

        Generates a SPHINCS+-SHA3-256f keypair. The agent_id is derived
        from the public key using SHA3-256.

        Args:
            name: Display name for the agent (3-50 chars)
            capabilities: List of skills (e.g., ["python", "security"])

        Returns:
            A new PqAgentIdentity ready for signing.

        Raises:
            RuntimeError: If pqcrypto is not installed.
        """
        if not PQ_AVAILABLE:
            raise RuntimeError(
                "pqcrypto package not installed. "
                "Install with: pip install pqcrypto"
            )

        public_key, secret_key = generate_keypair()
        pk_bytes = bytes(public_key)
        sk_bytes = bytes(secret_key)

        agent_id = hashlib.sha3_256(pk_bytes).hexdigest()

        return cls(
            agent_id=agent_id,
            public_key=pk_bytes,
            secret_key=sk_bytes,
            display_name=name,
            capabilities=capabilities,
        )

    def sign(self, payload: bytes) -> str:
        """
        Sign a payload with SPHINCS+.

        Returns a hex-encoded detached signature. The signature proves
        this agent authored the payload, and no one else could have
        produced it (non-repudiation).

        Args:
            payload: Bytes to sign (action JSON, ledger entry, etc.)

        Returns:
            Hex-encoded SPHINCS+ signature (~17KB for SHA3-256f).
        """
        if not PQ_AVAILABLE:
            raise RuntimeError("pqcrypto not installed")

        signature = sign(payload, self.secret_key)
        # sign() returns signed_message (payload + signature)
        # Extract just the signature (last SIGNATURE_SIZE bytes)
        sig_bytes = bytes(signature)[-SIGNATURE_SIZE:]
        return sig_bytes.hex()

    @staticmethod
    def verify(payload: bytes, signature_hex: str, public_key_bytes: bytes) -> bool:
        """
        Verify a SPHINCS+ signature.

        Args:
            payload: The original signed bytes
            signature_hex: Hex-encoded detached signature
            public_key_bytes: The signer's SPHINCS+ public key

        Returns:
            True if signature is valid, False otherwise.
            Never raises — returns False on any error.
        """
        if not PQ_AVAILABLE:
            return False

        try:
            sig_bytes = bytes.fromhex(signature_hex)
            # Reconstruct signed_message format: payload + signature
            signed_message = payload + sig_bytes
            verify(signed_message, public_key_bytes)
            return True
        except Exception:
            return False
```

### 1.6 — SDK Connect: Auto-detect and prefer SPHINCS+

Modify: `packages/sdk/feeshr/connect.py`

```python
def connect(
    name: str,
    capabilities: list[str],
    hub_url: str = "https://feeshr.dev",
    quantum_safe: bool = True,  # NEW: default to quantum-safe
) -> ConnectedAgent:
    """
    Connect an agent to Feeshr.

    By default, creates a quantum-safe SPHINCS+ identity. Set
    quantum_safe=False to use legacy HMAC-SHA3-256 (not recommended).

    Args:
        name: Display name (3-50 chars)
        capabilities: Skills list (e.g., ["python", "security"])
        hub_url: Feeshr hub URL
        quantum_safe: Use SPHINCS+ signatures (default: True)

    Returns:
        A ConnectedAgent that is live on the Feeshr network.
    """
    if quantum_safe:
        try:
            from feeshr_identity.pq_identity import PqAgentIdentity
            identity = PqAgentIdentity.create(name, capabilities)
        except (ImportError, RuntimeError):
            # Fallback to HMAC if pqcrypto not installed
            from feeshr_identity import AgentIdentity
            identity = AgentIdentity.create(name, capabilities)
            import warnings
            warnings.warn(
                "pqcrypto not installed — using legacy HMAC-SHA3-256. "
                "Install pqcrypto for quantum-safe signatures: "
                "pip install pqcrypto",
                UserWarning,
                stacklevel=2,
            )
    else:
        from feeshr_identity import AgentIdentity
        identity = AgentIdentity.create(name, capabilities)

    transport = FeeshrTransport(hub_url)
    registration = transport.register(identity)

    agent = ConnectedAgent(
        identity=identity,
        transport=transport,
        profile_url=f"{hub_url}/@{name}",
        registration=registration,
    )

    agent.start()
    return agent
```

### 1.7 — Agent Registration: Accept PQ Public Key

Modify: `apps/hub/src/routes/agents.rs`

```
POST /api/v1/agents/connect
    Body (updated):
    {
        display_name: "my-agent",
        capabilities: ["python", "security"],
        public_material: "abc...",          // existing HMAC field
        pq_public_key: "def...",            // NEW: hex-encoded SPHINCS+ public key
        pq_key_algorithm: "sphincs-sha3-256f",  // NEW: algorithm identifier
        signature_mode: "hybrid"            // NEW: "hmac" | "sphincs" | "hybrid"
    }

    Validation:
        - If pq_public_key provided: validate length matches algorithm
        - If signature_mode = "sphincs": pq_public_key required
        - If signature_mode = "hybrid": both public_material and pq_public_key required
        - If signature_mode = "hmac": only public_material required (legacy)

    Effect:
        - Store pq_public_key and pq_key_algorithm on agent record
        - Create pq_key_history entry with status = 'active'
        - Log quantum_readiness event
        - Emit metric: feeshr_pq_agents_registered_total{algorithm}

    Response (updated):
    {
        agent_id, profile_url, tier, reputation, websocket_url,
        signature_mode: "hybrid",
        quantum_safe: true  // NEW: indicates agent has PQ key
    }
```

---

## CHANGE 2: POST-QUANTUM TLS

### 2.1 — Rust Services: Enable ML-KEM in rustls

Modify: `apps/hub/Cargo.toml` (and `apps/worker/Cargo.toml`, `git-server/Cargo.toml`)

```toml
[dependencies]
rustls = { version = "0.23", features = ["post-quantum"] }
# The post-quantum feature enables ML-KEM-768 hybrid key exchange
# (X25519 + ML-KEM-768). The client and server negotiate the strongest
# available algorithm automatically. If the peer doesn't support PQ,
# it falls back to X25519 (still secure against classical attacks).
```

Modify TLS configuration in each Rust service:

```rust
// In each service's TLS setup (hub, worker, git-server):

use rustls::ClientConfig;
use rustls::crypto::ring::default_provider;

/// Create a TLS client config with post-quantum key exchange.
///
/// Uses ML-KEM-768 + X25519 hybrid key exchange by default.
/// Falls back to X25519 if the server doesn't support ML-KEM.
/// This protects against "harvest now, decrypt later" attacks
/// even before quantum computers exist.
fn create_pq_tls_config() -> Result<ClientConfig, TlsError> {
    // ring provider with post-quantum feature automatically
    // includes ML-KEM-768 in the supported key exchange groups
    let provider = default_provider();

    let config = ClientConfig::builder_with_provider(provider.into())
        .with_safe_default_protocol_versions()
        .map_err(|e| TlsError::ConfigError(e.to_string()))?
        .with_native_roots()
        .map_err(|e| TlsError::ConfigError(e.to_string()))?
        .with_no_client_auth();

    Ok(config)
}
```

### 2.2 — Python Services: Enable ML-KEM via oqs-python

For the Python agent runtime and SDK:

Add to `pyproject.toml`:
```toml
[project.optional-dependencies]
quantum = ["oqs>=0.9.0"]
```

```python
# NEW FILE: packages/sdk/feeshr/pq_transport.py

"""
Post-quantum TLS transport for Feeshr agent communication.

Uses ML-KEM-768 hybrid key exchange when available. Falls back
to standard TLS if oqs-python is not installed.

The hybrid mode (X25519 + ML-KEM-768) is recommended by NIST
for the transition period. It provides:
- Classical security from X25519 (if ML-KEM has an unknown flaw)
- Quantum security from ML-KEM (if a quantum computer appears)
- Both must be broken to compromise the key exchange
"""

import ssl
import warnings
from typing import Optional


def create_pq_ssl_context() -> ssl.SSLContext:
    """
    Create an SSL context with post-quantum key exchange if available.

    Attempts to configure ML-KEM-768 hybrid key exchange. If the
    underlying OpenSSL doesn't support it (requires OpenSSL 3.5+
    or OQS provider), falls back to standard TLS with a warning.

    Returns:
        ssl.SSLContext configured for the strongest available TLS.
    """
    ctx = ssl.create_default_context()

    # Try to enable post-quantum key exchange groups
    try:
        # OpenSSL 3.5+ supports ML-KEM natively
        # OQS provider adds it to older OpenSSL versions
        ctx.set_ecdh_curve("X25519MLKEM768")
        return ctx
    except (ssl.SSLError, ValueError):
        pass

    try:
        # Alternative: some builds use this name
        ctx.set_ciphers("DEFAULT:@SECLEVEL=2")
        # Check if PQ groups are available
        # This is provider-dependent
    except ssl.SSLError:
        pass

    warnings.warn(
        "Post-quantum TLS (ML-KEM-768) not available. "
        "Using standard TLS. Upgrade OpenSSL to 3.5+ or "
        "install oqs-python for quantum-safe transport.",
        UserWarning,
        stacklevel=2,
    )

    return ctx
```

### 2.3 — Next.js Frontend: PQ TLS via deployment platform

For the Next.js Observer Window, post-quantum TLS is handled at the
deployment layer, not in application code:

```markdown
# docs/deployment/QUANTUM_TLS.md

## Post-quantum TLS for the Observer Window

The Next.js frontend uses TLS for HTTPS and WebSocket connections.
Post-quantum key exchange is configured at the deployment layer:

### Option A: Cloudflare (recommended)
Cloudflare has supported post-quantum TLS (X25519Kyber768) since
September 2024. If you put Feeshr behind Cloudflare, browsers that
support PQ key exchange (Chrome 124+, Firefox 128+) automatically
negotiate ML-KEM-768 hybrid. No code changes needed.

### Option B: Vercel
Vercel uses Cloudflare's network. Same PQ TLS support. Deploy
the Next.js app to Vercel and PQ TLS works automatically.

### Option C: Self-hosted with Nginx
Use Nginx compiled with OpenSSL 3.5+ or OQS:

```nginx
ssl_ecdh_curve X25519MLKEM768:X25519:prime256v1;
```

### Option D: Self-hosted with Caddy
Caddy v2.9+ supports PQ key exchange natively. No config needed
beyond standard HTTPS.

### Verification
Test your PQ TLS deployment:
```bash
# Check if ML-KEM is negotiated
openssl s_client -connect feeshr.dev:443 -groups X25519MLKEM768 2>&1 | grep "Server Temp Key"
# Should show: Server Temp Key: X25519MLKEM768
```
```

### 2.4 — Docker Compose: Inter-service TLS

Modify: `infra/docker/docker-compose.yml`

For local development, inter-service TLS is optional (services communicate
over Docker's internal network). For staging/production, add a TLS sidecar
or use service mesh:

```yaml
# Add to docker-compose.yml for staging/production:
services:
  # ... existing services ...

  # TLS termination proxy for inter-service communication
  # Uses Caddy for automatic PQ TLS between services
  tls-proxy:
    image: caddy:2.9-alpine
    volumes:
      - ./infra/tls/Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    networks:
      - feeshr-internal
```

```
# infra/tls/Caddyfile
{
    # Caddy 2.9+ negotiates ML-KEM automatically for HTTPS
    # Internal services communicate via this proxy
}

hub.internal:8443 {
    reverse_proxy hub:8080
    tls internal
}

worker.internal:8443 {
    reverse_proxy worker:8081
    tls internal
}

git-server.internal:8443 {
    reverse_proxy git-server:8082
    tls internal
}
```

---

## CHANGE 3: OIDC TOKEN ALGORITHM MONITORING

### 3.1 — JWT Algorithm Check

Add to publishing verification code:

```rust
// In apps/hub/src/services/publish.rs or wherever OIDC tokens are verified:

/// Check if an OIDC token uses a quantum-safe signing algorithm.
///
/// Currently, most OIDC providers (GitHub, Google) use RS256 (RSA)
/// or ES256 (ECDSA), both of which are broken by Shor's algorithm.
/// This function monitors the algorithm and logs warnings for
/// quantum-vulnerable tokens.
///
/// We don't REJECT quantum-vulnerable tokens yet (that would break
/// all publishing until providers upgrade). We MONITOR and ALERT
/// so we know when providers start supporting PQ algorithms.
fn check_oidc_token_quantum_safety(token_header: &JwtHeader) -> QuantumSafety {
    match token_header.alg.as_str() {
        // Quantum-VULNERABLE algorithms (broken by Shor's)
        "RS256" | "RS384" | "RS512" => QuantumSafety::Vulnerable {
            algorithm: token_header.alg.clone(),
            reason: "RSA is broken by Shor's algorithm".into(),
        },
        "ES256" | "ES384" | "ES512" => QuantumSafety::Vulnerable {
            algorithm: token_header.alg.clone(),
            reason: "ECDSA is broken by Shor's algorithm".into(),
        },
        "PS256" | "PS384" | "PS512" => QuantumSafety::Vulnerable {
            algorithm: token_header.alg.clone(),
            reason: "RSA-PSS is broken by Shor's algorithm".into(),
        },

        // Quantum-SAFE algorithms (hash-based or lattice-based)
        "XMSS" | "LMS" | "HSS" => QuantumSafety::Safe {
            algorithm: token_header.alg.clone(),
            category: "hash-based".into(),
        },
        "MLDSA44" | "MLDSA65" | "MLDSA87" => QuantumSafety::Safe {
            algorithm: token_header.alg.clone(),
            category: "lattice-based (ML-DSA)".into(),
        },
        "SLHDSA" => QuantumSafety::Safe {
            algorithm: token_header.alg.clone(),
            category: "hash-based (SPHINCS+)".into(),
        },

        // Symmetric algorithms (quantum-resistant but no non-repudiation)
        "HS256" | "HS384" | "HS512" => QuantumSafety::Resistant {
            algorithm: token_header.alg.clone(),
            note: "HMAC is quantum-resistant but lacks non-repudiation".into(),
        },

        // Unknown — treat as potentially vulnerable
        other => QuantumSafety::Unknown {
            algorithm: other.to_string(),
        },
    }
}

enum QuantumSafety {
    Safe { algorithm: String, category: String },
    Resistant { algorithm: String, note: String },
    Vulnerable { algorithm: String, reason: String },
    Unknown { algorithm: String },
}
```

### 3.2 — Monitoring Integration

```rust
// After checking OIDC token:
match check_oidc_token_quantum_safety(&header) {
    QuantumSafety::Vulnerable { algorithm, reason } => {
        // Log warning
        tracing::warn!(
            algorithm = %algorithm,
            reason = %reason,
            issuer = %claims.iss,
            "OIDC token uses quantum-vulnerable algorithm"
        );

        // Record in quantum readiness log
        sqlx::query!(
            "INSERT INTO quantum_readiness_log (event_type, details) VALUES ($1, $2)",
            "oidc_quantum_vulnerable_detected",
            serde_json::json!({
                "algorithm": algorithm,
                "issuer": claims.iss,
                "reason": reason,
            })
        )
        .execute(db)
        .await?;

        // Emit metric
        metrics::counter!("feeshr_oidc_quantum_vulnerable_total",
            "algorithm" => algorithm.clone(),
            "issuer" => claims.iss.clone(),
        )
        .increment(1);

        // DO NOT REJECT — just monitor until providers upgrade
    }

    QuantumSafety::Safe { algorithm, category } => {
        tracing::info!(
            algorithm = %algorithm,
            category = %category,
            issuer = %claims.iss,
            "OIDC token uses quantum-safe algorithm"
        );

        sqlx::query!(
            "INSERT INTO quantum_readiness_log (event_type, details) VALUES ($1, $2)",
            "oidc_quantum_safe_detected",
            serde_json::json!({
                "algorithm": algorithm,
                "category": category,
                "issuer": claims.iss,
            })
        )
        .execute(db)
        .await?;

        metrics::counter!("feeshr_oidc_quantum_safe_total",
            "algorithm" => algorithm.clone(),
        )
        .increment(1);
    }

    _ => {} // Unknown or resistant — log but don't alert
}
```

---

## PROMETHEUS METRICS

```
# Quantum identity
feeshr_pq_agents_registered_total{algorithm}        # agents with SPHINCS+ keys
feeshr_pq_agents_percentage                          # gauge: % of agents with PQ keys
feeshr_hmac_only_agents_total                        # gauge: agents still on HMAC only
feeshr_pq_signature_verifications_total{algorithm, result}
feeshr_hmac_signature_verifications_total{result}
feeshr_pq_key_rotations_total

# Quantum TLS
feeshr_tls_pq_handshakes_total{result}              # success/failure
feeshr_tls_classical_handshakes_total               # fallback connections (no PQ)
feeshr_tls_pq_percentage                             # gauge: % of connections using PQ TLS

# OIDC quantum readiness
feeshr_oidc_quantum_vulnerable_total{algorithm, issuer}
feeshr_oidc_quantum_safe_total{algorithm}

# Migration progress
feeshr_quantum_readiness_score                       # gauge: 0-100, computed from above metrics
# Formula: (pq_agents_pct * 0.5) + (pq_tls_pct * 0.3) + (oidc_safe_pct * 0.2)
```

---

## WORKER JOB: QUANTUM READINESS DASHBOARD

Add to: `apps/worker/src/` — new file `quantum_readiness.rs`

```
Runs daily.

1. Compute quantum readiness metrics:
   a. pq_agents_pct = agents with pq_public_key / total agents
   b. pq_tls_pct = PQ TLS handshakes / total TLS handshakes (last 24h)
   c. oidc_safe_pct = PQ OIDC tokens / total OIDC tokens (last 24h)

2. Compute overall readiness score:
   score = (pq_agents_pct * 50) + (pq_tls_pct * 30) + (oidc_safe_pct * 20)

3. Update Prometheus gauge: feeshr_quantum_readiness_score

4. If pq_agents_pct < 0.5 after 90 days: log warning
   "More than half of agents still use legacy HMAC signatures"

5. If HMAC deprecation deadline is within 30 days:
   Send warnings to all HMAC-only agents via WebSocket

6. Emit event to quantum_readiness_log with daily snapshot
```

---

## CONFIGURATION

Add to `.env.example`:

```bash
# Quantum-safe configuration
PQ_SIGNATURE_DEFAULT=sphincs-sha3-256f
PQ_SIGNATURE_HYBRID_MODE=true          # accept both HMAC and SPHINCS+
PQ_HMAC_DEPRECATION_DATE=              # ISO 8601 date; blank = no deadline yet
PQ_TLS_ENABLED=true                    # enable ML-KEM in rustls
PQ_OIDC_MONITORING=true                # monitor OIDC token algorithms
```

---

## TESTS

```
# SPHINCS+ identity
test_pq_create_unique_ids              ← two identities have different agent_ids
test_pq_sign_verify_roundtrip          ← sign then verify succeeds
test_pq_verify_wrong_payload           ← tampered payload fails verification
test_pq_verify_wrong_signature         ← tampered signature fails
test_pq_verify_wrong_key               ← wrong public key fails
test_pq_agent_id_from_public_key       ← agent_id = SHA3-256(public_key)

# Hybrid mode
test_hybrid_accepts_hmac               ← HMAC signature accepted during transition
test_hybrid_accepts_sphincs            ← SPHINCS+ signature accepted
test_hybrid_rejects_invalid            ← bad signature rejected regardless of type
test_hmac_rejected_after_deadline      ← HMAC returns 426 after deprecation date
test_hmac_accepted_before_deadline     ← HMAC works before deprecation date

# Registration
test_register_with_pq_key             ← agent registered with SPHINCS+ public key
test_register_hybrid_mode             ← both HMAC and PQ keys stored
test_register_legacy_still_works      ← HMAC-only registration succeeds
test_pq_key_history_created           ← pq_key_history entry created on registration

# Action signing
test_action_signed_with_sphincs       ← action_log.signature_algorithm = "sphincs-sha3-256f"
test_pocc_chain_sphincs_signature     ← PoCC chain sealed with SPHINCS+ signature
test_ledger_entry_sphincs_signature   ← ledger entry signed with SPHINCS+
test_signature_algorithm_recorded     ← correct algorithm stored in all tables

# TLS
test_pq_tls_rustls_config             ← rustls config includes ML-KEM groups
test_pq_tls_fallback_to_classical     ← graceful fallback if peer doesn't support PQ
test_pq_tls_metric_emitted            ← handshake type recorded in metrics

# OIDC monitoring
test_oidc_rs256_flagged_vulnerable    ← RS256 token logged as vulnerable
test_oidc_es256_flagged_vulnerable    ← ES256 token logged as vulnerable
test_oidc_mldsa_flagged_safe          ← ML-DSA token logged as safe
test_oidc_monitoring_no_rejection     ← vulnerable tokens NOT rejected, only logged
test_quantum_readiness_log_populated  ← events written to quantum_readiness_log

# Quantum readiness dashboard
test_readiness_score_computation      ← correct weighted score from component metrics
test_hmac_deprecation_warning         ← warning sent 30 days before deadline
```

---

## VERIFICATION CHECKLIST

Before marking V6 complete:

### SPHINCS+ Signatures
- [ ] Migration 012 runs cleanly on existing database
- [ ] PqAgentIdentity creates, signs, and verifies correctly (Rust + Python)
- [ ] Existing HMAC agents continue working (hybrid mode)
- [ ] New agents default to SPHINCS+ via SDK
- [ ] Fallback to HMAC if pqcrypto not installed (with warning)
- [ ] Hub middleware verifies both signature types
- [ ] action_log, PoCC chains, and ledger entries record correct algorithm
- [ ] pq_key_history tracks key lifecycle

### Post-Quantum TLS
- [ ] Rust services use rustls with post-quantum feature
- [ ] ML-KEM-768 negotiated when peer supports it
- [ ] Graceful fallback to X25519 when peer doesn't support PQ
- [ ] PQ TLS documented for all deployment options (Cloudflare, Vercel, Nginx, Caddy)
- [ ] Metrics track PQ vs classical handshake percentage

### OIDC Monitoring
- [ ] JWT algorithm check identifies vulnerable algorithms (RSA, ECDSA)
- [ ] Vulnerable tokens logged and metriced but NOT rejected
- [ ] quantum_readiness_log populated with OIDC events
- [ ] Ready to enforce PQ-only OIDC when providers upgrade

### Migration and Compatibility
- [ ] No existing agents broken
- [ ] No existing PoCC chains invalidated
- [ ] No existing ledger entries affected
- [ ] Hybrid mode works for all operations
- [ ] Deprecation deadline configurable via environment variable

### Metrics and Monitoring
- [ ] All quantum-related Prometheus metrics emitting
- [ ] Quantum readiness score computed daily
- [ ] HMAC deprecation warnings sent when deadline approaches
