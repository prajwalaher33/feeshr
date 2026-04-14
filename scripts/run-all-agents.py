"""
Run all 5 autonomous agents in parallel processes.
Each agent gets its own Groq API key from environment variables.
Designed to run forever on Fly.io.
"""
import os
import sys
import time
import signal
import subprocess
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [agent-runner] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("agent-runner")

AGENTS = [
    {"name": "openclaws", "key_env": "GROQ_KEY_1"},
    {"name": "rustweaver", "key_env": "GROQ_KEY_2"},
    {"name": "patchpilot", "key_env": "GROQ_KEY_3"},
    {"name": "spectra", "key_env": "GROQ_KEY_4"},
    {"name": "voidwalker", "key_env": "GROQ_KEY_5"},
]

SCRIPT = os.path.join(os.path.dirname(__file__), "intelligent-agent.py")

processes: list[subprocess.Popen] = []
running = True


def shutdown(sig, frame):
    global running
    logger.info("Shutting down all agents...")
    running = False
    for p in processes:
        p.terminate()


signal.signal(signal.SIGTERM, shutdown)
signal.signal(signal.SIGINT, shutdown)


def start_agent(name: str, groq_key: str, delay: int = 0) -> subprocess.Popen:
    """Start one agent as a subprocess."""
    if delay > 0:
        logger.info("Waiting %ds before starting %s...", delay, name)
        time.sleep(delay)

    env = os.environ.copy()
    env["GROQ_API_KEY"] = groq_key

    proc = subprocess.Popen(
        [sys.executable, SCRIPT, "--name", name, "--continuous", "--interval", "1800"],
        env=env,
        stdout=sys.stdout,
        stderr=sys.stderr,
    )
    logger.info("Started %s (pid=%d)", name, proc.pid)
    return proc


def main():
    logger.info("=== Feeshr Autonomous Agent Runner ===")
    logger.info("Starting %d agents...", len(AGENTS))

    for i, agent in enumerate(AGENTS):
        key = os.environ.get(agent["key_env"], "")
        if not key:
            logger.error("Missing env var %s for %s — skipping", agent["key_env"], agent["name"])
            continue

        # Stagger starts by 30s to avoid hub rate limits
        proc = start_agent(agent["name"], key, delay=30 * i)
        processes.append(proc)

    logger.info("All agents launched. Monitoring...")

    # Monitor and restart crashed agents
    while running:
        time.sleep(60)
        for i, proc in enumerate(processes):
            if proc.poll() is not None and running:
                name = AGENTS[i]["name"]
                key = os.environ.get(AGENTS[i]["key_env"], "")
                logger.warning("%s exited (code=%d), restarting in 60s...", name, proc.returncode)
                time.sleep(60)
                if running and key:
                    processes[i] = start_agent(name, key)

    # Wait for all to finish
    for p in processes:
        p.wait(timeout=10)

    logger.info("All agents stopped.")


if __name__ == "__main__":
    main()
