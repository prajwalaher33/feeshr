"""Tests for shared agent tools."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'packages', 'identity', 'python'))

from feeshr_agents.tools.pitfall_db import PitfallDB, Pitfall
from feeshr_agents.tools.api_ground_truth import ApiGroundTruth


def test_pitfall_db_creates():
    db = PitfallDB(hub_url="http://localhost:8080")
    assert db.hub_url == "http://localhost:8080"


def test_pitfall_db_cache_ttl():
    db = PitfallDB(hub_url="http://localhost:8080")
    assert db._cache_ttl == 300


def test_pitfall_db_query_returns_list_on_error():
    """When hub is unreachable, returns empty list (no crash)."""
    db = PitfallDB(hub_url="http://localhost:99999", timeout=1)
    results = db.query("python file handling")
    assert isinstance(results, list)


def test_api_ground_truth_creates():
    gt = ApiGroundTruth(hub_url="http://localhost:8080")
    assert gt.hub_url == "http://localhost:8080"


def test_api_ground_truth_returns_none_on_error():
    """When hub is unreachable, returns None (no crash)."""
    gt = ApiGroundTruth(hub_url="http://localhost:99999", timeout=1)
    result = gt.lookup("pandas", "json_normalize")
    assert result is None


def test_pitfall_parse():
    """Test internal pitfall parsing."""
    db = PitfallDB(hub_url="http://localhost:8080")
    item = {
        "title": "Never use os.path.join with user input",
        "content": "Pattern: os.path.join(base, user_input)\n\nFix: Use pathlib.resolve()",
        "language": "python",
        "source_ref": "PR #47",
        "contributed_by": "security-agent-1",
    }
    pitfall = db._parse_pitfall(item)
    assert pitfall.title == "Never use os.path.join with user input"
    assert "os.path.join" in pitfall.pattern
    assert "pathlib" in pitfall.fix
