"""Tests for feeshr_identity.pq_identity module (SPHINCS+ post-quantum signatures)."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest

# These tests only run if pqcrypto is installed.
try:
    from feeshr_identity.pq_identity import PqAgentIdentity, PQ_AVAILABLE
except ImportError:
    PQ_AVAILABLE = False

pytestmark = pytest.mark.skipif(not PQ_AVAILABLE, reason="pqcrypto not installed")


def test_pq_create_unique_ids():
    """Two PQ identities have different agent_ids."""
    id1 = PqAgentIdentity.create("agent-one", ["python"])
    id2 = PqAgentIdentity.create("agent-two", ["python"])
    assert id1.agent_id != id2.agent_id
    assert len(id1.agent_id) == 64  # SHA3-256 hex


def test_pq_sign_verify_roundtrip():
    """Sign then verify succeeds with correct key."""
    identity = PqAgentIdentity.create("test-agent", ["rust"])
    payload = b"hello feeshr quantum"
    signature = identity.sign(payload)
    assert PqAgentIdentity.verify(payload, signature, identity.public_key)


def test_pq_verify_wrong_payload():
    """Tampered payload fails verification."""
    identity = PqAgentIdentity.create("test-agent", ["rust"])
    signature = identity.sign(b"original payload")
    assert not PqAgentIdentity.verify(b"tampered payload", signature, identity.public_key)


def test_pq_verify_wrong_signature():
    """Tampered signature fails verification."""
    identity = PqAgentIdentity.create("test-agent", ["rust"])
    payload = b"test payload"
    sig = identity.sign(payload)
    # Flip some bytes in the signature
    bad_sig = "ff" * (len(sig) // 2)
    assert not PqAgentIdentity.verify(payload, bad_sig, identity.public_key)


def test_pq_verify_wrong_key():
    """Wrong public key fails verification."""
    id1 = PqAgentIdentity.create("agent-one", ["python"])
    id2 = PqAgentIdentity.create("agent-two", ["python"])
    payload = b"test payload"
    sig = id1.sign(payload)
    assert not PqAgentIdentity.verify(payload, sig, id2.public_key)


def test_pq_agent_id_from_public_key():
    """agent_id is SHA3-256 of the public key."""
    import hashlib
    identity = PqAgentIdentity.create("test-agent", ["rust"])
    expected_id = hashlib.sha3_256(identity.public_key).hexdigest()
    assert identity.agent_id == expected_id


def test_pq_algorithm_field():
    """Algorithm field is always sphincs-sha3-256f."""
    identity = PqAgentIdentity.create("test-agent", ["rust"])
    assert identity.algorithm == "sphincs-sha3-256f"
    assert identity.ALGORITHM == "sphincs-sha3-256f"
