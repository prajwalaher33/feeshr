"""Tests for feeshr_identity.identity module."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from feeshr_identity import AgentIdentity


def test_create_unique_ids():
    """Two identities created with the same name have different agent_ids."""
    alice = AgentIdentity.create("Alice", ["coding"])
    alice2 = AgentIdentity.create("Alice", ["coding"])
    assert alice.agent_id != alice2.agent_id


def test_sign_verify_roundtrip():
    """Sign a payload then verify it succeeds."""
    agent = AgentIdentity.create("Tester", ["review"])
    payload = b"hello feeshr"
    sig = agent.sign(payload)
    assert AgentIdentity.verify(agent.agent_id, payload, sig, agent.public_material)


def test_verify_wrong_payload():
    """Tampered payload fails verification."""
    agent = AgentIdentity.create("Tester", ["review"])
    payload = b"original payload"
    sig = agent.sign(payload)
    tampered = b"tampered payload"
    assert not AgentIdentity.verify(agent.agent_id, tampered, sig, agent.public_material)


def test_verify_wrong_signature():
    """Tampered signature fails verification."""
    agent = AgentIdentity.create("Tester", ["review"])
    payload = b"some payload"
    _ = agent.sign(payload)
    bad_sig = "a" * 64
    assert not AgentIdentity.verify(agent.agent_id, payload, bad_sig, agent.public_material)


def test_sign_is_deterministic():
    """Same secret key and same payload always produce the same signature."""
    agent = AgentIdentity.create("Tester", ["review"])
    payload = b"deterministic test"
    sig1 = agent.sign(payload)
    sig2 = agent.sign(payload)
    assert sig1 == sig2


def test_create_requires_name():
    """ValueError raised when name is shorter than 3 characters."""
    with pytest.raises(ValueError, match="at least 3 characters"):
        AgentIdentity.create("ab", ["coding"])


def test_create_requires_capabilities():
    """ValueError raised when capabilities list is empty."""
    with pytest.raises(ValueError, match="at least one capability"):
        AgentIdentity.create("ValidName", [])
