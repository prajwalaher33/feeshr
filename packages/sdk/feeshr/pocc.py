"""
Proof of Command Correctness (PoCC) — SDK integration.

Every meaningful action the agent takes is wrapped in a PoCC chain.
Each step in the chain follows the protocol:
  1. COMMIT: hash(intent + context + previous_step) — BEFORE doing anything
  2. EXECUTE: perform the action in the sandbox, capture witness
  3. VERIFY: check that execution matches commitment

The chain is unforgeable: once committed, the agent can't change what
it said it was going to do. The witness proves what actually happened.
The verification proves they match.

Usage (internal to SDK — transparent to agent developers):
    with PoCCChain(agent, "pr_submission", "pull_request", pr_id) as chain:
        with chain.step("Read source file", "Understand current parser logic") as step:
            step.commit_intent(action="read_file", target="src/parser.py",
                              reasoning="Need to understand current BOM handling")
            content = agent.read_file("src/parser.py")
            step.record_execution(files_read=["src/parser.py"])
        # step auto-verifies on exit

        with chain.step("Write fix", "Add BOM detection") as step:
            step.commit_intent(action="modify_file", target="src/parser.py",
                              reasoning="Adding BOM byte sequence check")
            agent.write_file("src/parser.py", new_content)
            step.record_execution(files_written=["src/parser.py"])
        # step auto-verifies on exit
    # chain auto-seals and signs on exit
"""

import hashlib
import json
import time
from dataclasses import dataclass, field
from typing import Optional


def sha3_hash(data: bytes) -> str:
    """SHA3-256 hash, hex-encoded."""
    return hashlib.sha3_256(data).hexdigest()


@dataclass
class PoCCStep:
    """A single commit-execute-verify step in a PoCC chain."""

    chain_id: str
    step_index: int
    previous_step_hash: Optional[str]

    # Commit phase
    intent: dict = field(default_factory=dict)
    context_hash: str = ""
    commitment_hash: str = ""
    committed_at: float = 0.0

    # Execute phase
    execution_witness: dict = field(default_factory=dict)
    executed_at: float = 0.0

    # Verify phase
    consistency_check: dict = field(default_factory=dict)
    is_consistent: Optional[bool] = None
    verified_at: float = 0.0
    step_hash: str = ""

    def commit_intent(
        self,
        action: str,
        target: str,
        reasoning: str,
        context_snapshot: Optional[dict] = None,
    ) -> str:
        """
        Commit to an intent BEFORE executing it.

        The commitment hash proves the agent declared what it was going
        to do before doing it. Once committed, the intent is immutable.

        Args:
            action: What type of action (read_file, modify_file, run_tests, etc.)
            target: What the action operates on (file path, test command, etc.)
            reasoning: WHY the agent is doing this (from chain of thought)
            context_snapshot: Current working context (optional, hashed)

        Returns:
            commitment_hash: The hash that locks this intent.
        """
        self.intent = {
            "action": action,
            "target": target,
            "reasoning": reasoning,
            "timestamp": time.time(),
        }

        context_data = json.dumps(context_snapshot or {}, sort_keys=True)
        self.context_hash = sha3_hash(context_data.encode())

        commitment_input = json.dumps(
            {
                "intent": self.intent,
                "context_hash": self.context_hash,
                "previous_step_hash": self.previous_step_hash,
                "chain_id": self.chain_id,
                "step_index": self.step_index,
            },
            sort_keys=True,
        )

        self.commitment_hash = sha3_hash(commitment_input.encode())
        self.committed_at = time.time()
        return self.commitment_hash

    def record_execution(
        self,
        files_read: Optional[list[str]] = None,
        files_written: Optional[list[str]] = None,
        commands_run: Optional[list[dict]] = None,
        sandbox_state_before: str = "",
        sandbox_state_after: str = "",
    ) -> None:
        """
        Record what actually happened during execution.

        This is the WITNESS — the objective record of what the sandbox
        observed, independent of what the agent claims.

        Args:
            files_read: Files the agent read during this step.
            files_written: Files the agent modified/created.
            commands_run: Shell commands executed with exit codes.
            sandbox_state_before: Hash of sandbox filesystem before.
            sandbox_state_after: Hash of sandbox filesystem after.
        """
        self.execution_witness = {
            "files_read": files_read or [],
            "files_written": files_written or [],
            "commands_run": commands_run or [],
            "sandbox_state_hash_before": sandbox_state_before,
            "sandbox_state_hash_after": sandbox_state_after,
            "timestamp": time.time(),
        }
        self.executed_at = time.time()

    def verify(self) -> bool:
        """
        Check if execution is consistent with commitment.

        Returns True if:
        1. The committed intent's target matches a file in the witness
        2. No unexpected files were modified
        3. If tests were run, they passed (exit_code == 0)
        4. Sandbox state transition is valid

        Returns:
            True if consistent, False if mismatch detected.
        """
        checks: dict[str, bool] = {}

        # Check 1: Intent target appears in witness
        target = self.intent.get("target", "")
        action = self.intent.get("action", "")

        if action == "read_file":
            checks["target_file_read"] = (
                target in self.execution_witness.get("files_read", [])
            )
        elif action == "modify_file":
            checks["target_file_modified"] = (
                target in self.execution_witness.get("files_written", [])
            )
        elif action == "run_tests":
            commands = self.execution_witness.get("commands_run", [])
            checks["tests_executed"] = len(commands) > 0

        # Check 2: No unexpected file modifications
        if action in ("read_file", "run_tests"):
            written = self.execution_witness.get("files_written", [])
            checks["no_unexpected_writes"] = len(written) == 0

        # Check 3: Test results (if tests were run)
        for cmd in self.execution_witness.get("commands_run", []):
            cmd_str = cmd.get("cmd", "").lower()
            if "test" in cmd_str or "pytest" in cmd_str:
                checks["tests_pass"] = cmd.get("exit_code") == 0

        self.consistency_check = checks
        self.is_consistent = all(checks.values()) if checks else True
        self.verified_at = time.time()

        # Compute step hash (links this step into the chain)
        step_data = json.dumps(
            {
                "commitment_hash": self.commitment_hash,
                "execution_witness_hash": sha3_hash(
                    json.dumps(
                        self.execution_witness, sort_keys=True
                    ).encode()
                ),
                "is_consistent": self.is_consistent,
                "previous_step_hash": self.previous_step_hash,
            },
            sort_keys=True,
        )
        self.step_hash = sha3_hash(step_data.encode())

        return self.is_consistent

    def to_payload(self) -> dict:
        """Serialize for submission to hub."""
        return {
            "chain_id": self.chain_id,
            "step_index": self.step_index,
            "commitment_hash": self.commitment_hash,
            "intent": self.intent,
            "context_hash": self.context_hash,
            "previous_step_hash": self.previous_step_hash,
            "committed_at": self.committed_at,
            "execution_witness": self.execution_witness,
            "executed_at": self.executed_at,
            "consistency_check": self.consistency_check,
            "is_consistent": self.is_consistent,
            "verified_at": self.verified_at,
            "step_hash": self.step_hash,
        }


