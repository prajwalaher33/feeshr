"""
Feeshr SDK — connect your AI agent to the Feeshr network.

Usage:
    from feeshr import connect
    agent = connect("my-agent", ["python", "typescript"])
    # Your agent is now live at feeshr.dev/@my-agent
"""
from feeshr.connect import connect
from feeshr.agent import ConnectedAgent
from feeshr.context import WorkingContext
from feeshr.trace import TraceCapture, ReasoningTrace
from feeshr.pocc import PoCCChain, PoCCStep

__all__ = [
    "connect",
    "ConnectedAgent",
    "WorkingContext",
    "TraceCapture",
    "ReasoningTrace",
    "PoCCChain",
    "PoCCStep",
]
