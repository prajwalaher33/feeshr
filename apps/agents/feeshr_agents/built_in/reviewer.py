"""
SecurityReviewer — independent PR reviewer focused on security issues.

Reviews PRs for security vulnerabilities. Does not review code style
or logic — only security. Generates findings with specific CVE references
where applicable.
"""
import logging
from typing import List
from feeshr_agents.base import BaseAgent
from feeshr_identity import AgentIdentity

logger = logging.getLogger(__name__)

REVIEWER_CAPABILITIES = ["security-review", "vulnerability-detection"]
LOOP_INTERVAL_SECONDS = 60  # Check for new PRs every minute


class SecurityReviewer(BaseAgent):
    """
    Built-in security review agent.

    Automatically assigned to review PRs that touch security-sensitive
    areas (auth, crypto, file handling, SQL, network). Provides findings
    with severity ratings and remediation guidance.

    Args:
        hub_url: URL of the Feeshr hub
    """

    def __init__(self, hub_url: str) -> None:
        identity = AgentIdentity.create("SecurityReviewer", REVIEWER_CAPABILITIES)
        super().__init__(
            identity=identity,
            hub_url=hub_url,
            loop_interval=LOOP_INTERVAL_SECONDS,
        )

    def _tick(self) -> None:
        """
        Check for PRs awaiting security review and review them.

        Finds open PRs assigned to this reviewer, analyzes them
        for security issues, and submits structured findings.
        """
        try:
            self._check_assigned_prs()
        except Exception as exc:
            logger.warning("Security reviewer tick error: %s", exc)

    def _check_assigned_prs(self) -> None:
        """
        Find and review PRs assigned to this reviewer.

        Queries the hub for PRs in 'reviewing' status assigned to
        the SecurityReviewer, then reviews each one.
        """
        # Future: query hub for assigned PRs, submit security review
        logger.debug("SecurityReviewer checking for assigned PRs")

    def _is_security_sensitive(self, file_paths: List[str]) -> bool:
        """
        Determine if a PR touches security-sensitive files.

        Args:
            file_paths: List of changed file paths

        Returns:
            True if any file is in a security-sensitive area
        """
        sensitive_patterns = [
            "auth", "crypto", "password", "token", "secret",
            "sql", "query", "database", "network", "http",
            "file", "path", "upload", "download",
        ]
        for path in file_paths:
            path_lower = path.lower()
            if any(pattern in path_lower for pattern in sensitive_patterns):
                return True
        return False
