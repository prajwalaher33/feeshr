"""
Sandbox executor — runs CI in isolated Docker containers.

Each PR submission triggers a CI run. The sandbox:
1. Clones the repo at the PR branch
2. Runs in Docker with: no network, no host filesystem, 60s timeout, 512MB RAM
3. Executes: install dependencies → linter → tests → coverage
4. Returns structured results

Security policy enforced by Docker flags, not trust.
"""
import subprocess
import json
import os
import tempfile
import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 60
MEMORY_LIMIT = "512m"


@dataclass
class CiResult:
    """
    Results from a CI run.

    Attributes:
        passed: True if all checks passed
        test_count: Number of tests executed
        coverage_pct: Test coverage percentage (0-100)
        lint_warnings: Number of linting warnings
        stdout: Standard output from the CI run
        stderr: Standard error from the CI run
        duration_seconds: How long the CI took
    """
    passed: bool
    test_count: int
    coverage_pct: float
    lint_warnings: int
    stdout: str
    stderr: str
    duration_seconds: float


class SandboxExecutor:
    """
    Executes CI runs in isolated Docker containers.

    Each run gets a fresh container with:
    - No network access
    - No host filesystem (read-only bind mount of repo only)
    - 512MB RAM limit
    - 1 CPU limit
    - 60 second timeout
    - No privilege escalation

    Args:
        docker_image: Base Docker image for CI (default: python:3.12-slim)
        git_server_url: URL of the Feeshr git server for cloning
    """

    def __init__(
        self,
        docker_image: str = "python:3.12-slim",
        git_server_url: str = "http://git-server:8081",
    ) -> None:
        self.docker_image = docker_image
        self.git_server_url = git_server_url

    def run(self, repo_id: str, branch: str) -> CiResult:
        """
        Run CI for a specific repo branch.

        Clones the repo, installs dependencies, runs linter and tests,
        measures coverage, and returns structured results.

        Args:
            repo_id: UUID of the repo to test
            branch: Git branch to test

        Returns:
            CiResult with test results and coverage

        Raises:
            RuntimeError: If Docker is not available
        """
        import time
        start = time.monotonic()

        with tempfile.TemporaryDirectory() as tmpdir:
            try:
                result = self._run_docker_ci(repo_id, branch, tmpdir)
            except subprocess.TimeoutExpired:
                return CiResult(
                    passed=False,
                    test_count=0,
                    coverage_pct=0.0,
                    lint_warnings=0,
                    stdout="",
                    stderr="CI timed out after 60 seconds",
                    duration_seconds=time.monotonic() - start,
                )
            except Exception as exc:
                return CiResult(
                    passed=False,
                    test_count=0,
                    coverage_pct=0.0,
                    lint_warnings=0,
                    stdout="",
                    stderr=f"CI executor error: {exc}",
                    duration_seconds=time.monotonic() - start,
                )

        result.duration_seconds = time.monotonic() - start
        return result

    def _run_docker_ci(self, repo_id: str, branch: str, tmpdir: str) -> CiResult:
        """
        Execute CI inside a Docker container.

        Args:
            repo_id: Repo UUID
            branch: Branch to test
            tmpdir: Temporary directory for workspace

        Returns:
            CiResult (duration_seconds not set, caller sets it)
        """
        clone_url = f"{self.git_server_url}/repos/{repo_id}"
        ci_script = f"""
set -e
git clone --depth 1 --branch {branch} {clone_url} /workspace 2>&1
cd /workspace
if [ -f pyproject.toml ] || [ -f setup.py ]; then
    pip install -e . --quiet 2>&1
    pip install ruff pytest pytest-cov --quiet 2>&1
    ruff check . --output-format=json 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d))" || echo 0
    pytest -q --tb=short --cov=. --cov-report=json 2>&1
elif [ -f package.json ]; then
    npm ci --silent 2>&1
    npm run lint 2>&1 || true
    npm test 2>&1
fi
"""
        result = subprocess.run(
            [
                "docker", "run", "--rm",
                "--network=none",
                f"--memory={MEMORY_LIMIT}",
                "--cpus=1",
                "--security-opt=no-new-privileges",
                "--read-only",
                "--tmpfs=/tmp",
                "--tmpfs=/workspace",
                self.docker_image,
                "bash", "-c", ci_script,
            ],
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SECONDS,
        )

        passed = result.returncode == 0
        return CiResult(
            passed=passed,
            test_count=self._parse_test_count(result.stdout),
            coverage_pct=self._parse_coverage(result.stdout),
            lint_warnings=self._parse_lint_warnings(result.stdout),
            stdout=result.stdout[:10000],
            stderr=result.stderr[:2000],
            duration_seconds=0.0,
        )

    def _parse_test_count(self, stdout: str) -> int:
        """Parse number of tests from pytest output."""
        for line in stdout.splitlines():
            if "passed" in line or "failed" in line:
                parts = line.split()
                for i, part in enumerate(parts):
                    if part in ("passed", "failed", "error"):
                        try:
                            return int(parts[i - 1])
                        except (IndexError, ValueError):
                            pass
        return 0

    def _parse_coverage(self, stdout: str) -> float:
        """Parse coverage percentage from pytest-cov output."""
        for line in stdout.splitlines():
            if "TOTAL" in line and "%" in line:
                parts = line.split()
                for part in parts:
                    if part.endswith("%"):
                        try:
                            return float(part.rstrip("%"))
                        except ValueError:
                            pass
        return 0.0

    def _parse_lint_warnings(self, stdout: str) -> int:
        """Parse lint warning count from ruff output."""
        for line in stdout.splitlines():
            if line.strip().isdigit():
                return int(line.strip())
        return 0
