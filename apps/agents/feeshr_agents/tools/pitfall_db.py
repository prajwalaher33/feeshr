"""
Pitfall database — shared knowledge about known anti-patterns.

Agents add entries when they discover anti-patterns during reviews.
Other agents query before writing code to avoid known mistakes.

Usage:
    from feeshr_agents.tools.pitfall_db import PitfallDB

    db = PitfallDB(hub_url="http://localhost:8080")
    results = db.query("python file handling")
    # Returns list of known pitfalls matching the query
"""
import json
import logging
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


@dataclass
class Pitfall:
    """
    A known anti-pattern in the shared knowledge base.

    Attributes:
        title: Short description of the pitfall
        pattern: The problematic code pattern (as a string or regex)
        fix: How to fix or avoid this pattern
        language: Programming language this applies to (None = all)
        source_ref: Link to PR/review/bounty where this was discovered
        contributed_by: Agent ID who contributed this entry
    """
    title: str
    pattern: str
    fix: str
    language: Optional[str]
    source_ref: Optional[str]
    contributed_by: str


class PitfallDB:
    """
    Client for the shared pitfall database.

    Queries the hub's shared_knowledge table for pitfall entries.
    Results are cached for 5 minutes to reduce hub load.

    Args:
        hub_url: URL of the Feeshr hub
        timeout: Request timeout in seconds
    """

    def __init__(self, hub_url: str, timeout: int = 5) -> None:
        self.hub_url = hub_url.rstrip("/")
        self.timeout = timeout
        self._cache: Dict[str, Tuple[float, List[Pitfall]]] = {}
        self._cache_ttl = 300  # 5 minutes

    def query(self, search_term: str, language: Optional[str] = None) -> List[Pitfall]:
        """
        Search the pitfall database.

        Args:
            search_term: Free-text search term
            language: Optional language filter (e.g., "python", "typescript")

        Returns:
            List of matching Pitfall entries, most relevant first

        Raises:
            RuntimeError: If the hub is unreachable
        """
        import time
        cache_key = f"{search_term}:{language}"
        cached = self._cache.get(cache_key)
        if cached and (time.time() - cached[0]) < self._cache_ttl:
            return cached[1]

        results = self._fetch_pitfalls(search_term, language)
        self._cache[cache_key] = (time.time(), results)
        return results

    def add(
        self,
        agent_id: str,
        title: str,
        pattern: str,
        fix: str,
        language: Optional[str] = None,
        source_ref: Optional[str] = None,
    ) -> None:
        """
        Add a new pitfall to the shared database.

        Args:
            agent_id: The contributing agent's ID
            title: Short description of the pitfall
            pattern: The problematic code pattern
            fix: How to avoid or fix it
            language: Optional language (e.g., "python")
            source_ref: Link to where this was discovered
        """
        payload = json.dumps({
            "category": "pitfall",
            "title": title,
            "content": f"Pattern: {pattern}\n\nFix: {fix}",
            "language": language,
            "contributed_by": agent_id,
            "source_ref": source_ref,
            "tags": [language] if language else [],
        }).encode()

        try:
            req = urllib.request.Request(
                f"{self.hub_url}/api/v1/knowledge",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=self.timeout):
                pass
        except Exception as exc:
            logger.warning("Failed to add pitfall to hub: %s", exc)

    def _fetch_pitfalls(
        self,
        search_term: str,
        language: Optional[str],
    ) -> List[Pitfall]:
        """
        Fetch pitfalls from the hub API.

        Args:
            search_term: Search query
            language: Optional language filter

        Returns:
            List of Pitfall objects
        """
        params: Dict[str, str] = {"q": search_term, "category": "pitfall"}
        if language:
            params["language"] = language

        query_str = urllib.parse.urlencode(params)
        url = f"{self.hub_url}/api/v1/knowledge?{query_str}"

        try:
            with urllib.request.urlopen(url, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode())
                return [self._parse_pitfall(item) for item in data.get("items", [])]
        except Exception as exc:
            logger.warning("Failed to fetch pitfalls: %s", exc)
            return []

    def _parse_pitfall(self, item: Dict[str, Any]) -> Pitfall:
        """
        Parse a hub knowledge item into a Pitfall.

        Args:
            item: Raw knowledge item dict from the hub

        Returns:
            A Pitfall dataclass instance
        """
        content = item.get("content", "")
        parts = content.split("\n\nFix: ", 1)
        pattern = parts[0].replace("Pattern: ", "") if parts else content
        fix = parts[1] if len(parts) > 1 else ""

        return Pitfall(
            title=item.get("title", ""),
            pattern=pattern,
            fix=fix,
            language=item.get("language"),
            source_ref=item.get("source_ref"),
            contributed_by=item.get("contributed_by", ""),
        )
