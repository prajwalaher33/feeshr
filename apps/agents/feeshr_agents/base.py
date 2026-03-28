"""
BaseAgent — the foundation for all Feeshr agents.

Provides: connect, sign actions, run autonomous loop, communicate with hub.
All built-in agents inherit from BaseAgent.
"""
import threading
import time
import logging
from typing import Any
from feeshr_identity import AgentIdentity

logger = logging.getLogger(__name__)


class BaseAgent:
    """
    Base class for all Feeshr agents (built-in and external).

    Manages the autonomous loop and provides helper methods for
    common hub operations. Subclasses override _tick() to define
    what the agent does each iteration.

    Args:
        identity: The agent's cryptographic identity
        hub_url: URL of the Feeshr hub
        loop_interval: Seconds between loop iterations (default: 30)
    """

    def __init__(
        self,
        identity: AgentIdentity,
        hub_url: str,
        loop_interval: int = 30,
    ) -> None:
        self.identity = identity
        self.hub_url = hub_url
        self._loop_interval = loop_interval
        self._running = False
        self._thread: threading.Thread | None = None

    @property
    def agent_id(self) -> str:
        """The agent's unique 64-char hex identifier."""
        return self.identity.agent_id

    def start(self) -> None:
        """
        Start the autonomous loop in a background thread.

        Safe to call multiple times — only one loop runs at a time.
        """
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._run_loop,
            daemon=True,
            name=f"feeshr-{self.identity.display_name}",
        )
        self._thread.start()
        logger.info("Agent %s started", self.identity.display_name)

    def stop(self) -> None:
        """
        Stop the autonomous loop.

        Waits up to loop_interval + 5 seconds for graceful shutdown.
        """
        self._running = False
        if self._thread:
            self._thread.join(timeout=self._loop_interval + 5)

    def _run_loop(self) -> None:
        """Main loop that calls _tick() on each interval."""
        while self._running:
            try:
                self._tick()
            except Exception as exc:
                logger.warning("Agent %s loop error: %s", self.identity.display_name, exc)
            time.sleep(self._loop_interval)

    def _tick(self) -> None:
        """
        One iteration of the agent's autonomous behavior.

        Override this in subclasses to define what the agent does.
        Must complete in less than loop_interval seconds.
        """
        raise NotImplementedError("Subclasses must implement _tick()")

    def sign_action(self, action_type: str, payload: dict[str, Any]) -> str:
        """
        Sign an action payload for submission to the hub.

        Args:
            action_type: The type of action (e.g., 'submit_pr', 'post_review')
            payload: The action's data as a dict

        Returns:
            Hex-encoded HMAC-SHA3-256 signature
        """
        import json
        data = f"{action_type}:{json.dumps(payload, sort_keys=True)}".encode()
        return self.identity.sign(data)
