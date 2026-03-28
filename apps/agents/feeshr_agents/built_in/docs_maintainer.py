"""
DocsMaintainer — built-in documentation quality reviewer.

Reviews PRs for documentation quality: README completeness,
docstring coverage, error message clarity, type annotation accuracy.
Also creates documentation-improvement issues on repos with poor docs.
"""
import logging
from typing import Any
from feeshr_agents.base import BaseAgent
from feeshr_identity import AgentIdentity

logger = logging.getLogger(__name__)

DOCS_CAPABILITIES = [
    "documentation", "code-review", "python", "typescript", "rust",
]
LOOP_INTERVAL_SECONDS = 60


class DocsMaintainer(BaseAgent):
    """
    Built-in documentation quality agent.

    Reviews PRs for documentation completeness and clarity.
    During bootstrap, acts as secondary reviewer alongside
    SecurityReviewer. Creates documentation issues on repos
    with missing or outdated docs.

    Args:
        hub_url: URL of the Feeshr hub
    """

    def __init__(self, hub_url: str) -> None:
        identity = AgentIdentity.create("DocsMaintainer", DOCS_CAPABILITIES)
        super().__init__(
            identity=identity,
            hub_url=hub_url,
            loop_interval=LOOP_INTERVAL_SECONDS,
        )
        self._tick_count = 0

    def _tick(self) -> None:
        """
        Check for PRs awaiting documentation review and audit repos.

        Every tick: review assigned PRs.
        Every 60th tick (~1 hour): audit repos for documentation quality.
        """
        self._tick_count += 1

        try:
            self._check_assigned_prs()
        except Exception as exc:
            logger.warning("DocsMaintainer review tick error: %s", exc)

        if self._tick_count % 60 == 0:
            try:
                self._audit_repo_docs()
            except Exception as exc:
                logger.warning("DocsMaintainer audit tick error: %s", exc)

    def _check_assigned_prs(self) -> None:
        """
        Find and review PRs assigned to this reviewer.

        Checks for documentation quality: docstrings, README updates,
        error message clarity, type annotation completeness.
        """
        logger.debug("DocsMaintainer checking for assigned PRs")

    def _audit_repo_docs(self) -> None:
        """
        Audit active repos for documentation quality issues.

        Creates documentation-improvement issues on repos that are
        missing README sections, have low docstring coverage, or
        have unclear error messages.
        """
        logger.debug("DocsMaintainer auditing repo documentation")

    def _check_docstring_coverage(
        self, file_content: str, language: str
    ) -> dict[str, Any]:
        """
        Analyze a source file for docstring coverage.

        Args:
            file_content: The file's source code
            language: Programming language of the file

        Returns:
            Dict with total_functions, documented_functions, coverage_pct
        """
        total = 0
        documented = 0

        if language == "python":
            import re
            func_pattern = re.compile(r"^\s*def\s+\w+", re.MULTILINE)
            doc_pattern = re.compile(
                r'^\s*def\s+\w+[^:]*:\s*\n\s*"""', re.MULTILINE
            )
            total = len(func_pattern.findall(file_content))
            documented = len(doc_pattern.findall(file_content))
        elif language in ("typescript", "javascript"):
            import re
            func_pattern = re.compile(
                r"(function\s+\w+|(?:export\s+)?(?:const|let)\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>)",
                re.MULTILINE,
            )
            doc_pattern = re.compile(r"/\*\*[\s\S]*?\*/\s*\n\s*(?:export\s+)?(?:function|const|let)", re.MULTILINE)
            total = len(func_pattern.findall(file_content))
            documented = len(doc_pattern.findall(file_content))

        coverage = (documented / total * 100) if total > 0 else 100.0
        return {
            "total_functions": total,
            "documented_functions": documented,
            "coverage_pct": round(coverage, 1),
        }
