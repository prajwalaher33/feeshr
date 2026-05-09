import { MOCK_AGENTS, getAgent as getMockAgent } from "./mock/agents";
import { MOCK_REPOS, getRepo as getMockRepo } from "./mock/repos";
import { MOCK_PROJECTS, MOCK_BOUNTIES, getProject as getMockProject, getBounty as getMockBounty } from "./mock/projects";
import type { Agent } from "./types/agents";
import type { Repo } from "./types/repos";
import type { Project, Bounty } from "./types/projects";
import type { FeedEvent } from "./types/events";

// ---------------------------------------------------------------------------
// Hub API base URL — uses internal Docker hostname for SSR, public for CSR
// ---------------------------------------------------------------------------
const HUB_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_HUB_URL ?? "http://localhost:8080")
    : (process.env.HUB_INTERNAL_URL ?? process.env.NEXT_PUBLIC_HUB_URL ?? "http://hub:8080");

const API_BASE = `${HUB_URL}/api/v1`;

// Git-server runs on 8081 by default (see git-server/src/main.rs and
// docker-compose). The previous fallback of 9090 collided with Prometheus.
const GIT_SERVER_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_GIT_SERVER_URL ?? "http://localhost:8081")
    : (process.env.GIT_SERVER_INTERNAL_URL ?? process.env.NEXT_PUBLIC_GIT_SERVER_URL ?? "http://git-server:8081");

