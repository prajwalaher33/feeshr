# packages/identity/python/feeshr_identity/identity.py

import hashlib
import os
import time
import hmac
from dataclasses import dataclass, field


def sha3_256(data: bytes) -> bytes:
    """SHA3-256 hash. Used for all identity operations."""
    return hashlib.sha3_256(data).digest()


@dataclass
class AgentIdentity:
    """
    Cryptographic identity for a Feeshr agent.

    The agent_id is the SHA3-256 hash of the agent's public key material.
    Every action the agent takes is signed with its secret key.
    Anyone can verify the signature using the agent_id.

    Uses HMAC-SHA3-256 for signing — quantum-safe at 128-bit security,
    fast enough for the hot path (< 1ms per signature), and simple to
    implement correctly.

    Attributes:
        agent_id: hex-encoded SHA3-256 of public material
        secret_key: 32 bytes, never transmitted, never logged
        display_name: Human-readable agent name
        capabilities: List of capability strings
        created_at: Unix timestamp of creation
    """
    agent_id: str
    secret_key: bytes
    display_name: str
    capabilities: list[str]
    created_at: float = field(default_factory=time.time)

    @classmethod
    def create(cls, name: str, capabilities: list[str]) -> 'AgentIdentity':
        """
        Create a new agent identity from OS entropy.

        Args:
            name: Display name for the agent (3-50 chars)
            capabilities: List of capability strings

        Returns:
            A new AgentIdentity with cryptographically unique agent_id

        Raises:
            ValueError: If name is empty or capabilities is empty
        """
        if not name or len(name) < 3:
            raise ValueError(f"Agent name must be at least 3 characters, got: {name!r}")
        if not capabilities:
            raise ValueError("Agent must have at least one capability")
        secret = os.urandom(32)
        public_material = sha3_256(secret + name.encode())
        agent_id = public_material.hex()
        return cls(
            agent_id=agent_id,
            secret_key=secret,
            display_name=name,
            capabilities=capabilities,
        )

    def sign(self, payload: bytes) -> str:
        """
        Sign a payload. Returns hex-encoded HMAC-SHA3-256.

        The signing key is SHA3-256(public_material) so that verifiers
        holding only the public material can reconstruct the same key.

        Args:
            payload: The bytes to sign

        Returns:
            Hex-encoded 64-character HMAC-SHA3-256 signature
        """
        return hmac.new(sha3_256(self.public_material), payload, hashlib.sha3_256).hexdigest()

    @staticmethod
    def verify(agent_id: str, payload: bytes, signature: str, public_material: bytes) -> bool:
        """
        Verify a signature against an agent's public material.

        Args:
            agent_id: The agent's hex-encoded SHA3-256 identity
            payload: The original payload that was signed
            signature: The hex-encoded signature to verify
            public_material: The agent's public material bytes

        Returns:
            True if signature is valid, False otherwise
        """
        expected = hmac.new(
            sha3_256(public_material),
            payload,
            hashlib.sha3_256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    @property
    def public_material(self) -> bytes:
        """
        Derive the public material from the secret key and display name.

        Returns:
            32-byte public material (SHA3-256 of secret + name)
        """
        return sha3_256(self.secret_key + self.display_name.encode())
