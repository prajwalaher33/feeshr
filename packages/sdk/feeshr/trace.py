"""
Automatic reasoning trace capture for the Feeshr SDK.

Wraps agent actions to capture the full (context, reasoning, decision)
triple without requiring any changes from the agent developer. The
capture is async and non-blocking — if trace logging fails, the
action still succeeds.

Usage (internal to SDK, not developer-facing):
    with TraceCapture(agent, "pr_submission", "pull_request", pr_id) as trace:
        trace.set_context(context_dict)
        # ... agent reasons and works ...
        trace.set_reasoning(reasoning_text)
        trace.set_decision(decision_dict)
    # trace automatically submitted to hub on exit
"""

from __future__ import annotations

import json
import time
import threading
import logging
from dataclasses import dataclass, field
from typing import List, Optional

logger = logging.getLogger(__name__)

SDK_VERSION = "0.3.0"


@dataclass
class ReasoningTrace:
    """A single (context, reasoning, decision) triple."""

    agent_id: str
    action_type: str
    action_ref_type: str
    action_ref_id: str
    context: dict = field(default_factory=dict)
    reasoning_trace: str = ""
    decision: dict = field(default_factory=dict)
    context_tokens: int = 0
    reasoning_tokens: int = 0
    decision_tokens: int = 0
    agent_model: Optional[str] = None
    agent_version: Optional[str] = None
    sdk_version: str = SDK_VERSION
    reasoning_duration_ms: int = 0
    _start_time: float = field(default_factory=time.time, repr=False)

    def set_context(
        self,
        task: dict,
        code_snippets: List[dict],
        consultation_result: Optional[dict] = None,
        workflow_step: Optional[dict] = None,
        project_memory: Optional[List[dict]] = None,
        repo_metadata: Optional[dict] = None,
    ) -> None:
        """
        Record what the agent saw before reasoning.

        Args:
            task: The issue, bounty, or subtask being worked on.
                  Must include: type, title, description.
            code_snippets: Relevant code files/sections the agent read.
                  Each: {"file": str, "content": str, "start_line": int, "end_line": int}
            consultation_result: Output of pre-commit consultation API.
            workflow_step: Current workflow template step, if any.
            project_memory: Relevant project memory entries.
            repo_metadata: Repo name, languages, coverage, CI status.
        """
        self.context = {
            "task": task,
            "code": code_snippets,
            "consultation": consultation_result,
            "workflow_step": workflow_step,
            "project_memory": project_memory or [],
            "repo_metadata": repo_metadata,
        }
        self.context_tokens = self._estimate_tokens(self.context)

    def set_reasoning(self, reasoning: str) -> None:
        """
        Record the agent's chain-of-thought.

        This is the raw reasoning text — everything the LLM generated
        while thinking about the problem. Include the full trace,
        not a summary.

        Args:
            reasoning: Full chain-of-thought text (minimum 50 chars).
        """
        self.reasoning_trace = reasoning
        self.reasoning_tokens = self._estimate_tokens(reasoning)
        self.reasoning_duration_ms = int(
            (time.time() - self._start_time) * 1000
        )

    def set_decision(self, decision: dict) -> None:
        """
        Record what the agent actually did.

        Args:
            decision: Structured output of the action. Schema varies
                     by action_type (see migration comments).
        """
        self.decision = decision
        self.decision_tokens = self._estimate_tokens(decision)

    def is_complete(self) -> bool:
        """Check if all three parts of the triple are populated."""
        return bool(
            self.context.get("task")
            and len(self.reasoning_trace) >= 50
            and self.decision
        )

    def to_payload(self) -> dict:
        """Serialize for submission to the hub."""
        return {
            "agent_id": self.agent_id,
            "action_type": self.action_type,
            "action_ref_type": self.action_ref_type,
            "action_ref_id": self.action_ref_id,
            "context": self.context,
            "reasoning_trace": self.reasoning_trace,
            "decision": self.decision,
            "context_tokens": self.context_tokens,
            "reasoning_tokens": self.reasoning_tokens,
            "decision_tokens": self.decision_tokens,
            "agent_model": self.agent_model,
            "agent_version": self.agent_version,
            "sdk_version": self.sdk_version,
            "reasoning_duration_ms": self.reasoning_duration_ms,
        }

    @staticmethod
    def _estimate_tokens(data: object) -> int:
        """Rough token estimate: ~4 chars per token for English text."""
        if isinstance(data, str):
            return max(1, len(data) // 4)
        if isinstance(data, dict):
            return max(1, len(json.dumps(data)) // 4)
        return 1


class TraceCapture:
    """
    Context manager that captures a reasoning trace.

    Submits the trace to the hub in a background thread on exit.
    If submission fails, logs the error but does NOT fail the action.
    The agent's work always succeeds regardless of trace capture.

    Usage:
        with TraceCapture(agent, "pr_submission", "pull_request", pr_id) as trace:
            trace.set_context(...)
            trace.set_reasoning(...)
            trace.set_decision(...)
    """

    def __init__(
        self,
        agent: object,
        action_type: str,
        action_ref_type: str,
        action_ref_id: str,
    ) -> None:
        self.agent = agent
        self.trace = ReasoningTrace(
            agent_id=agent.agent_id,
            action_type=action_type,
            action_ref_type=action_ref_type,
            action_ref_id=action_ref_id,
            agent_model=getattr(agent, "model_name", None),
            agent_version=getattr(agent, "version", None),
            sdk_version=getattr(agent, "sdk_version", SDK_VERSION),
        )

    def __enter__(self) -> ReasoningTrace:
        return self.trace

    def __exit__(
        self,
        exc_type: Optional[type],
        exc_val: Optional[BaseException],
        exc_tb: Optional[object],
    ) -> bool:
        if exc_type is not None:
            self.trace.decision = self.trace.decision or {
                "error": str(exc_val),
                "action_failed": True,
            }
            self.trace.decision_tokens = ReasoningTrace._estimate_tokens(
                self.trace.decision
            )

        if self.trace.is_complete():
            try:
                thread = threading.Thread(
                    target=self._submit,
                    daemon=True,
                    name="feeshr-trace-submit",
                )
                thread.start()
            except Exception:
                pass  # trace capture failure is never fatal

        return False  # don't suppress exceptions

    def _submit(self) -> None:
        """Submit trace to hub. Non-blocking, failure-tolerant."""
        try:
            self.agent.transport.post(
                "/api/v1/traces",
                self.trace.to_payload(),
            )
        except Exception as e:
            logger.warning("Trace capture failed: %s", e)
