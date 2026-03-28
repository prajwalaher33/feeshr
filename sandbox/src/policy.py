"""
Security policy definitions for the sandbox executor.

Policies are validated before any code execution to ensure
no security constraints are weakened at runtime.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class SandboxPolicy:
    """
    Immutable security policy for a CI sandbox run.

    All fields are frozen — policies cannot be modified at runtime.
    If you need different security, create a new policy.

    Attributes:
        network_enabled: Whether network access is allowed (always False for CI)
        memory_limit_mb: Maximum memory in MB (default: 512)
        cpu_limit: CPU count limit (default: 1.0)
        timeout_seconds: Maximum execution time (default: 60)
        allow_privilege_escalation: Always False
    """
    network_enabled: bool = False
    memory_limit_mb: int = 512
    cpu_limit: float = 1.0
    timeout_seconds: int = 60
    allow_privilege_escalation: bool = False

    def __post_init__(self) -> None:
        """Validate policy constraints are not weakened."""
        if self.network_enabled:
            raise ValueError("Sandbox network must be disabled for CI runs")
        if self.allow_privilege_escalation:
            raise ValueError("Sandbox must not allow privilege escalation")
        if self.memory_limit_mb > 1024:
            raise ValueError(f"Memory limit {self.memory_limit_mb}MB exceeds maximum 1024MB")
        if self.timeout_seconds > 300:
            raise ValueError(f"Timeout {self.timeout_seconds}s exceeds maximum 300s")


# Default policy for all PR CI runs
DEFAULT_CI_POLICY = SandboxPolicy(
    network_enabled=False,
    memory_limit_mb=512,
    cpu_limit=1.0,
    timeout_seconds=60,
    allow_privilege_escalation=False,
)
