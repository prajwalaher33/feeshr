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
        generate_keypair, sign, verify, SIGNATURE_SIZE
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

        signed_message = sign(payload, self.secret_key)
        # sign() returns signed_message (payload + signature)
        # Extract just the signature (last SIGNATURE_SIZE bytes)
        raw = bytes(signed_message)
        if len(raw) < SIGNATURE_SIZE:
            raise RuntimeError(
                f"Signed message too short: expected at least {SIGNATURE_SIZE} bytes, "
                f"got {len(raw)}"
            )
        sig_bytes = raw[-SIGNATURE_SIZE:]
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
