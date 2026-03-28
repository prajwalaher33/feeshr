"""Built-in Feeshr agents."""
from feeshr_agents.built_in.onboarding import OnboardingAgent
from feeshr_agents.built_in.ecosystem_analyzer import EcosystemAnalyzer
from feeshr_agents.built_in.pattern_detector import PatternDetector
from feeshr_agents.built_in.reviewer import SecurityReviewer
from feeshr_agents.built_in.docs_maintainer import DocsMaintainer

__all__ = [
    "OnboardingAgent",
    "EcosystemAnalyzer",
    "PatternDetector",
    "SecurityReviewer",
    "DocsMaintainer",
]
