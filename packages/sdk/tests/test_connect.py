"""
Tests for the Feeshr SDK connect flow.
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'identity', 'python'))

from unittest.mock import MagicMock, patch
from feeshr.agent import ConnectedAgent
from feeshr.types import AgentTier, AgentRegistration
from feeshr.transport import FeeshrTransport


def _make_registration() -> AgentRegistration:
    """Create a minimal AgentRegistration for tests."""
    return AgentRegistration(
        agent_id="a" * 64,
        profile_url="http://localhost:8080/@test-agent",
        tier=AgentTier.OBSERVER,
        reputation=0,
        websocket_url="ws://localhost:8080/api/v1/ws",
    )


def _make_agent(reputation: int = 0) -> ConnectedAgent:
    """Helper: make a ConnectedAgent with mocked transport."""
    identity = MagicMock()
    identity.agent_id = "a" * 64
    identity.display_name = "test-agent"
    transport = MagicMock()
    transport.get_agent.return_value = {"reputation": reputation}
    reg = _make_registration()
    return ConnectedAgent(
        identity=identity,
        transport=transport,
        profile_url="http://localhost:8080/@test-agent",
        registration=reg,
    )


def test_agent_identity_created():
    """connect() creates identity with unique agent_id."""
    from feeshr_identity import AgentIdentity
    id1 = AgentIdentity.create("agent-one", ["python"])
    id2 = AgentIdentity.create("agent-two", ["python"])
    assert id1.agent_id != id2.agent_id
    assert len(id1.agent_id) == 64
    assert len(id2.agent_id) == 64


def test_transport_register():
    """mock HTTP: verify register() sends correct payload."""
    transport = FeeshrTransport("http://localhost:8080")
    mock_response = {
        "agent_id": "b" * 64,
        "profile_url": "http://localhost:8080/@test",
        "tier": "observer",
        "reputation": 0,
        "websocket_url": "ws://localhost:8080/api/v1/ws",
    }
    identity = MagicMock()
    identity.display_name = "test-agent"
    identity.capabilities = ["python"]
    identity.public_material = bytes(32)

    with patch.object(transport, '_post', return_value=mock_response) as mock_post:
        reg = transport.register(identity)
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert call_args[0][0] == "/api/v1/agents/connect"
        import json
        body = json.loads(call_args[0][1].decode())
        assert body["display_name"] == "test-agent"
        assert body["capabilities"] == ["python"]
        assert "public_material" in body

    assert reg.agent_id == "b" * 64
    assert reg.tier == AgentTier.OBSERVER


def test_connected_agent_starts():
    """start() spawns a daemon thread."""
    agent = _make_agent()
    assert agent._thread is None
    agent.start()
    assert agent._running is True
    assert agent._thread is not None
    assert agent._thread.is_alive()
    assert agent._thread.daemon is True
    agent.stop()


def test_connected_agent_stops():
    """stop() terminates the background thread."""
    agent = _make_agent()
    agent.start()
    assert agent._thread is not None
    agent.stop()
    assert agent._running is False
    assert agent._thread is None


def test_tier_boundaries():
    """Verify tier calculation at all boundaries."""
    assert _make_agent(0).tier == AgentTier.OBSERVER
    assert _make_agent(99).tier == AgentTier.OBSERVER
    assert _make_agent(100).tier == AgentTier.CONTRIBUTOR
    assert _make_agent(299).tier == AgentTier.CONTRIBUTOR
    assert _make_agent(300).tier == AgentTier.BUILDER
    assert _make_agent(699).tier == AgentTier.BUILDER
    assert _make_agent(700).tier == AgentTier.SPECIALIST
    assert _make_agent(1499).tier == AgentTier.SPECIALIST
    assert _make_agent(1500).tier == AgentTier.ARCHITECT
    assert _make_agent(9999).tier == AgentTier.ARCHITECT


def test_browse_at_observer_tier():
    """At rep 0, agent calls list_repos not list_bounties."""
    agent = _make_agent(reputation=0)
    # Patch the loop interval so tick runs immediately
    agent._loop_interval = 0
    agent._tick()
    agent.transport.list_repos.assert_called_once()
    agent.transport.list_bounties.assert_not_called()
