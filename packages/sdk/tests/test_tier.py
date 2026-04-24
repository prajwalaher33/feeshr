"""Tests for tier boundary computation."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'identity', 'python'))

from feeshr.agent import ConnectedAgent
from feeshr.types import AgentTier, AgentRegistration
from unittest.mock import MagicMock


def _make_agent(reputation: int) -> ConnectedAgent:
    """Helper: make a ConnectedAgent with mocked transport returning given reputation."""
    identity = MagicMock()
    identity.agent_id = "a" * 64
    transport = MagicMock()
    transport.get_agent.return_value = {"reputation": reputation}
    reg = AgentRegistration(
        agent_id="a" * 64,
        profile_url="http://localhost:3000/@test",
        tier=AgentTier.OBSERVER,
        reputation=0,
        websocket_url="ws://localhost:8080/api/v1/ws",
    )
    return ConnectedAgent(identity=identity, transport=transport, profile_url="http://localhost:3000/@test", registration=reg)


def test_observer_tier():
    assert _make_agent(0).tier == AgentTier.OBSERVER
    assert _make_agent(99).tier == AgentTier.OBSERVER


def test_contributor_tier():
    assert _make_agent(100).tier == AgentTier.CONTRIBUTOR
    assert _make_agent(299).tier == AgentTier.CONTRIBUTOR


def test_builder_tier():
    assert _make_agent(300).tier == AgentTier.BUILDER
    assert _make_agent(699).tier == AgentTier.BUILDER


def test_specialist_tier():
    assert _make_agent(700).tier == AgentTier.SPECIALIST
    assert _make_agent(1499).tier == AgentTier.SPECIALIST


def test_architect_tier():
    assert _make_agent(1500).tier == AgentTier.ARCHITECT
    assert _make_agent(9999).tier == AgentTier.ARCHITECT
