"""
Working context for an agent's current task.

Accumulates relevant information from the platform (pitfalls, warnings,
project memory, decision records) and makes it available to the agent's
LLM during code generation and review.

The context is ephemeral — it resets when the agent moves to a new task.
It is NOT stored on the platform. It lives only in the agent's memory.
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class WorkingContext:
    """
    Everything the agent needs to know about its current task.

    The agent's LLM should receive this as part of its system prompt
    when generating code, reviews, or any work product.
    """

    # What the agent is working on
    task_type: Optional[str] = None
    task_id: Optional[str] = None
    task_description: Optional[str] = None

    # From pre-commit consultation
    pitfalls: list[dict] = field(default_factory=list)
    warnings: list[dict] = field(default_factory=list)
    constraints: list[dict] = field(default_factory=list)
    failed_approaches: list[dict] = field(default_factory=list)

    # From project memory
    decisions: list[dict] = field(default_factory=list)
    architecture_notes: list[dict] = field(default_factory=list)
    api_contracts: list[dict] = field(default_factory=list)

    # From workflow template
    current_step: Optional[dict] = None
    remaining_steps: list[dict] = field(default_factory=list)

    def to_prompt_section(self) -> str:
        """
        Render this context as a text section suitable for injection
        into an LLM prompt.

        Returns:
            A structured text block that the agent's LLM can use
            to inform its code generation. Includes all pitfalls,
            warnings, constraints, and relevant project context.
        """
        sections: list[str] = []

        if self.pitfalls:
            sections.append("## KNOWN PITFALLS (from platform pitfall-db)")
            for p in self.pitfalls:
                sections.append(
                    f"- {p.get('title', 'Unknown')}: {p.get('fix', p.get('content', 'No fix documented'))}"
                )

        if self.warnings:
            sections.append("## WARNINGS (from project memory)")
            for w in self.warnings:
                sections.append(f"- {w.get('key', 'Warning')}: {w.get('value', '')}")

        if self.constraints:
            sections.append("## CONSTRAINTS (from project memory)")
            for c in self.constraints:
                sections.append(f"- {c.get('key', 'Constraint')}: {c.get('value', '')}")

        if self.failed_approaches:
            sections.append("## FAILED APPROACHES (do NOT repeat these)")
            for fa in self.failed_approaches:
                sections.append(
                    f"- {fa.get('key', 'Approach')}: {fa.get('value', '')}"
                )

        if self.decisions:
            sections.append("## TEAM DECISIONS (must follow these)")
            for d in self.decisions:
                sections.append(
                    f"- {d.get('title', d.get('key', 'Decision'))}: {d.get('value', '')}"
                )

        if self.current_step:
            sections.append(
                f"## CURRENT WORKFLOW STEP: {self.current_step.get('title', 'Unknown')}"
            )
            sections.append(self.current_step.get("description", ""))

        return "\n\n".join(sections) if sections else ""

    def reset(self) -> None:
        """Clear all context. Called when agent moves to a new task."""
        self.task_type = None
        self.task_id = None
        self.task_description = None
        self.pitfalls.clear()
        self.warnings.clear()
        self.constraints.clear()
        self.failed_approaches.clear()
        self.decisions.clear()
        self.architecture_notes.clear()
        self.api_contracts.clear()
        self.current_step = None
        self.remaining_steps.clear()

    def add_pitfalls(self, pitfalls: list[dict]) -> None:
        """Add pitfalls from pre-commit consultation."""
        self.pitfalls.extend(pitfalls)

    def add_warnings(self, warnings: list[dict]) -> None:
        """Add warnings from project memory."""
        self.warnings.extend(warnings)

    def add_constraints(self, constraints: list[dict]) -> None:
        """Add constraints from project memory."""
        self.constraints.extend(constraints)

    def set_workflow_step(self, step: dict, remaining: list[dict]) -> None:
        """Set the current workflow step and remaining steps."""
        self.current_step = step
        self.remaining_steps = remaining
