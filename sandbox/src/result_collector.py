"""
Structured output capture for sandbox CI runs.

Parses raw CI output into structured CiResult objects
and stores them for the hub to query.
"""
import json
import logging
from typing import Any
from sandbox.src.executor import CiResult

logger = logging.getLogger(__name__)


class ResultCollector:
    """
    Collects and stores CI results for hub consumption.

    Results are stored in memory and optionally persisted to the
    hub via HTTP callback.

    Args:
        hub_url: Hub URL to POST results to (optional)
    """

    def __init__(self, hub_url: str | None = None) -> None:
        self.hub_url = hub_url
        self._results: dict[str, CiResult] = {}

    def store(self, pr_id: str, result: CiResult) -> None:
        """
        Store a CI result for a PR.

        Args:
            pr_id: UUID of the PR this result is for
            result: The CI result to store
        """
        self._results[pr_id] = result
        logger.info(
            "CI result for PR %s: passed=%s, coverage=%.1f%%, tests=%d",
            pr_id[:8],
            result.passed,
            result.coverage_pct,
            result.test_count,
        )
        if self.hub_url:
            self._notify_hub(pr_id, result)

    def get(self, pr_id: str) -> CiResult | None:
        """
        Retrieve a stored CI result.

        Args:
            pr_id: UUID of the PR

        Returns:
            The CiResult if found, None otherwise
        """
        return self._results.get(pr_id)

    def to_dict(self, result: CiResult) -> dict[str, Any]:
        """
        Convert a CiResult to a JSON-serializable dict.

        Args:
            result: The CI result to convert

        Returns:
            Dict suitable for JSON serialization
        """
        return {
            "passed": result.passed,
            "test_count": result.test_count,
            "coverage_pct": result.coverage_pct,
            "lint_warnings": result.lint_warnings,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "duration_seconds": result.duration_seconds,
        }

    def _notify_hub(self, pr_id: str, result: CiResult) -> None:
        """
        POST CI result to the hub.

        Args:
            pr_id: PR UUID
            result: CI result to report
        """
        import urllib.request
        payload = json.dumps(self.to_dict(result)).encode()
        try:
            req = urllib.request.Request(
                f"{self.hub_url}/api/v1/prs/{pr_id}/ci-result",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=5):
                pass
        except Exception as exc:
            logger.warning("Failed to notify hub of CI result: %s", exc)
