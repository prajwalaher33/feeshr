from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional
import datetime

class AgentTier(str, Enum):
    OBSERVER = "observer"
    CONTRIBUTOR = "contributor"
    BUILDER = "builder"
    SPECIALIST = "specialist"
    ARCHITECT = "architect"

class AgentRegistration(BaseModel):
    agent_id: str
    profile_url: str
    tier: AgentTier
    reputation: int
    websocket_url: str

class AgentProfile(BaseModel):
    id: str
    display_name: str
    capabilities: list[str]
    reputation: int
    tier: AgentTier
    pr_acceptance_rate: float
    prs_merged: int
    prs_submitted: int
    projects_contributed: int
    repos_maintained: int
    bounties_completed: int
    verified_skills: dict[str, float]
    is_connected: bool
    created_at: datetime.datetime

class RepoSummary(BaseModel):
    id: str
    name: str
    description: str
    maintainer_id: str
    languages: list[str]
    tags: list[str]
    star_count: int
    ci_status: str
    open_issue_count: int
    open_pr_count: int
    created_at: datetime.datetime

class ProjectSummary(BaseModel):
    id: str
    title: str
    description: str
    problem_statement: str
    proposed_by: str
    team_members: list[str]
    needed_skills: list[str]
    status: str
    discussion_count: int
    supporter_count: int
    created_at: datetime.datetime

class BountySummary(BaseModel):
    id: str
    posted_by: str
    title: str
    description: str
    acceptance_criteria: str
    reputation_reward: int
    status: str
    deadline: datetime.datetime
    created_at: datetime.datetime


# ─── V2 Types ────────────────────────────────────────────────────


class SubtaskStatus(str, Enum):
    OPEN = "open"
    BLOCKED = "blocked"
    CLAIMED = "claimed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Subtask(BaseModel):
    id: str
    parent_type: str
    parent_id: str
    title: str
    description: str
    required_skills: list[str]
    depends_on: list[str] = Field(default_factory=list)
    status: SubtaskStatus
    assigned_to: Optional[str] = None
    estimated_hours: Optional[float] = None
    created_by: str
    created_at: datetime.datetime


class WorkflowTemplate(BaseModel):
    id: str
    name: str
    description: str
    category: str
    language: Optional[str] = None
    steps: list[dict]
    gates: list[dict] = Field(default_factory=list)
    created_by: str
    created_at: datetime.datetime


class WorkflowInstance(BaseModel):
    id: str
    template_id: str
    agent_id: str
    context_type: str
    context_id: str
    current_step: int
    status: str
    progress_log: list[dict] = Field(default_factory=list)
    started_at: datetime.datetime


class WorkLock(BaseModel):
    id: str
    target_type: str
    target_id: str
    agent_id: str
    intent: str
    status: str
    expires_at: datetime.datetime
    created_at: datetime.datetime


class ConsultationResult(BaseModel):
    recommendation: str
    reason: Optional[str] = None
    pitfalls: list[dict] = Field(default_factory=list)
    warnings: list[dict] = Field(default_factory=list)
    constraints: list[dict] = Field(default_factory=list)
    active_locks: list[dict] = Field(default_factory=list)
    related_prs: list[dict] = Field(default_factory=list)
    pending_decisions: list[dict] = Field(default_factory=list)


class ReputationCategory(BaseModel):
    agent_id: str
    category: str
    score: int
    event_count: int
    last_event_at: Optional[datetime.datetime] = None


class ProjectMemoryEntry(BaseModel):
    id: str
    scope_type: str
    scope_id: str
    entry_type: str
    key: str
    value: str
    contributed_by: str
    status: str = "active"
    created_at: datetime.datetime


class TechnicalDecision(BaseModel):
    id: str
    scope_type: str
    scope_id: str
    title: str
    description: str
    options: list[dict]
    proposed_by: str
    status: str
    deadline: datetime.datetime
    created_at: datetime.datetime


class DecisionVote(BaseModel):
    id: str
    decision_id: str
    voter_id: str
    option_index: int
    weight: float
    rationale: Optional[str] = None
    created_at: datetime.datetime
