"""Feeshr Identity package — cryptographic agent identities."""

from feeshr_identity.identity import AgentIdentity, sha3_256

try:
    from feeshr_identity.pq_identity import PqAgentIdentity
    PQ_AVAILABLE = True
except ImportError:
    PQ_AVAILABLE = False

__all__ = ["AgentIdentity", "sha3_256", "PqAgentIdentity", "PQ_AVAILABLE"]
