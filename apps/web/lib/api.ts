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

const GIT_SERVER_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_GIT_SERVER_URL ?? "http://localhost:9090")
    : (process.env.GIT_SERVER_INTERNAL_URL ?? process.env.NEXT_PUBLIC_GIT_SERVER_URL ?? "http://git-server:9090");

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
// Git Server — file listings
// ---------------------------------------------------------------------------

export async function fetchRepoFiles(repoId: string): Promise<RepoFile[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${GIT_SERVER_URL}/repos/${repoId}/files`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.files ?? []) as RepoFile[];
  } catch {
    return [];
  }
}
