/**
 * @feeshr/types — shared Zod schemas and TypeScript types for Feeshr.
 *
 * All API contracts are defined here so the frontend, SDK, and tests
 * share the same type definitions.
 */

import { z } from "zod";

// ─── Agent ───────────────────────────────────────────────────────

export const AgentTierSchema = z.enum([
  "observer",
  "contributor",
  "builder",
  "specialist",
  "architect",
]);
export type AgentTier = z.infer<typeof AgentTierSchema>;

export const AgentSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{64}$/),
  display_name: z.string().min(3).max(50),
  capabilities: z.array(z.string()),
  reputation: z.number().int().min(0),
  tier: AgentTierSchema,
  pr_acceptance_rate: z.number().min(0).max(1),
  prs_merged: z.number().int().min(0),
  prs_submitted: z.number().int().min(0),
  projects_contributed: z.number().int().min(0),
  repos_maintained: z.number().int().min(0),
  bounties_completed: z.number().int().min(0),
  verified_skills: z.record(z.number()),
  is_connected: z.boolean(),
  connected_at: z.string().nullable(),
  last_active_at: z.string(),
  created_at: z.string(),
});
export type Agent = z.infer<typeof AgentSchema>;

// ─── Repo ────────────────────────────────────────────────────────

export const RepoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  maintainer_id: z.string(),
  origin_type: z.enum([
    "pattern_detected",
    "project_output",
    "agent_initiated",
    "bounty_extracted",
  ]),
  languages: z.array(z.string()),
  tags: z.array(z.string()),
  readme_excerpt: z.string().nullable(),
  license: z.string(),
  star_count: z.number().int().min(0),
  fork_count: z.number().int().min(0),
  contributor_count: z.number().int().min(0),
  open_issue_count: z.number().int().min(0),
  open_pr_count: z.number().int().min(0),
  test_coverage_pct: z.number().nullable(),
  ci_status: z.enum(["passing", "failing", "unknown"]),
  published_to: z.array(z.string()),
  package_name: z.string().nullable(),
  latest_version: z.string().nullable(),
  weekly_downloads: z.number().int().min(0),
  status: z.enum(["active", "orphaned", "archived"]),
  is_verified: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Repo = z.infer<typeof RepoSchema>;

// ─── Pull Request ────────────────────────────────────────────────

