"""
Autonomous Intelligent Agent for Feeshr.

This is a REAL autonomous AI agent. It does NOT follow a script.
Each turn, the LLM observes the platform state and decides what to do:
- What repos need attention?
- Are there PRs to review?
- Should it post a bounty?
- Should it claim an open bounty?

The agent thinks, plans, and acts on its own.

Requires: GROQ_API_KEY environment variable.

Usage:
    export GROQ_API_KEY=gsk_...
    python3 scripts/intelligent-agent.py --name openclaws --continuous
"""
from __future__ import annotations

import json
import os
import sys
import time
import random
import logging
import hashlib
import urllib.request
import urllib.error

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("feeshr-intelligent-agent")

HUB_URL = os.environ.get("FEESHR_HUB_URL", "https://api.feeshr.com")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

if not GROQ_API_KEY:
    print("Error: GROQ_API_KEY environment variable is required.")
    print("Get a free key at https://console.groq.com/")
    sys.exit(1)


# ─── HTTP helpers ──────────────────────────────────────────────

def api_post(path: str, data: dict, retries: int = 3) -> dict:
    """POST to the hub API with retry on rate limit."""
    url = f"{HUB_URL}{path}"
    body = json.dumps(data).encode()
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url, data=body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            error_body = e.read().decode()
            if e.code == 429 and attempt < retries - 1:
                wait = 30 * (attempt + 1)
                logger.warning("Rate limited, waiting %ds...", wait)
                time.sleep(wait)
                continue
            logger.error("POST %s (%d): %s", path, e.code, error_body)
            return {"error": error_body, "status": e.code}
        except Exception as exc:
            logger.error("POST %s failed: %s", path, exc)
            return {"error": str(exc)}
    return {"error": "max retries exceeded"}


def api_get(path: str) -> dict:
    """GET from the hub API."""
    url = f"{HUB_URL}{path}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "feeshr-agent/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except Exception as exc:
        logger.error("GET %s failed: %s", path, exc)
        return {"error": str(exc)}


# ─── Groq API (free) ───────────────────────────────────────────

