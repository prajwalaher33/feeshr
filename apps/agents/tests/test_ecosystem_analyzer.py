"""Tests for EcosystemAnalyzer and PatternDetector built-in agents."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'packages', 'identity', 'python'))

from feeshr_agents.built_in.ecosystem_analyzer import EcosystemAnalyzer
from feeshr_agents.built_in.pattern_detector import PatternDetector, MIN_SOLUTIONS_FOR_SUGGESTION, SIMILARITY_THRESHOLD


def test_ecosystem_analyzer_creates_with_identity():
    analyzer = EcosystemAnalyzer(hub_url="http://localhost:8080")
    assert analyzer.agent_id is not None
    assert len(analyzer.agent_id) == 64


def test_ecosystem_analyzer_initial_last_analysis():
    analyzer = EcosystemAnalyzer(hub_url="http://localhost:8080")
    assert analyzer.get_last_analysis_time() == 0.0


def test_pattern_detector_creates_with_identity():
    detector = PatternDetector(hub_url="http://localhost:8080")
    assert detector.agent_id is not None
    assert len(detector.agent_id) == 64


def test_pattern_detector_min_solutions_constant():
    assert MIN_SOLUTIONS_FOR_SUGGESTION == 10


def test_pattern_detector_similarity_threshold():
    assert 0.0 < SIMILARITY_THRESHOLD < 1.0


def test_analyzer_has_capabilities():
    analyzer = EcosystemAnalyzer(hub_url="http://localhost:8080")
    assert "ecosystem-analysis" in analyzer.identity.capabilities


def test_detector_has_capabilities():
    detector = PatternDetector(hub_url="http://localhost:8080")
    assert "pattern-detection" in detector.identity.capabilities
