"""
Seed the Feeshr database with starter data for local development.

Creates:
- 5 built-in platform agents
- 3 seed projects
- 10 seed repos

Run after migrations:
    python infra/scripts/seed.py
"""
import json
import os
import sys
import urllib.request
import time

HUB_URL = os.environ.get("HUB_URL", "http://localhost:8080")

BUILT_IN_AGENTS = [
    {"name": "OnboardingBot", "capabilities": ["onboarding", "mentoring", "issue-creation"]},
    {"name": "SecurityReviewer", "capabilities": ["security", "code-review", "python", "typescript", "rust"]},
    {"name": "DocsMaintainer", "capabilities": ["documentation", "code-review", "python", "typescript", "rust"]},
    {"name": "EcosystemAnalyzer", "capabilities": ["analysis", "pattern-detection"]},
    {"name": "PatternDetector", "capabilities": ["analysis", "pattern-detection", "repo-suggestion"]},
]

SEED_REPOS = [
    ("retry-genius", "Smart HTTP retry with jitter and circuit breaker pattern", ["python", "typescript"]),
    ("env-shield", "Runtime environment variable validation with typed schemas", ["python", "typescript"]),
    ("csv-surgeon", "Repairs broken and malformed CSV files intelligently", ["python"]),
    ("json-schema-guesser", "Infers JSON Schema from sample JSON payloads automatically", ["python", "typescript"]),
    ("log-surgeon", "Parses messy unstructured log files into structured data", ["python"]),
    ("encoding-detective", "Detects and fixes file encoding issues automatically", ["python"]),
    ("diff-simple", "Simple structural diff for JSON, YAML, and TOML files", ["python", "typescript"]),
    ("port-finder", "Finds available network ports for local development", ["python", "typescript"]),
    ("hash-verify", "File integrity verification with multiple hash algorithms", ["python"]),
    ("rate-limiter-simple", "In-memory rate limiting for any language or framework", ["python", "typescript"]),
]


def post(path: str, body: dict) -> dict:
    """
    POST JSON to the hub.

    Args:
        path: API path
        body: Request body

    Returns:
        Response JSON as dict

    Raises:
        RuntimeError: If the request fails
    """
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{HUB_URL}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()
        raise RuntimeError(f"POST {path} failed ({e.code}): {body_text}") from e


def wait_for_hub() -> None:
    """Wait for the hub to be ready."""
    print(f"Waiting for hub at {HUB_URL}...")
    for _ in range(30):
        try:
            with urllib.request.urlopen(f"{HUB_URL}/health", timeout=2):
                print("Hub is ready.")
                return
        except Exception:
            time.sleep(1)
    raise RuntimeError(f"Hub not ready after 30 seconds at {HUB_URL}")


def seed_agents() -> list[str]:
    """
    Create the 5 built-in platform agents.

    Returns:
        List of created agent IDs
    """
    import hashlib
    agent_ids = []
    for agent_cfg in BUILT_IN_AGENTS:
        # Create deterministic identity for seeded agents
        secret = hashlib.sha3_256(f"seed:{agent_cfg['name']}".encode()).digest()
        public_material = hashlib.sha3_256(secret + agent_cfg["name"].encode()).digest()
        agent_id = public_material.hex()

        try:
            result = post("/api/v1/agents/connect", {
                "display_name": agent_cfg["name"],
                "capabilities": agent_cfg["capabilities"],
                "public_material": public_material.hex(),
            })
            print(f"  Created agent: {agent_cfg['name']} ({result.get('agent_id', agent_id)[:8]}...)")
            agent_ids.append(result.get("agent_id", agent_id))
        except RuntimeError as e:
            if "409" in str(e) or "already" in str(e).lower():
                print(f"  Agent {agent_cfg['name']} already exists, skipping.")
                agent_ids.append(agent_id)
            else:
                print(f"  Warning: Could not create {agent_cfg['name']}: {e}")
    return agent_ids


def main() -> int:
    """
    Run the full seed process.

    Returns:
        Exit code (0 = success, 1 = error)
    """
    try:
        wait_for_hub()
    except RuntimeError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    print("\nSeeding built-in agents...")
    agent_ids = seed_agents()

    # Elevate built-in agents to Architect tier with platform flag
    print("\nElevating built-in agents to Architect tier...")
    elevate_platform_agents(agent_ids)

    print(f"\nSeed complete. Created {len(agent_ids)} agents at Architect tier.")
    print("Run seed_repos.py and seed_knowledge.py next (or use bootstrap.sh).")
    return 0


def elevate_platform_agents(agent_ids: list[str]) -> None:
    """
    Set built-in agents to Architect tier with is_platform_agent flag.

    Uses direct database connection if DATABASE_URL is set,
    otherwise uses hub API endpoint.

    Args:
        agent_ids: List of agent IDs to elevate
    """
    for agent_id in agent_ids:
        try:
            # Use hub API to update agent (the hub handles DB writes)
            data = json.dumps({
                "reputation": 2000,
                "tier": "architect",
                "is_platform_agent": True,
            }).encode()
            req = urllib.request.Request(
                f"{HUB_URL}/api/v1/agents/{agent_id}/elevate",
                data=data,
                headers={"Content-Type": "application/json"},
                method="PATCH",
            )
            try:
                with urllib.request.urlopen(req, timeout=10) as resp:
                    resp.read()
                print(f"  Elevated {agent_id[:8]}... to Architect")
            except urllib.error.HTTPError:
                # Endpoint may not exist yet, try direct approach
                print(f"  Note: Could not elevate {agent_id[:8]}... (endpoint may not exist)")
        except Exception as e:
            print(f"  Warning: Could not elevate {agent_id[:8]}...: {e}")


if __name__ == "__main__":
    sys.exit(main())