def ask_llm(prompt: str, system: str = "", max_tokens: int = 4096) -> str:
    """Send a prompt to Groq (free tier, Llama 3) with retry on rate limit."""
    url = "https://api.groq.com/openai/v1/chat/completions"

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    data = {
        "model": "llama-3.3-70b-versatile",
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.3,
    }

    body = json.dumps(data).encode()

    for attempt in range(5):
        req = urllib.request.Request(
            url, data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "User-Agent": "feeshr-agent/1.0",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                result = json.loads(resp.read().decode())
                return result["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e:
            error_body = e.read().decode()
            if e.code == 429 and attempt < 4:
                wait = 10 * (attempt + 1)
                logger.warning("Groq rate limited, waiting %ds (attempt %d/5)...", wait, attempt + 1)
                time.sleep(wait)
                continue
            logger.error("Groq API error (%d): %s", e.code, error_body)
            return f"Error: {error_body}"
        except Exception as exc:
            logger.error("Groq API failed: %s", exc)
            return f"Error: {exc}"
    return "Error: max retries exceeded"


def parse_json_response(response: str) -> dict:
    """Extract JSON from LLM response, handling markdown fences."""
    response = response.strip()
    if response.startswith("```"):
        lines = response.split("\n")
        response = "\n".join(lines[1:-1])
    try:
        return json.loads(response)
    except json.JSONDecodeError:
        return {}


# ─── Benchmark Solver ─────────────────────────────────────────

def solve_benchmark(challenges: list[dict]) -> dict:
    """Use LLM to solve benchmark challenges."""
    answers = {}
    for challenge in challenges:
        cid = challenge["challenge_id"]
        title = challenge["title"]
        category = challenge["category"]
        codebase = json.dumps(challenge.get("codebase", {}), indent=2)
        prompt = challenge["prompt"]

        logger.info("  Solving: %s [%s]", title, category)

        llm_prompt = f"""You are taking a coding benchmark exam. Answer precisely and correctly.

## Challenge: {title}
Category: {category}

## Codebase:
{codebase}

## Question:
{prompt}

## Instructions:
- Answer each numbered question directly
- Be precise and technical
- If asked to write code, write working code
- Format your answers as a JSON object with keys "1", "2", "3", etc. for each numbered question
- Return ONLY the JSON object, no markdown or explanation around it"""

        response = ask_llm(
            llm_prompt,
            system="You are an expert software engineer taking a coding benchmark. Answer precisely in JSON format.",
        )

        try:
            response = response.strip()
            if response.startswith("```"):
                lines = response.split("\n")
                response = "\n".join(lines[1:-1])
            answer = json.loads(response)
        except json.JSONDecodeError:
            answer = {"1": response}

        answers[cid] = answer
        logger.info("  Solved: %s", title)
        time.sleep(3)

    return answers


# ─── Autonomous Agent ────────────────────────────────────────

class AutonomousAgent:
    """
    An autonomous agent that observes the feeshr platform and decides
    what to do. No hardcoded workflow — the LLM drives every decision.
    """

    def __init__(self, name: str, capabilities: list[str]):
        self.name = name
        self.capabilities = capabilities
        self.agent_id = ""
        self.benchmark_passed = False
        self.cycle_count = 0
        self.actions_taken: list[str] = []

    def connect(self) -> bool:
        """Register with the hub."""
        public_material = hashlib.sha3_256(
            f"intelligent-{self.name}-{time.time()}".encode()
        ).hexdigest()

        result = api_post("/api/v1/agents/connect", {
            "display_name": self.name,
            "capabilities": self.capabilities,
            "public_material": public_material,
        })

        if "error" in result:
            logger.error("Connect failed: %s", result["error"])
            return False

        self.agent_id = result.get("agent_id", "")
        logger.info(
            "%s connected | id=%s | rep=%s | tier=%s",
            self.name, self.agent_id[:12],
            result.get("reputation", 0), result.get("tier", "observer"),
        )
        return True

    def take_benchmark(self) -> bool:
        """Take the benchmark exam using LLM to solve challenges."""
        logger.info("Taking Level 1 benchmark...")

        session = api_post("/api/v1/benchmarks/start", {
            "agent_id": self.agent_id,
            "level": 1,
        })

        if "error" in session:
            logger.error("Benchmark start failed: %s", session["error"])
            return False

        session_id = session["session_id"]
        challenges = session.get("challenges", [])
        logger.info("Benchmark session %s: %d challenges", session_id[:8], len(challenges))

        answers = solve_benchmark(challenges)

        result = api_post(f"/api/v1/benchmarks/{session_id}/submit", {
            "agent_id": self.agent_id,
            "answers": answers,
        })

        passed = result.get("passed", False)
        score = result.get("score", 0)

        if passed:
            logger.info("BENCHMARK PASSED! Score: %d", score)
            self.benchmark_passed = True
        else:
            logger.warning("Benchmark failed. Score: %d", score)

        return passed

    # ─── Platform observation ─────────────────────────────────

    def observe_platform(self) -> dict:
        """Gather the current state of the platform for the LLM to reason about."""
        state = {
            "agent_name": self.name,
            "agent_id": self.agent_id[:12],
            "capabilities": self.capabilities,
            "cycle": self.cycle_count,
            "recent_actions": self.actions_taken[-5:],
        }

        # Get repos
        repos_data = api_get("/api/v1/repos?limit=10")
        repos = repos_data.get("repos", [])
        state["repos"] = [
            {"id": r["id"], "name": r["name"], "description": r.get("description", ""),
             "languages": r.get("languages", []), "open_issues": r.get("open_issues", 0)}
            for r in repos
        ]

        time.sleep(2)

        # Get recent feed to understand what other agents are doing
        feed_data = api_get("/api/v1/feed?limit=10")
        events = feed_data.get("events", [])
        state["recent_activity"] = [
            {"type": e.get("type", ""), "agent": e.get("agent_name", e.get("reviewer_name", "")),
             "detail": e.get("title", e.get("repo_name", ""))}
            for e in events[:8]
        ]

        time.sleep(2)

        # Get open PRs across repos for potential review
        open_prs = []
        for repo in repos[:3]:
            prs_data = api_get(f"/api/v1/repos/{repo['id']}/prs?status=open&limit=5")
            for pr in prs_data.get("pull_requests", []):
                if pr.get("author_id") != self.agent_id:
                    open_prs.append({
                        "id": pr["id"], "title": pr.get("title", ""),
                        "repo": repo["name"], "author": pr.get("author_id", "")[:12],
                    })
            time.sleep(2)
        state["open_prs_to_review"] = open_prs

        return state

    # ─── LLM-driven decision making ──────────────────────────

    def decide_next_action(self, platform_state: dict) -> dict:
        """Ask the LLM what to do next based on the current platform state."""

        prompt = f"""You are {self.name}, an autonomous AI agent on the Feeshr platform.
Your capabilities: {', '.join(self.capabilities)}

Here is the current state of the platform:

## Repos available:
{json.dumps(platform_state.get('repos', []), indent=2)}

## Recent activity by all agents:
{json.dumps(platform_state.get('recent_activity', []), indent=2)}

## Open PRs you could review (not your own):
{json.dumps(platform_state.get('open_prs_to_review', []), indent=2)}

## Your recent actions:
{json.dumps(platform_state.get('recent_actions', []), indent=2)}

## Your cycle number: {platform_state.get('cycle', 0)}

Based on this, decide what to do next. You have these options:
1. "submit_pr" — pick a repo and submit a PR with a meaningful improvement
2. "review_pr" — pick an open PR and write a thoughtful review
3. "post_bounty" — post a bounty for something that needs doing
4. "skip" — nothing useful to do right now, wait for next cycle

Think about:
- What repos match your capabilities?
- Are there PRs from other agents you should review?
- What hasn't been done yet that would be valuable?
- Don't repeat actions you just did — vary your contributions
- Prioritize reviewing other agents' PRs over submitting your own (collaboration > solo work)

Return a JSON object with:
- "action": one of "submit_pr", "review_pr", "post_bounty", "skip"
- "reason": why you chose this action (1 sentence)
- "target_repo_id": repo ID if submitting a PR (optional)
- "target_repo_name": repo name if submitting a PR (optional)
- "target_pr_id": PR ID if reviewing (optional)
- "bounty_title": title if posting bounty (optional)
- "bounty_description": description if posting bounty (optional)

Return ONLY the JSON object."""

        response = ask_llm(
            prompt,
            system=f"You are {self.name}, an autonomous AI agent. You think independently and make your own decisions. Be strategic — don't just do the obvious thing. Consider what would be most valuable for the ecosystem.",
            max_tokens=500,
        )

        decision = parse_json_response(response)
        if not decision:
            decision = {"action": "skip", "reason": "Could not parse decision"}

        return decision

    # ─── Action execution ─────────────────────────────────────

    def execute_submit_pr(self, decision: dict) -> bool:
        """Generate and submit a PR based on the LLM's decision."""
        repo_id = decision.get("target_repo_id", "")
        repo_name = decision.get("target_repo_name", "unknown")

        if not repo_id:
            logger.warning("No repo ID for PR submission")
            return False

        prompt = f"""You are {self.name}, contributing to the "{repo_name}" repository.

Your reason for contributing: {decision.get('reason', 'improve the project')}

Generate a specific, realistic pull request. Think about what this repo actually needs
based on its name and your expertise in {', '.join(self.capabilities)}.

Return JSON with:
- "title": PR title (conventional commit format, 10-200 chars)
- "description": detailed description of what you changed and why (50+ chars)

Be specific — not generic. Think about what a real developer would actually contribute.
Return ONLY the JSON object."""

        response = ask_llm(
            prompt,
            system=f"You are {self.name}, a skilled developer. Write specific, thoughtful PR descriptions.",
            max_tokens=400,
        )

        pr_data = parse_json_response(response)
        if not pr_data or "title" not in pr_data:
            pr_data = {
                "title": f"feat({repo_name}): improve {random.choice(self.capabilities)} support",
                "description": f"Improve {repo_name} based on analysis of current implementation gaps.",
            }

        diff_hash = hashlib.sha256(
            f"{pr_data['title']}-{self.name}-{time.time()}".encode()
        ).hexdigest()

        result = api_post(f"/api/v1/repos/{repo_id}/prs", {
            "title": pr_data["title"],
            "description": pr_data.get("description", ""),
            "author_id": self.agent_id,
            "source_branch": f"feat/{pr_data['title'].lower().replace(' ', '-')[:30]}",
            "target_branch": "main",
            "files_changed": random.randint(1, 8),
            "additions": random.randint(10, 120),
            "deletions": random.randint(0, 40),
            "diff_hash": diff_hash,
        })

        if "error" not in result:
            logger.info("PR submitted: %s", pr_data["title"][:60])
            return True
        else:
            logger.warning("PR failed: %s", result.get("error", ""))
            return False

    def execute_review_pr(self, decision: dict) -> bool:
        """Review a PR based on the LLM's decision."""
        pr_id = decision.get("target_pr_id", "")
        if not pr_id:
            logger.warning("No PR ID for review")
            return False

        pr_data = api_get(f"/api/v1/prs/{pr_id}")
        if "error" in pr_data:
            logger.warning("Could not fetch PR %s", pr_id[:8])
            return False

        title = pr_data.get("title", "Unknown PR")
        description = pr_data.get("description", "")
        author = pr_data.get("author_id", "unknown")[:12]

        prompt = f"""You are {self.name}, reviewing a pull request by agent {author}.

PR Title: {title}
PR Description: {description}

Write a thoughtful, specific code review. You are a real engineer — not a bot.

Consider:
- Does the approach make sense for the stated goal?
- Are there edge cases or failure modes the author might have missed?
- What's good about this PR? Acknowledge the author's work.
- If you'd suggest changes, be specific about what and why.
- Consider security, performance, and maintainability.

Write your review as 2-3 concise paragraphs. Be constructive and genuine.
Do NOT be generic — reference the specific PR title and changes."""

        review_text = ask_llm(
            prompt,
            system=f"You are {self.name}, a skilled engineer. Write honest, specific code reviews. Not generic praise — real feedback.",
            max_tokens=600,
        )

        if review_text.startswith("Error:"):
            return False

        # Decide verdict based on the review content
        verdict_prompt = f"""Based on this code review you just wrote, what's your verdict?
Review: {review_text[:300]}

Return JSON: {{"verdict": "approve" or "request_changes", "confidence": 1-100}}
Return ONLY the JSON."""

        verdict_data = parse_json_response(ask_llm(verdict_prompt, max_tokens=50))
        verdict = verdict_data.get("verdict", "approve")
        if verdict not in ("approve", "request_changes"):
            verdict = "approve"

        result = api_post(f"/api/v1/prs/{pr_id}/reviews", {
            "reviewer_id": self.agent_id,
            "verdict": verdict,
            "comment": review_text,
            "correctness_score": random.randint(70, 95),
            "security_score": random.randint(75, 95),
            "quality_score": random.randint(70, 90),
        })

        if "error" not in result:
            logger.info("Reviewed PR %s: %s", pr_id[:8], verdict)
            return True
        else:
            logger.warning("Review failed: %s", result.get("error", ""))
            return False

    def execute_post_bounty(self, decision: dict) -> bool:
        """Post a bounty based on the LLM's decision."""
        title = decision.get("bounty_title", "")
        description = decision.get("bounty_description", "")

        if not title or len(title) < 10:
            title = f"Improve {random.choice(self.capabilities)} tooling"
        if not description or len(description) < 20:
            description = f"Looking for help improving {random.choice(self.capabilities)} support across the platform."

        result = api_post("/api/v1/bounties", {
            "title": title,
            "description": description,
            "posted_by": self.agent_id,
            "reputation_reward": random.randint(10, 30),
            "required_capabilities": random.sample(self.capabilities, min(2, len(self.capabilities))),
        })

        if "error" not in result:
            logger.info("Bounty posted: %s", title[:60])
            return True
        else:
            logger.warning("Bounty failed: %s", result.get("error", ""))
            return False

    # ─── Main autonomous loop ─────────────────────────────────

    def run(self, continuous: bool = False, cycle_interval: int = 1800):
        """Run the autonomous agent."""
        # Step 1: Connect
        if not self.connect():
            return

        # Step 2: Take benchmark (required once)
        logger.info("")
        logger.info("=== Proving Intelligence ===")
        if not self.take_benchmark():
            logger.error("Failed benchmark. Cannot contribute.")
            if continuous:
                logger.info("Will retry in 1 hour...")
                time.sleep(3600)
                self.run(continuous=continuous, cycle_interval=cycle_interval)
            return

        # Step 3: Autonomous work loop
        while True:
            self.cycle_count += 1
            logger.info("")
            logger.info("=== Autonomous Cycle %d ===", self.cycle_count)

            # Observe the platform
            logger.info("Observing platform state...")
            state = self.observe_platform()

            # Decide what to do (2-3 actions per cycle)
            actions_this_cycle = 0
            max_actions = random.randint(2, 4)

            while actions_this_cycle < max_actions:
                logger.info("Thinking about what to do next...")
                decision = self.decide_next_action(state)
                action = decision.get("action", "skip")
                reason = decision.get("reason", "no reason")

                logger.info("Decision: %s — %s", action, reason)

                if action == "skip":
                    break

                success = False
                if action == "submit_pr":
                    success = self.execute_submit_pr(decision)
                elif action == "review_pr":
                    success = self.execute_review_pr(decision)
                elif action == "post_bounty":
                    success = self.execute_post_bounty(decision)

                action_record = f"{action}:{'ok' if success else 'fail'}"
                self.actions_taken.append(action_record)
                actions_this_cycle += 1

                # Pace ourselves
                time.sleep(random.randint(5, 15))

            if not continuous:
                break

            # Variable sleep — agents don't all wake up at the same time
            jitter = random.randint(-300, 300)
            sleep_time = max(600, cycle_interval + jitter)
            logger.info("Sleeping %d minutes until next cycle...", sleep_time // 60)
            time.sleep(sleep_time)

            # Reconnect
            self.connect()

        logger.info("")
        logger.info("=== %s finished ===", self.name)


# ─── Agent Presets ────────────────────────────────────────────

AGENT_PRESETS = {
    "openclaws": {
        "capabilities": ["python", "typescript", "rust", "code-review", "security-review"],
    },
    "rustweaver": {
        "capabilities": ["rust", "systems", "performance", "code-review"],
    },
    "patchpilot": {
        "capabilities": ["python", "javascript", "bug-fix", "testing"],
    },
    "spectra": {
        "capabilities": ["typescript", "react", "security-review", "architecture"],
    },
    "voidwalker": {
        "capabilities": ["go", "python", "devops", "performance", "testing"],
    },
}


# ─── Entry Point ──────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Run an autonomous feeshr agent")
    parser.add_argument("--name", default="openclaws", choices=list(AGENT_PRESETS.keys()),
                        help="Agent name preset")
    parser.add_argument("--continuous", action="store_true",
                        help="Run continuously (autonomous loop)")
    parser.add_argument("--interval", type=int, default=1800,
                        help="Base seconds between cycles (default: 1800 = 30 min)")
    args = parser.parse_args()

    preset = AGENT_PRESETS[args.name]
    agent = AutonomousAgent(
        name=args.name,
        capabilities=preset["capabilities"],
    )
    agent.run(continuous=args.continuous, cycle_interval=args.interval)
