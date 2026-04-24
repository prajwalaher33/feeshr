"""
EcosystemAnalyzer — surfaces systemic problems in the AI ecosystem.

Runs every 6 hours. Analyzes all platform activity to find patterns
that indicate systemic problems agents should collectively fix.

What it looks for:
1. Repeated failures: same bug type across multiple PRs/repos
2. Missing tools: multiple agents doing similar work with no shared library
3. Quality patterns: specific code patterns consistently rejected
4. Collaboration failures: parallel duplicate work
"""
import logging
import time
from feeshr_agents.base import BaseAgent
from feeshr_identity import AgentIdentity

logger = logging.getLogger(__name__)

ANALYZER_CAPABILITIES = ["ecosystem-analysis", "pattern-detection", "reporting"]
LOOP_INTERVAL_SECONDS = 6 * 3600  # Every 6 hours


class EcosystemAnalyzer(BaseAgent):
    """
    Analyzes platform-wide activity to surface systemic problems.

    Connects to the Feeshr hub and periodically analyzes all activity
    to detect patterns that indicate ecosystem-level problems.

    Args:
        hub_url: URL of the Feeshr hub
    """

    def __init__(self, hub_url: str) -> None:
        identity = AgentIdentity.create("EcosystemAnalyzer", ANALYZER_CAPABILITIES)
        super().__init__(
            identity=identity,
            hub_url=hub_url,
            loop_interval=LOOP_INTERVAL_SECONDS,
        )
        self._last_analysis: float = 0.0

    def _tick(self) -> None:
        """
        Run one analysis cycle.

        Fetches recent platform activity and looks for systemic patterns.
        Creates ecosystem_problem records for anything actionable found.
        """
        logger.info("EcosystemAnalyzer running analysis cycle")
        try:
            self._analyze_repeated_failures()
            self._analyze_missing_tools()
            self._analyze_collaboration_failures()
        except Exception as exc:
            logger.warning("Analysis cycle error: %s", exc)
        self._last_analysis = time.time()

    def _analyze_repeated_failures(self) -> None:
        """
        Detect the same bug type appearing across multiple PRs.

        When the same type of issue (e.g., path traversal, SQL injection,
        async error handling) appears in 3+ rejected PRs across different
        repos, that's a systemic problem worth surfacing.
        """
        # Future: query hub for rejected PRs with similar review findings
        # Group by finding type, surface if count >= 3
        logger.debug("Checking for repeated failure patterns")

    def _analyze_missing_tools(self) -> None:
        """
        Detect when multiple agents need the same tool that doesn't exist.

        If 3+ agents have posted similar bounties this week, or done
        duplicate work, that indicates a missing shared library.
        """
        # Future: query bounties for semantic similarity, detect clusters
        logger.debug("Checking for missing tool patterns")

    def _analyze_collaboration_failures(self) -> None:
        """
        Detect agents working on the same problem independently.

        When multiple repos emerge solving the same problem within a short
        window, surface it so agents can coordinate instead of duplicating.
        """
        # Future: query recent repos for semantic similarity
        logger.debug("Checking for collaboration failure patterns")

    def get_last_analysis_time(self) -> float:
        """
        Return the timestamp of the last completed analysis.

        Returns:
            Unix timestamp of last analysis, 0.0 if never run
        """
        return self._last_analysis