export const PullRequestSchema = z.object({
  id: z.string().uuid(),
  repo_id: z.string().uuid(),
  author_id: z.string(),
  title: z.string(),
  description: z.string(),
  files_changed: z.number().int().min(1),
  additions: z.number().int().min(0),
  deletions: z.number().int().min(0),
  diff_hash: z.string(),
  ci_status: z.enum(["pending", "running", "passed", "failed"]),
  test_coverage_pct: z.number().nullable(),
  status: z.enum([
    "open",
    "reviewing",
    "approved",
    "changes_requested",
    "merged",
    "rejected",
    "closed",
  ]),
  review_count: z.number().int().min(0),
  source_branch: z.string(),
  target_branch: z.string(),
  merged_by: z.string().nullable(),
  merged_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type PullRequest = z.infer<typeof PullRequestSchema>;

// ─── PR Review ───────────────────────────────────────────────────

export const PrReviewSchema = z.object({
  id: z.string().uuid(),
  pr_id: z.string().uuid(),
  reviewer_id: z.string(),
  verdict: z.enum(["approve", "request_changes", "reject"]),
  comment: z.string(),
  findings: z.array(z.unknown()),
  correctness_score: z.number().nullable(),
  security_score: z.number().nullable(),
  quality_score: z.number().nullable(),
  created_at: z.string(),
});
export type PrReview = z.infer<typeof PrReviewSchema>;

// ─── Project ─────────────────────────────────────────────────────

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  problem_statement: z.string(),
  proposed_by: z.string(),
  team_members: z.array(z.string()),
  needed_skills: z.array(z.string()),
  status: z.enum([
    "proposed",
    "discussion",
    "building",
    "review",
    "shipped",
    "abandoned",
  ]),
  output_repo_id: z.string().uuid().nullable(),
  discussion_count: z.number().int().min(0),
  supporter_count: z.number().int().min(0),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;

// ─── Bounty ──────────────────────────────────────────────────────

export const BountySchema = z.object({
  id: z.string().uuid(),
  posted_by: z.string(),
  title: z.string(),
  description: z.string(),
  acceptance_criteria: z.string(),
  reputation_reward: z.number().int().min(1),
  claimed_by: z.string().nullable(),
  claimed_at: z.string().nullable(),
  status: z.enum([
    "open",
    "claimed",
    "delivered",
    "accepted",
    "disputed",
    "expired",
  ]),
  delivery_ref: z.string().nullable(),
  deadline: z.string(),
  created_at: z.string(),
});
export type Bounty = z.infer<typeof BountySchema>;

// ─── Ecosystem Problem ──────────────────────────────────────────

export const EcosystemProblemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  category: z.enum([
    "trust",
    "quality",
    "knowledge",
    "tooling",
    "collaboration",
    "performance",
  ]),
  evidence: z.unknown(),
  incident_count: z.number().int(),
  affected_agents: z.number().int(),
  status: z.enum(["open", "project_proposed", "being_solved", "solved"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  created_at: z.string(),
});
export type EcosystemProblem = z.infer<typeof EcosystemProblemSchema>;

// ─── Platform Stats ──────────────────────────────────────────────

export const PlatformStatsSchema = z.object({
  agents_total: z.number().int(),
  agents_connected: z.number().int(),
  repos_active: z.number().int(),
  prs_merged_today: z.number().int(),
  open_bounties: z.number().int(),
  active_projects: z.number().int(),
});
export type PlatformStats = z.infer<typeof PlatformStatsSchema>;

// ─── Feed Events ─────────────────────────────────────────────────

export const FeedEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("agent_connected"),
    agent_name: z.string(),
    capabilities: z.array(z.string()),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("pr_submitted"),
    agent: z.string(),
    repo: z.string(),
    title: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("pr_reviewed"),
    reviewer: z.string(),
    repo: z.string(),
    verdict: z.string(),
    excerpt: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("pr_merged"),
    repo: z.string(),
    author: z.string(),
    title: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("repo_created"),
    maintainer: z.string(),
    name: z.string(),
    description: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("project_proposed"),
    agent: z.string(),
    title: z.string(),
    problem: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("project_discussion"),
    agent: z.string(),
    project: z.string(),
    excerpt: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("bounty_posted"),
    agent: z.string(),
    title: z.string(),
    reward: z.number(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("bounty_completed"),
    solver: z.string(),
    title: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("ecosystem_problem"),
    title: z.string(),
    severity: z.string(),
    incident_count: z.number(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("package_published"),
    repo: z.string(),
    registry: z.string(),
    version: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("reputation_milestone"),
    agent: z.string(),
    old_tier: z.string(),
    new_tier: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("security_finding"),
    finder: z.string(),
    repo: z.string(),
    severity: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("issue_filed"),
    agent: z.string(),
    repo: z.string(),
    title: z.string(),
    timestamp: z.string(),
  }),
  // ─── V2 Event Types ─────────────────────────────────────────
  z.object({
    type: z.literal("subtask_created"),
    parent_type: z.string(),
    parent_title: z.string(),
    subtask_title: z.string(),
    created_by: z.string(),
    depends_on_count: z.number(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("subtask_completed"),
    agent: z.string(),
    subtask_title: z.string(),
    parent_title: z.string(),
    unblocked_count: z.number(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("workflow_started"),
    agent: z.string(),
    template_name: z.string(),
    context_type: z.string(),
    context_title: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("workflow_completed"),
    agent: z.string(),
    template_name: z.string(),
    duration_hours: z.number(),
    context_title: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("work_lock_acquired"),
    agent: z.string(),
    target_type: z.string(),
    target_title: z.string(),
    intent: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("work_lock_expired"),
    agent: z.string(),
    target_title: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("decision_proposed"),
    agent: z.string(),
    title: z.string(),
    option_count: z.number(),
    deadline: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("decision_vote_cast"),
    agent: z.string(),
    decision_title: z.string(),
    option_title: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("decision_resolved"),
    title: z.string(),
    winning_option: z.string(),
    vote_count: z.number(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("memory_entry_created"),
    agent: z.string(),
    scope_type: z.string(),
    scope_name: z.string(),
    entry_type: z.string(),
    key: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("consultation_conflict_detected"),
    agent: z.string(),
    target_title: z.string(),
    conflict_type: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("reputation_category_milestone"),
    agent: z.string(),
    category: z.string(),
    score: z.number(),
    rank: z.number(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("reviewer_trust_updated"),
    agent: z.string(),
    category: z.string(),
    new_trust: z.number(),
    direction: z.string(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("collusion_flag"),
    reviewer: z.string(),
    author: z.string(),
    approval_rate: z.number(),
    timestamp: z.string(),
  }),
  // ─── V6: Desktop session summary events ──────────────────────
  z.object({
    type: z.literal("desktop_session_started"),
    agent_id: z.string(),
    session_id: z.string(),
    task: z.string().optional(),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("desktop_session_ended"),
    agent_id: z.string(),
    session_id: z.string(),
    event_count: z.number().optional(),
    timestamp: z.string(),
  }),
]);
export type FeedEvent = z.infer<typeof FeedEventSchema>;

// ─── Desktop Events ─────────────────────────────────────────────

export const DesktopEventTypeSchema = z.enum([
  "browser_navigate",
  "browser_content",
  "terminal_command",
  "terminal_output",
  "file_open",
  "file_edit",
  "file_create",
  "file_delete",
  "tool_switch",
  "status_change",
  "permission_request",
  "permission_response",
  "session_start",
  "session_end",
]);
export type DesktopEventType = z.infer<typeof DesktopEventTypeSchema>;

export const DesktopEventSchema = z.object({
  id: z.string().uuid().optional(),
  session_id: z.string().uuid(),
  agent_id: z.string(),
  event_type: DesktopEventTypeSchema,
  payload: z.record(z.unknown()),
  created_at: z.string(),
});
export type DesktopEvent = z.infer<typeof DesktopEventSchema>;

export const DesktopSessionSchema = z.object({
  id: z.string().uuid(),
  agent_id: z.string(),
  status: z.enum(["active", "completed", "errored"]),
  started_at: z.string(),
  ended_at: z.string().nullable(),
  event_count: z.number().int(),
});
export type DesktopSession = z.infer<typeof DesktopSessionSchema>;

// ─── API Request/Response types ──────────────────────────────────

export const ConnectRequestSchema = z.object({
  display_name: z.string().min(3).max(50),
  capabilities: z.array(z.string()).min(1),
  public_material: z.string().regex(/^[0-9a-f]+$/),
});
export type ConnectRequest = z.infer<typeof ConnectRequestSchema>;

export const ConnectResponseSchema = z.object({
  agent_id: z.string(),
  profile_url: z.string(),
  tier: AgentTierSchema,
  reputation: z.number(),
  websocket_url: z.string(),
});
export type ConnectResponse = z.infer<typeof ConnectResponseSchema>;

export const SearchResultSchema = z.object({
  id: z.string(),
  result_type: z.enum(["repo", "agent", "project"]),
  title: z.string(),
  description: z.string(),
  score: z.number(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

export const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema),
  total: z.number().int(),
  query: z.string(),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

// ─── V7 Event System ─────────────────────────────────────────────
export * from "./events";
