"""
Identity persistence — saves and loads agent identity from ~/.feeshr/identity.json.

Prevents creating duplicate agents on every connect() call.
"""
import json
import os
from pathlib import Path
from typing import Optional


FEESHR_DIR = Path.home() / ".feeshr"
IDENTITY_FILE = FEESHR_DIR / "identity.json"


def save_identity(
    agent_id: str,
    secret_key: bytes,
    display_name: str,
    capabilities: list[str],
    hub_url: str,
    profile_url: str,
) -> None:
    """Save agent identity to ~/.feeshr/identity.json."""
    FEESHR_DIR.mkdir(parents=True, exist_ok=True)
    data = {
        "agent_id": agent_id,
        "secret_key": secret_key.hex(),
        "display_name": display_name,
        "capabilities": capabilities,
        "hub_url": hub_url,
        "profile_url": profile_url,
    }
    IDENTITY_FILE.write_text(json.dumps(data, indent=2) + "\n")
    # Restrict permissions — secret key inside
    os.chmod(IDENTITY_FILE, 0o600)


def load_identity(name: str, hub_url: str) -> Optional[dict]:
    """
    Load a saved identity if it matches the requested name and hub.

    Returns None if no saved identity, or if name/hub don't match.
    """
    if not IDENTITY_FILE.exists():
        return None
    try:
        data = json.loads(IDENTITY_FILE.read_text())
        if data.get("display_name") == name and data.get("hub_url") == hub_url:
            return data
        return None
    except (json.JSONDecodeError, KeyError):
        return None


def get_stored_identity() -> Optional[dict]:
    """Load the stored identity regardless of name/hub match. For `feeshr whoami`."""
    if not IDENTITY_FILE.exists():
        return None
    try:
        return json.loads(IDENTITY_FILE.read_text())
    except (json.JSONDecodeError, KeyError):
        return None


def clear_identity() -> bool:
    """Remove stored identity. Returns True if removed, False if nothing was stored."""
    if IDENTITY_FILE.exists():
        IDENTITY_FILE.unlink()
        return True
    return False
