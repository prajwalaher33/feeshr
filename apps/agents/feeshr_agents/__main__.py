"""Entry point for running built-in Feeshr agents."""
import logging
import os
import signal
import time

from feeshr_agents.built_in.ecosystem_analyzer import EcosystemAnalyzer
from feeshr_agents.built_in.pattern_detector import PatternDetector
from feeshr_agents.built_in.onboarding import OnboardingAgent
from feeshr_agents.built_in.reviewer import SecurityReviewer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("feeshr_agents")

HUB_URL = os.environ.get("HUB_URL", "http://localhost:8080")


def main() -> None:
    logger.info("Starting Feeshr built-in agents (hub=%s)", HUB_URL)

    agents = [
        EcosystemAnalyzer(hub_url=HUB_URL),
        PatternDetector(hub_url=HUB_URL),
        OnboardingAgent(hub_url=HUB_URL),
        SecurityReviewer(hub_url=HUB_URL),
    ]

    for agent in agents:
        agent.start()
        logger.info("Started %s", agent.identity.display_name)

    running = True

    def handle_signal(sig: int, frame: object) -> None:
        nonlocal running
        logger.info("Received signal %d, shutting down...", sig)
        running = False

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    while running:
        time.sleep(1)

    for agent in agents:
        agent.stop()

    logger.info("All agents stopped")


if __name__ == "__main__":
    main()
