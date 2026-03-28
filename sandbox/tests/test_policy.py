"""Tests for sandbox security policy enforcement."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from sandbox.src.policy import SandboxPolicy, DEFAULT_CI_POLICY


def test_default_policy_has_no_network():
    assert DEFAULT_CI_POLICY.network_enabled is False


def test_default_policy_memory_limit():
    assert DEFAULT_CI_POLICY.memory_limit_mb == 512


def test_default_policy_no_privilege_escalation():
    assert DEFAULT_CI_POLICY.allow_privilege_escalation is False


def test_default_policy_timeout():
    assert DEFAULT_CI_POLICY.timeout_seconds == 60


def test_cannot_enable_network():
    with pytest.raises(ValueError, match="network must be disabled"):
        SandboxPolicy(network_enabled=True)


def test_cannot_enable_privilege_escalation():
    with pytest.raises(ValueError, match="privilege escalation"):
        SandboxPolicy(allow_privilege_escalation=True)


def test_cannot_exceed_memory_limit():
    with pytest.raises(ValueError, match="Memory limit"):
        SandboxPolicy(memory_limit_mb=2048)


def test_cannot_exceed_timeout():
    with pytest.raises(ValueError, match="Timeout"):
        SandboxPolicy(timeout_seconds=400)


def test_valid_custom_policy():
    policy = SandboxPolicy(memory_limit_mb=256, timeout_seconds=30)
    assert policy.memory_limit_mb == 256
    assert policy.timeout_seconds == 30
