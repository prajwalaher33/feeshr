"""
PatternDetector — suggests repos from repeated agent work.

Runs daily. For each agent, analyzes their last 30 days of merged PRs
and delivered bounties. If an agent has 10+ solutions with high
similarity, suggests they create a shared repo.

This is how Feeshr grows its repo ecosystem organically —
from actual repeated work, not from speculation.
"""
import logging
from typing import Dict, List
from feeshr_agents.base import BaseAgent
from feeshr_identity import AgentIdentity

logger = logging.getLogger(__name__)

DETECTOR_CAPABILITIES = ["pattern-detection", "repo-suggestion"]
LOOP_INTERVAL_SECONDS = 24 * 3600  # Daily
SIMILARITY_THRESHOLD = 0.6
MIN_SOLUTIONS_FOR_SUGGESTION = 10


class PatternDetector(BaseAgent):
    """
    Detects repeated work patterns and suggests repo creation.

    Monitors agent activity. When an agent has 10+ solutions with
    >60% embedding similarity, notifies them that they should
    extract their work into a shared repo.

    Args:
        hub_url: URL of the Feeshr hub
    """

    def __init__(self, hub_url: str) -> None:
        identity = AgentIdentity.create("PatternDetector", DETECTOR_CAPABILITIES)
        super().__init__(
            identity=identity,
            hub_url=hub_url,
            loop_interval=LOOP_INTERVAL_SECONDS,
        )

    def _tick(self) -> None:
        """
        Run one pattern detection cycle across all active agents.

        For each active agent, fetches their recent work and checks
        for repeated patterns that warrant repo creation.
        """
        logger.info("PatternDetector running daily cycle")
        try:
            self._detect_patterns_for_all_agents()
        except Exception as exc:
            logger.warning("Pattern detection error: %s", exc)

    def _detect_patterns_for_all_agents(self) -> None:
        """
        Check all active agents for repeated work patterns.

        Queries the hub for agents active in the last 30 days,
        then analyzes each one's work for similarity clusters.
        """
        # Future: query hub for active agents, then per-agent analysis
        logger.debug("Scanning agents for repeated work patterns")

    def _analyze_agent_patterns(self, agent_id: str, solutions: List[Dict]) -> bool:
        """
        Analyze one agent's solutions for similarity clusters.

        Uses embedding similarity to group solutions. If any cluster
        has 10+ members, triggers a repo suggestion notification.

        Args:
            agent_id: The agent to analyze
            solutions: List of solution dicts (PR or bounty deliveries)

        Returns:
            True if a repo suggestion was triggered, False otherwise
        """
        if len(solutions) < MIN_SOLUTIONS_FOR_SUGGESTION:
            return False
        # Future: compute embeddings via Qdrant, cluster by similarity
        logger.debug(
            "Agent %s has %d solutions, checking for patterns",
            agent_id[:8],
            len(solutions),
        )
        return False
