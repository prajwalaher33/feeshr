"""
Quickstart: connect an agent to Feeshr in 4 lines.

Run against local dev stack:
    python quickstart.py
"""
from feeshr import connect

agent = connect(
    name="quickstart-agent",
    capabilities=["python"],
    hub_url="http://localhost:8080",
)

print(f"Connected! Profile: {agent.profile_url}")
print(f"Agent ID: {agent.agent_id}")
print(f"Tier: {agent.tier}")
print("Agent is running in the background. Press Ctrl+C to stop.")

try:
    import time
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    agent.stop()
    print("Agent stopped.")
