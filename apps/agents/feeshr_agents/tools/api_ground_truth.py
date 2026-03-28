"""
API ground truth — verified function signatures for major libraries.

Signatures are verified by actually importing libraries in sandboxed
environments, not from documentation that may be outdated.

Usage:
    from feeshr_agents.tools.api_ground_truth import ApiGroundTruth

    gt = ApiGroundTruth(hub_url="http://localhost:8080")
    result = gt.lookup("pandas", "json_normalize", python_version="3.12")
    # Returns verified signature or None if not found
"""
import json
import logging
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Dict, Optional

logger = logging.getLogger(__name__)


@dataclass
class ApiSignature:
    """
    A verified function signature.

    Attributes:
        module: Package name (e.g., "pandas")
        function: Function name (e.g., "json_normalize")
        import_path: Full import path (e.g., "pd.json_normalize")
        signature: Function signature string
        since_version: Version when this signature became available
        deprecated: Whether this function is deprecated
        verified_at: ISO 8601 timestamp of last verification
    """
    module: str
    function: str
    import_path: str
    signature: str
    since_version: str
    deprecated: bool
    verified_at: str


class ApiGroundTruth:
    """
    Client for verified API signatures.

    Prevents hallucination of function signatures by grounding
    agent code generation in verified runtime signatures.

    Args:
        hub_url: URL of the Feeshr hub
        timeout: Request timeout in seconds
    """

    def __init__(self, hub_url: str, timeout: int = 5) -> None:
        self.hub_url = hub_url.rstrip("/")
        self.timeout = timeout
        self._cache: Dict[str, Optional[ApiSignature]] = {}

    def lookup(
        self,
        module: str,
        function: str,
        python_version: str = "3.12",
    ) -> Optional[ApiSignature]:
        """
        Look up a verified function signature.

        Args:
            module: Package name (e.g., "pandas", "requests")
            function: Function name (e.g., "json_normalize", "get")
            python_version: Python version to check against

        Returns:
            ApiSignature if found and verified, None otherwise
        """
        cache_key = f"{module}:{function}:{python_version}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        result = self._fetch_signature(module, function, python_version)
        self._cache[cache_key] = result
        return result

    def _fetch_signature(
        self,
        module: str,
        function: str,
        python_version: str,
    ) -> Optional[ApiSignature]:
        """
        Fetch a verified signature from the hub.

        Args:
            module: Package name
            function: Function name
            python_version: Target Python version

        Returns:
            ApiSignature if found, None otherwise
        """
        params = urllib.parse.urlencode({
            "module": module,
            "function": function,
            "python_version": python_version,
            "category": "api_signature",
        })
        url = f"{self.hub_url}/api/v1/knowledge/signatures?{params}"

        try:
            with urllib.request.urlopen(url, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode())
                if not data:
                    return None
                return ApiSignature(
                    module=data.get("module", module),
                    function=data.get("function", function),
                    import_path=data.get("import_path", f"{module}.{function}"),
                    signature=data.get("signature", ""),
                    since_version=data.get("since_version", ""),
                    deprecated=data.get("deprecated", False),
                    verified_at=data.get("verified_at", ""),
                )
        except Exception as exc:
            logger.debug("API signature lookup failed for %s.%s: %s", module, function, exc)
            return None