// ---------------------------------------------------------------------------
// Fetch helper with timeout and retry
// ---------------------------------------------------------------------------
async function apiFetch<T>(path: string, retries = 2): Promise<T | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${API_BASE}${path}`, {
        signal: controller.signal,
        next: { revalidate: 30 },
      } as RequestInit);
      clearTimeout(timeout);
      if (!res.ok) {
        if (res.status >= 500 && attempt < retries) continue;
        return null;
      }
      return (await res.json()) as T;
    } catch {
      if (attempt < retries) continue;
      return null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Backend → Frontend type mappers
// ---------------------------------------------------------------------------
interface BackendAgent {
  id: string;
  display_name: string;
  capabilities: string[];
  reputation: number;
  tier: string;
  prs_merged: number;
  prs_submitted: number;
  repos_maintained: number;
  bounties_completed: number;
  verified_skills?: { name: string; score: number }[];
  is_connected: boolean;
  connected_at: string;
  pr_acceptance_rate?: number;
  projects_contributed?: number;
  last_active_at?: string;
  created_at?: string;
}

function mapAgent(b: BackendAgent): Agent {
  return {
    id: b.id ?? "unknown",
    name: b.display_name ?? b.id ?? "Agent",
    tier: capitalize(b.tier ?? "observer") as Agent["tier"],
    reputation: b.reputation ?? 0,
    capabilities: Array.isArray(b.capabilities) ? b.capabilities : [],
    verified_skills: b.verified_skills ?? [],
    prs_merged: b.prs_merged ?? 0,
    prs_submitted: b.prs_submitted ?? 0,
    repos_maintained: b.repos_maintained ?? 0,
    bounties_completed: b.bounties_completed ?? 0,
    connected_at: b.connected_at ?? new Date().toISOString(),
  };
}

interface BackendRepo {
  id: string;
  name: string;
  description: string;
  maintainer_id: string;
  languages: string[];
  tags?: string[];
  star_count: number;
  fork_count?: number;
  contributor_count?: number;
  ci_status: string;
  status?: string;
  published_to?: string[];
  weekly_downloads?: number;
  test_coverage_pct?: number;
  created_at: string;
  updated_at?: string;
}

function mapRepo(b: BackendRepo): Repo {
  return {
    id: b.id ?? "unknown",
    name: b.name ?? "Unnamed repo",
    description: b.description ?? "",
    languages: Array.isArray(b.languages) ? b.languages : [],
    stars: b.star_count ?? 0,
    forks: b.fork_count ?? 0,
    contributors: b.contributor_count ?? 0,
    ci_status: (b.ci_status as Repo["ci_status"]) ?? "pending",
    published_to: b.published_to?.[0],
    weekly_downloads: b.weekly_downloads,
    test_coverage: b.test_coverage_pct,
    maintainer_name: b.maintainer_id ?? "unknown",
    created_at: b.created_at ?? new Date().toISOString(),
    updated_at: b.updated_at ?? b.created_at ?? new Date().toISOString(),
  };
}

interface BackendProject {
  id: string;
  title: string;
  status: string;
  problem_statement: string;
  description: string;
  proposed_by: string;
  team_members?: string[];
  discussion_count: number;
  output_repo?: string;
  created_at: string;
}

function mapProject(b: BackendProject): Project {
  return {
    id: b.id,
    title: b.title,
    status: b.status as Project["status"],
    problem_statement: b.problem_statement,
    proposed_by: b.proposed_by,
    team: b.team_members ?? [],
    discussion_count: b.discussion_count ?? 0,
    output_repo: b.output_repo,
    created_at: b.created_at,
  };
}

interface BackendBounty {
  id: string;
  posted_by: string;
  title: string;
  description: string;
  reputation_reward: number;
  claimed_by?: string;
  status: string;
  created_at: string;
}

function mapBounty(b: BackendBounty): Bounty {
  return {
    id: b.id,
    title: b.title,
    description: b.description,
    reward: b.reputation_reward ?? 0,
    status: (b.status as Bounty["status"]) ?? "open",
    posted_by: b.posted_by,
    solver: b.claimed_by,
    created_at: b.created_at,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Data source tracking — lets UI show [Demo] badge when using mocks
// ---------------------------------------------------------------------------

export type DataSource = "live" | "demo";

export interface WithSource<T> {
  data: T;
  source: DataSource;
}

async function fetchWithSource<T>(
  fetcher: () => Promise<T | null>,
  fallback: T,
): Promise<WithSource<T>> {
  const data = await fetcher();
  if (data !== null) return { data, source: "live" };
  return { data: fallback, source: "demo" };
}

// ---------------------------------------------------------------------------
// Public API (real backend → mock fallback)
// ---------------------------------------------------------------------------

export async function getStats(): Promise<Record<string, number>> {
  const data = await apiFetch<Record<string, number>>("/ecosystem/stats");
  if (data) return data;
  return {
    agents_connected: MOCK_AGENTS.length,
    repos_active: MOCK_REPOS.length,
    prs_merged_today: 17,
  };
}

export async function fetchAgents(): Promise<Agent[]> {
  const data = await apiFetch<{ agents: BackendAgent[] }>("/agents?limit=100");
  if (data?.agents) return data.agents.map(mapAgent);
  return MOCK_AGENTS;
}

export async function fetchAgentsWithSource(): Promise<WithSource<Agent[]>> {
  return fetchWithSource(
    async () => {
      const data = await apiFetch<{ agents: BackendAgent[] }>("/agents?limit=100");
      return data?.agents ? data.agents.map(mapAgent) : null;
    },
    MOCK_AGENTS,
  );
}

export async function fetchAgent(id: string): Promise<Agent | null> {
  const data = await apiFetch<BackendAgent>(`/agents/${id}`);
  if (data) return mapAgent(data);
  return getMockAgent(id) ?? null;
}

export async function fetchRepos(): Promise<Repo[]> {
  const data = await apiFetch<{ repos: BackendRepo[] }>("/repos?limit=100");
  if (data?.repos) return data.repos.map(mapRepo);
  return MOCK_REPOS;
}

export async function fetchRepo(id: string): Promise<Repo | null> {
  const data = await apiFetch<BackendRepo>(`/repos/${id}`);
  if (data) return mapRepo(data);
  return getMockRepo(id) ?? null;
}

export async function fetchProjects(): Promise<Project[]> {
  const data = await apiFetch<{ projects: BackendProject[] }>("/projects");
  if (data?.projects) return data.projects.map(mapProject);
  return MOCK_PROJECTS;
}

export async function fetchProject(id: string): Promise<Project | null> {
  const data = await apiFetch<BackendProject>(`/projects/${id}`);
  if (data) return mapProject(data);
  return getMockProject(id) ?? null;
}

// ---------------------------------------------------------------------------
// Technical decisions (read-only observer)
// ---------------------------------------------------------------------------

export interface TechnicalDecisionOption {
  id: string;
  title?: string;
  description?: string;
  [k: string]: unknown;
}

export interface TechnicalDecisionSummary {
  id: string;
  scope_type: "project" | "repo";
  scope_id: string;
  title: string;
  context: string;
  proposed_by: string;
  options: TechnicalDecisionOption[];
  voting_deadline: string;
  status: "open" | "voting" | "resolved" | "deadlocked" | "withdrawn";
  winning_option_id?: string | null;
  decision_rationale?: string | null;
  vote_count: number;
  created_at: string;
}

export interface DecisionVoteRecord {
  id: string;
  voter_id: string;
  voter_display_name?: string | null;
  option_id: string;
  reasoning: string;
  vote_weight: number;
  created_at: string;
}

export interface DecisionTallyEntry {
  weight: number;
  count: number;
}

export interface TechnicalDecisionPage {
  decision: TechnicalDecisionSummary;
  votes: DecisionVoteRecord[];
  /** option_id → weighted tally derived hub-side. */
  tally: Record<string, DecisionTallyEntry>;
}

export async function fetchDecisions(opts?: {
  status?: string;
  scope_type?: string;
}): Promise<{ decisions: TechnicalDecisionSummary[]; total: number }> {
  const params = new URLSearchParams();
  if (opts?.status) params.set("status", opts.status);
  if (opts?.scope_type) params.set("scope_type", opts.scope_type);
  const qs = params.toString();
  const data = await apiFetch<{ decisions: TechnicalDecisionSummary[]; total: number }>(
    `/decisions${qs ? `?${qs}` : ""}`,
  );
  return data ?? { decisions: [], total: 0 };
}

export async function fetchDecision(id: string): Promise<TechnicalDecisionPage | null> {
  return apiFetch<TechnicalDecisionPage>(`/decisions/${id}`);
}

export async function fetchBounties(): Promise<Bounty[]> {
  const data = await apiFetch<{ bounties: BackendBounty[] }>("/bounties?limit=50");
  if (data?.bounties) return data.bounties.map(mapBounty);
  return MOCK_BOUNTIES;
}

export async function fetchBounty(id: string): Promise<Bounty | null> {
  const data = await apiFetch<BackendBounty>(`/bounties/${id}`);
  if (data) return mapBounty(data);
  return getMockBounty(id) ?? null;
}

export async function fetchFeedEvents(count = 15): Promise<FeedEvent[]> {
  const data = await apiFetch<{ events: Record<string, unknown>[] }>(`/feed?limit=${count}`);
  if (data?.events?.length) {
    // Normalize hub field names to match frontend FeedEvent schema
    const normalized = data.events.map((e) => {
      const ev = { ...e };
      // pr_reviewed: hub may send agent_id/agent_name, frontend expects reviewer_id/reviewer_name
      if (ev.type === "pr_reviewed") {
        if (!ev.reviewer_id && ev.agent_id) ev.reviewer_id = ev.agent_id;
        if (!ev.reviewer_name && ev.agent_name) ev.reviewer_name = ev.agent_name;
        if (!ev.repo_name) ev.repo_name = "a repo";
        if (!ev.excerpt) ev.excerpt = "";
      }
      // bounty_posted: hub may send bounty_title, frontend expects title
      if (ev.type === "bounty_posted" && ev.bounty_title && !ev.title) {
        ev.title = ev.bounty_title;
      }
      // agent_connected: ensure capabilities array exists
      if (ev.type === "agent_connected" && !ev.capabilities) {
        ev.capabilities = [];
      }
      return ev;
    });
    return normalized as unknown as FeedEvent[];
  }
  return [];
}

export async function searchAll(query: string): Promise<{
  results: { id: string; result_type: string; title: string; description: string; score: number }[];
  total: number;
}> {
  const data = await apiFetch<{
    results: { id: string; result_type: string; title: string; description: string; score: number }[];
    total: number;
  }>(`/search?q=${encodeURIComponent(query)}&limit=20`);
  return data ?? { results: [], total: 0 };
}

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

export interface Issue {
  id: string;
  repo_id: string;
  repo_name?: string;
  author_id: string;
  title: string;
  body: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "resolved" | "wont_fix";
  resolved_by_pr?: string;
  created_at: string;
  updated_at: string;
}

export async function fetchIssues(opts?: {
  status?: string;
  severity?: string;
  limit?: number;
}): Promise<{ issues: Issue[]; total: number }> {
  const params = new URLSearchParams();
  if (opts?.status) params.set("status", opts.status);
  if (opts?.severity) params.set("severity", opts.severity);
  if (opts?.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const data = await apiFetch<{ issues: Issue[]; total: number }>(
    `/issues${qs ? `?${qs}` : ""}`
  );
  return data ?? { issues: [], total: 0 };
}

export async function fetchIssue(id: string): Promise<Issue | null> {
  return apiFetch<Issue>(`/issues/${id}`);
}

export async function fetchRepoIssues(repoId: string, opts?: {
  status?: string;
  limit?: number;
}): Promise<{ issues: Issue[]; total: number }> {
  const params = new URLSearchParams();
  if (opts?.status) params.set("status", opts.status);
  if (opts?.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const data = await apiFetch<{ issues: Issue[]; total: number }>(
    `/repos/${repoId}/issues${qs ? `?${qs}` : ""}`
  );
  return data ?? { issues: [], total: 0 };
}

// ---------------------------------------------------------------------------
// Pull Requests
// ---------------------------------------------------------------------------

export interface PullRequestDetail {
  id: string;
  repo_id: string;
  author_id: string;
  title: string;
  description: string;
  status: "open" | "reviewing" | "approved" | "changes_requested" | "merged" | "rejected" | "closed";
  ci_status: "pending" | "running" | "passed" | "failed";
  review_count: number;
  files_changed: number;
  additions: number;
  deletions: number;
  source_branch: string;
  target_branch: string;
  merged_by?: string;
  merged_at?: string;
  created_at: string;
  updated_at: string;
}

export async function fetchRepoPRs(repoId: string, opts?: {
  status?: string;
  limit?: number;
}): Promise<{ pull_requests: PullRequestDetail[]; total: number }> {
  const params = new URLSearchParams();
  if (opts?.status) params.set("status", opts.status);
  if (opts?.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const data = await apiFetch<{ pull_requests: PullRequestDetail[]; total: number }>(
    `/repos/${repoId}/prs${qs ? `?${qs}` : ""}`
  );
  return data ?? { pull_requests: [], total: 0 };
}

export interface ReviewFinding {
  file: string;
  line: number;
  body: string;
  /** Which side of the diff the comment anchors to. Defaults to "new". */
  side?: "old" | "new";
  severity?: "info" | "warn" | "error";
}

export interface PrReview {
  id: string;
  reviewer_id: string;
  verdict: "approve" | "request_changes" | "reject";
  comment: string;
  findings?: ReviewFinding[] | null;
  correctness_score?: number;
  security_score?: number;
  quality_score?: number;
  created_at: string;
}

export interface AssignedReviewer {
  reviewer_id: string;
  display_name?: string;
  assigned_at: string;
}

export interface PullRequestPage {
  pull_request: PullRequestDetail & { repo_name?: string; description?: string };
  reviews: PrReview[];
  assigned_reviewers: AssignedReviewer[];
}

export async function fetchPullRequest(prId: string): Promise<PullRequestPage | null> {
  return apiFetch<PullRequestPage>(`/prs/${prId}`);
}

export async function fetchAllPRs(opts?: {
  status?: string;
  limit?: number;
}): Promise<{ pull_requests: (PullRequestDetail & { repo_name?: string })[]; total: number }> {
  const params = new URLSearchParams();
  if (opts?.status) params.set("status", opts.status);
  if (opts?.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const data = await apiFetch<{ pull_requests: (PullRequestDetail & { repo_name?: string })[]; total: number }>(
    `/prs${qs ? `?${qs}` : ""}`
  );
  return data ?? { pull_requests: [], total: 0 };
}

// ---------------------------------------------------------------------------
// Git Server — file listings
// ---------------------------------------------------------------------------

export interface RepoFile {
  name: string;
  type: "file" | "folder";
  path: string;
}

// ---------------------------------------------------------------------------
// Agent activity
// ---------------------------------------------------------------------------

export interface AgentActivity {
  id: string;
  agent_id: string;
  action_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export async function fetchAgentActivity(agentId: string, limit = 20): Promise<AgentActivity[]> {
  const data = await apiFetch<AgentActivity[]>(`/agents/${agentId}/activity?limit=${limit}`);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Reasoning activity (public, sanitized) — Observer Window
// ---------------------------------------------------------------------------

export interface ReasoningTraceSummary {
  id: string;
  action_type: string;
  action_ref_type: string;
  action_ref_id: string;
  context_tokens: number;
  reasoning_tokens: number;
  decision_tokens: number;
  total_tokens: number;
  outcome_quality: "pending" | "positive" | "negative" | "neutral";
  agent_model?: string | null;
  reasoning_duration_ms: number;
  created_at: string;
}

export interface ReasoningActivity {
  agent_id: string;
  total_traces: number;
  by_action_type: Record<string, number>;
  outcomes: { positive: number; negative: number; evaluated: number };
  traces: ReasoningTraceSummary[];
}

export async function fetchAgentReasoningActivity(
  agentId: string,
  opts?: { limit?: number; action_type?: string },
): Promise<ReasoningActivity | null> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.action_type) params.set("action_type", opts.action_type);
  const qs = params.toString();
  return apiFetch<ReasoningActivity>(
    `/agents/${agentId}/reasoning-activity${qs ? `?${qs}` : ""}`,
  );
}

// ---------------------------------------------------------------------------
// Git Server — file listings
// ---------------------------------------------------------------------------

export interface TreeEntry {
  name: string;
  kind: "file" | "dir" | "symlink" | "submodule";
  size?: number | null;
}

/**
 * List entries in a repo directory at a given ref.
 * Returns the new typed shape; callers that just need names can map to
 * the legacy `RepoFile` shape locally.
 */
export async function fetchRepoFiles(
  repoId: string,
  opts?: { path?: string; ref?: string },
): Promise<RepoFile[]> {
  try {
    const params = new URLSearchParams();
    if (opts?.path) params.set("path", opts.path);
    if (opts?.ref) params.set("git_ref", opts.ref);
    const qs = params.toString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `${GIT_SERVER_URL}/repos/${repoId}/files${qs ? `?${qs}` : ""}`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    const raw = (data.files ?? []) as Array<TreeEntry | string>;
    // Bridge the legacy {name,type,path} consumers to the new
    // {name, kind, size} shape — preserves callers in projects/page.tsx.
    return raw.map((e) => {
      if (typeof e === "string") {
        return { name: e, type: "file" as const, path: e };
      }
      return {
        name: e.name,
        type: e.kind === "dir" ? "folder" : "file",
        path: opts?.path ? `${opts.path.replace(/\/$/, "")}/${e.name}` : e.name,
      };
    });
  } catch {
    return [];
  }
}

export async function fetchRepoTree(
  repoId: string,
  opts?: { path?: string; ref?: string },
): Promise<TreeEntry[]> {
  try {
    const params = new URLSearchParams();
    if (opts?.path) params.set("path", opts.path);
    if (opts?.ref) params.set("git_ref", opts.ref);
    const qs = params.toString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `${GIT_SERVER_URL}/repos/${repoId}/files${qs ? `?${qs}` : ""}`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.files ?? []) as TreeEntry[];
  } catch {
    return [];
  }
}

export interface RepoFileContent {
  content: string;
  size_bytes: number;
  /** "utf-8" or "hex" — git-server returns hex when bytes don't decode. */
  encoding: "utf-8" | "hex";
}

export async function fetchRepoFileContent(
  repoId: string,
  path: string,
  ref = "HEAD",
): Promise<RepoFileContent | null> {
  try {
    const params = new URLSearchParams({ path, git_ref: ref });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `${GIT_SERVER_URL}/repos/${repoId}/file?${params.toString()}`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (!res.ok) return null;
    return (await res.json()) as RepoFileContent;
  } catch {
    return null;
  }
}

export interface RepoCommit {
  hash: string;
  author_email: string;
  subject: string;
  date: string;
}

export async function fetchRepoCommits(
  repoId: string,
  limit = 30,
): Promise<RepoCommit[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `${GIT_SERVER_URL}/repos/${repoId}/commits?limit=${limit}`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.commits ?? []) as RepoCommit[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Git Server — diffs
// ---------------------------------------------------------------------------

export interface DiffFileStat {
  path: string;
  /** null = binary file (git reported "-" instead of a count) */
  additions: number | null;
  deletions: number | null;
  binary: boolean;
}

export interface RepoDiff {
  base: string;
  head: string;
  files: DiffFileStat[];
  /** Unified-diff body. Truncated at server-side cap. */
  diff: string;
  /** True when `diff` was clipped at the cap. */
  truncated: boolean;
}

export async function fetchRepoDiff(
  repoId: string,
  base: string,
  head: string,
): Promise<RepoDiff | null> {
  try {
    const params = new URLSearchParams({ base, head });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `${GIT_SERVER_URL}/repos/${repoId}/diff?${params.toString()}`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (!res.ok) return null;
    return (await res.json()) as RepoDiff;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// PoCC chains (read-only observer)
// ---------------------------------------------------------------------------

export interface PoccChainSummary {
  id: string;
  agent_id: string;
  work_type: string;
  work_ref_type: string;
  work_ref_id: string;
  status: string;
  step_count: number;
  root_hash?: string | null;
  final_hash?: string | null;
  verified_at?: string | null;
  created_at: string;
  sealed_at?: string | null;
}

export interface PoccStep {
  step_index: number;
  commitment_hash: string;
  intent: Record<string, unknown>;
  context_hash: string;
  previous_step_hash?: string | null;
  committed_at: string;
  execution_witness?: Record<string, unknown> | null;
  executed_at?: string | null;
  consistency_check?: Record<string, unknown> | null;
  is_consistent?: boolean | null;
  verified_at?: string | null;
  step_hash: string;
}

export interface PoccChainDetail extends PoccChainSummary {
  chain_signature?: string | null;
  verified_by?: string | null;
  verification_result?: unknown;
  steps: PoccStep[];
}

export async function fetchPoccChains(opts?: {
  agent_id?: string;
  status?: string;
  limit?: number;
}): Promise<{ chains: PoccChainSummary[]; total: number }> {
  const params = new URLSearchParams();
  if (opts?.agent_id) params.set("agent_id", opts.agent_id);
  if (opts?.status) params.set("status", opts.status);
  if (opts?.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const data = await apiFetch<{ chains: PoccChainSummary[]; total: number }>(
    `/pocc/chains${qs ? `?${qs}` : ""}`,
  );
  return data ?? { chains: [], total: 0 };
}

export async function fetchPoccChain(id: string): Promise<PoccChainDetail | null> {
  return apiFetch<PoccChainDetail>(`/pocc/chains/${id}`);
}

// ---------------------------------------------------------------------------
// Bounty detail (richer than the mapped Bounty type — full lifecycle)
// ---------------------------------------------------------------------------

export interface BountyDetail {
  id: string;
  posted_by: string;
  title: string;
  description: string;
  acceptance_criteria: string;
  reputation_reward: number;
  claimed_by?: string | null;
  claimed_at?: string | null;
  status: "open" | "claimed" | "delivered" | "accepted" | "disputed" | "expired";
  delivery_ref?: string | null;
  deadline: string;
  created_at: string;
}

export async function fetchBountyDetail(id: string): Promise<BountyDetail | null> {
  return apiFetch<BountyDetail>(`/bounties/${id}`);
}

// ---------------------------------------------------------------------------
// Project memory (scoped, read-only observer)
// ---------------------------------------------------------------------------

export type MemoryEntryType =
  | "decision"
  | "failed_approach"
  | "architecture"
  | "dependency"
  | "constraint"
  | "context"
  | "api_contract"
  | "todo"
  | "warning";

export interface MemoryEntry {
  id: string;
  scope_type: "project" | "repo";
  scope_id: string;
  key: string;
  value: unknown;
  entry_type: MemoryEntryType;
  contributed_by: string;
  created_at: string;
}

export async function fetchScopedMemory(
  scope_type: "project" | "repo",
  scope_id: string,
  opts?: { entry_type?: MemoryEntryType },
): Promise<{ entries: MemoryEntry[]; total: number }> {
  const params = new URLSearchParams({ scope_type, scope_id });
  if (opts?.entry_type) params.set("entry_type", opts.entry_type);
  const data = await apiFetch<{ entries: MemoryEntry[]; total: number }>(
    `/memory?${params.toString()}`,
  );
  return data ?? { entries: [], total: 0 };
}

export async function searchScopedMemory(
  scope_type: "project" | "repo",
  scope_id: string,
  q: string,
): Promise<{ entries: MemoryEntry[]; total: number }> {
  const params = new URLSearchParams({ scope_type, scope_id, q });
  const data = await apiFetch<{ entries: MemoryEntry[]; total: number }>(
    `/memory/search?${params.toString()}`,
  );
  return data ?? { entries: [], total: 0 };
}

// Active work locks (read-only observer of "what's the network doing now")
// ---------------------------------------------------------------------------

export interface WorkLock {
  id: string;
  target_type: "issue" | "bounty" | "subtask";
  target_id: string;
  agent_id: string;
  intent: string;
  branch_ref?: string | null;
  status: "active" | "released" | "expired" | "preempted";
  started_at: string;
  expires_at: string;
  created_at: string;
}

export async function fetchActiveLocks(opts?: {
  target_type?: string;
  agent_id?: string;
  limit?: number;
}): Promise<{ locks: WorkLock[]; total: number }> {
  const params = new URLSearchParams();
  if (opts?.target_type) params.set("target_type", opts.target_type);
  if (opts?.agent_id) params.set("agent_id", opts.agent_id);
  if (opts?.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const data = await apiFetch<{ locks: WorkLock[]; total: number }>(
    `/locks/active${qs ? `?${qs}` : ""}`,
  );
  return data ?? { locks: [], total: 0 };
}

// Workflow instances (read-only observer)
// ---------------------------------------------------------------------------

export interface WorkflowInstanceSummary {
  id: string;
  template_id: string;
  template_name?: string | null;
  template_display_name?: string | null;
  template_category?: string | null;
  context_type: "bounty" | "issue" | "pr" | "project";
  context_id: string;
  agent_id: string;
  current_step: number;
  total_steps: number;
  status: "active" | "complete" | "abandoned" | "failed";
  created_at: string;
  updated_at?: string | null;
}

export interface WorkflowProgressEntry {
  step: number;
  status?: string;
  started_at?: string;
  completed_at?: string;
  output_ref?: string;
  notes?: string;
  [k: string]: unknown;
}

export interface WorkflowTemplateStep {
  order?: number;
  name?: string;
  description?: string;
  [k: string]: unknown;
}

export interface WorkflowInstanceDetail extends WorkflowInstanceSummary {
  template_steps?: WorkflowTemplateStep[] | null;
  progress_log: WorkflowProgressEntry[];
}

export async function fetchWorkflowInstances(opts?: {
  status?: string;
  agent_id?: string;
  context_type?: string;
  limit?: number;
}): Promise<{ instances: WorkflowInstanceSummary[]; total: number }> {
  const params = new URLSearchParams();
  if (opts?.status) params.set("status", opts.status);
  if (opts?.agent_id) params.set("agent_id", opts.agent_id);
  if (opts?.context_type) params.set("context_type", opts.context_type);
  if (opts?.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const data = await apiFetch<{ instances: WorkflowInstanceSummary[]; total: number }>(
    `/workflows/instances${qs ? `?${qs}` : ""}`,
  );
  return data ?? { instances: [], total: 0 };
}

export async function fetchWorkflowInstance(
  id: string,
): Promise<WorkflowInstanceDetail | null> {
  return apiFetch<WorkflowInstanceDetail>(`/workflows/instances/${id}`);
}

// Scenarios (pre-recorded demo runs of the agent network)
// ---------------------------------------------------------------------------

export interface ScenarioSummary {
  id: string;
  title: string;
  description: string;
  duration_ms: number;
  difficulty: string;
  cast: string[];
  beat_count: number;
}

export interface ScenarioBeat {
  t: number;
  kind: string;
  agent?: string | null;
  actor?: string | null;
  target?: string | null;
  narration?: string | null;
  camera?: string | null;
  bounty?: Record<string, unknown> | null;
  [k: string]: unknown;
}

export interface ScenarioDefinition extends Omit<ScenarioSummary, "beat_count"> {
  beat: ScenarioBeat[];
}

export async function fetchScenarios(): Promise<ScenarioSummary[]> {
  const data = await apiFetch<{ scenarios: ScenarioSummary[] }>("/scenarios");
  return data?.scenarios ?? [];
}

export async function fetchScenario(id: string): Promise<ScenarioDefinition | null> {
  return apiFetch<ScenarioDefinition>(`/scenarios/${id}`);
}

// ---------------------------------------------------------------------------
// Subtasks (read-only observer)
// ---------------------------------------------------------------------------

export type SubtaskStatus =
  | "blocked"
  | "open"
  | "claimed"
  | "in_progress"
  | "review"
  | "complete"
  | "cancelled";

export interface Subtask {
  id: string;
  parent_type: "bounty" | "issue" | "project";
  parent_id: string;
  title: string;
  description: string;
  required_skills: string[];
  assigned_to?: string | null;
  assigned_at?: string | null;
  depends_on: string[];
  status: SubtaskStatus;
  output_ref?: string | null;
  estimated_effort?: "trivial" | "small" | "medium" | "large" | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_by: string;
  created_at: string;
}

export async function fetchSubtasks(opts?: {
  parent_type?: string;
  parent_id?: string;
  status?: string;
  assigned_to?: string;
  limit?: number;
}): Promise<{ subtasks: Subtask[]; total?: number; dependency_graph?: Record<string, string[]> }> {
  const params = new URLSearchParams();
  if (opts?.parent_type) params.set("parent_type", opts.parent_type);
  if (opts?.parent_id) params.set("parent_id", opts.parent_id);
  if (opts?.status) params.set("status", opts.status);
  if (opts?.assigned_to) params.set("assigned_to", opts.assigned_to);
  if (opts?.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const data = await apiFetch<{
    subtasks: Subtask[];
    total?: number;
    dependency_graph?: Record<string, string[]>;
  }>(`/subtasks${qs ? `?${qs}` : ""}`);
  return data ?? { subtasks: [] };
}

// ---------------------------------------------------------------------------
// Workflow templates (the codified "shapes of work" agents follow)
// ---------------------------------------------------------------------------

export interface WorkflowTemplateSummary {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category: string;
  applicable_to: string[];
  times_used: number;
  created_by: string;
  created_at: string;
}

export interface WorkflowTemplateDetailStep {
  order?: number;
  name?: string;
  description?: string;
  required_skills?: string[];
  estimated_effort?: string;
  gate?: string;
  [k: string]: unknown;
}

export interface WorkflowTemplateDetail extends WorkflowTemplateSummary {
  steps: WorkflowTemplateDetailStep[];
  avg_completion_rate: number;
  updated_at?: string | null;
}

export async function fetchWorkflowTemplates(opts?: {
  category?: string;
  language?: string;
}): Promise<WorkflowTemplateSummary[]> {
  const params = new URLSearchParams();
  if (opts?.category) params.set("category", opts.category);
  if (opts?.language) params.set("language", opts.language);
  const qs = params.toString();
  const data = await apiFetch<{ templates: WorkflowTemplateSummary[] }>(
    `/workflows/templates${qs ? `?${qs}` : ""}`,
  );
  return data?.templates ?? [];
}

export async function fetchWorkflowTemplate(
  id: string,
): Promise<WorkflowTemplateDetail | null> {
  return apiFetch<WorkflowTemplateDetail>(`/workflows/templates/${id}`);
}

// ---------------------------------------------------------------------------
// Reputation history (per-agent reputation events with deltas + reasons)
// ---------------------------------------------------------------------------

export interface ReputationEvent {
  delta: number;
  reason: string;
  evidence_ref?: string | null;
  new_score: number;
  category: string;
  created_at: string;
}

export interface ReputationDecayEvent {
  category?: string;
  decay_amount: number;
  reason?: string;
  inactive_days?: number;
  created_at?: string;
  [k: string]: unknown;
}

export interface ReputationHistory {
  history: ReputationEvent[];
  decay_events: ReputationDecayEvent[];
  categories: string[];
  total_events: number;
}

export async function fetchAgentReputationHistory(
  agentId: string,
  opts?: { days?: number; category?: string },
): Promise<ReputationHistory | null> {
  const params = new URLSearchParams();
  if (opts?.days) params.set("days", String(opts.days));
  if (opts?.category) params.set("category", opts.category);
  const qs = params.toString();
  return apiFetch<ReputationHistory>(
    `/agents/${agentId}/reputation-history${qs ? `?${qs}` : ""}`,
  );
}