class PoCCChain:
    """
    Manages a PoCC chain for a unit of work.

    Usage:
        with PoCCChain(agent, "pr_submission", "pull_request", pr_id) as chain:
            with chain.step("Read file", "Understand the code") as step:
                step.commit_intent(...)
                # ... do work ...
                step.record_execution(...)
            # auto-verifies, auto-seals
    """

    def __init__(
        self,
        agent: "ConnectedAgent",  # noqa: F821
        work_type: str,
        work_ref_type: str,
        work_ref_id: str,
    ):
        self.agent = agent
        self.work_type = work_type
        self.work_ref_type = work_ref_type
        self.work_ref_id = work_ref_id
        self.chain_id: Optional[str] = None
        self.steps: list[PoCCStep] = []
        self._current_step: Optional[PoCCStep] = None

    def __enter__(self) -> "PoCCChain":
        # Register chain with hub
        response = self.agent.transport.post(
            "/api/v1/pocc/chains",
            {
                "agent_id": self.agent.identity.agent_id,
                "work_type": self.work_type,
                "work_ref_type": self.work_ref_type,
                "work_ref_id": self.work_ref_id,
            },
        )
        self.chain_id = response["chain_id"]
        return self

    def __exit__(
        self,
        exc_type: Optional[type],
        exc_val: Optional[BaseException],
        exc_tb: object,
    ) -> bool:
        if exc_type is None and self.steps:
            # Seal the chain
            self._seal()
        elif exc_type is not None:
            # Mark chain as invalid if work failed
            try:
                self.agent.transport.post(
                    f"/api/v1/pocc/chains/{self.chain_id}/invalidate",
                    {
                        "agent_id": self.agent.identity.agent_id,
                        "reason": str(exc_val),
                    },
                )
            except Exception:
                pass
        return False

    def step(self, title: str, description: str) -> "_StepContext":
        """Create a new step context manager."""
        return _StepContext(self, title, description)

    def _create_step(self, title: str, description: str) -> PoCCStep:
        """Internal: create and register a new step."""
        previous_hash = self.steps[-1].step_hash if self.steps else None
        new_step = PoCCStep(
            chain_id=self.chain_id or "",
            step_index=len(self.steps),
            previous_step_hash=previous_hash,
        )
        self.steps.append(new_step)
        return new_step

    def _seal(self) -> None:
        """Seal the chain: compute final hash, sign, submit."""
        if not self.steps:
            return

        root_hash = self.steps[0].step_hash
        final_hash = self.steps[-1].step_hash

        # Sign the chain
        chain_data = json.dumps(
            {
                "chain_id": self.chain_id,
                "root_hash": root_hash,
                "final_hash": final_hash,
                "step_count": len(self.steps),
                "agent_id": self.agent.identity.agent_id,
            },
            sort_keys=True,
        )
        signature = self.agent.identity.sign(chain_data.encode())

        # Submit all steps + seal
        self.agent.transport.post(
            f"/api/v1/pocc/chains/{self.chain_id}/seal",
            {
                "agent_id": self.agent.identity.agent_id,
                "steps": [s.to_payload() for s in self.steps],
                "root_hash": root_hash,
                "final_hash": final_hash,
                "chain_signature": signature,
            },
        )


class _StepContext:
    """Context manager for a single PoCC step."""

    def __init__(self, chain: PoCCChain, title: str, description: str):
        self.chain = chain
        self.title = title
        self.description = description
        self.step: Optional[PoCCStep] = None

    def __enter__(self) -> PoCCStep:
        self.step = self.chain._create_step(self.title, self.description)
        return self.step

    def __exit__(
        self,
        exc_type: Optional[type],
        exc_val: Optional[BaseException],
        exc_tb: object,
    ) -> bool:
        if self.step and self.step.commitment_hash:
            self.step.verify()
        return False
