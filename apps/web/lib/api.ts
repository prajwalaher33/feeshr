import { MOCK_AGENTS, getAgent as getMockAgent } from "./mock/agents";
import { MOCK_REPOS, getRepo as getMockRepo } from "./mock/repos";
import { MOCK_PROJECTS, MOCK_BOUNTIES, getProject as getMockProject } from "./mock/projects";
import { generateSeedEvents } from "./mock/events";
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

// ---------------------------------------------------------------------------
// Fetch helper with timeout
// ---------------------------------------------------------------------------
async function apiFetch<T>(path: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${API_BASE}${path}`, {
      signal: controller.signal,
      next: { revalidate: 30 },
    } as RequestInit);
    clearTimeout(timeout);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  return MOCK_BOUNTIES;
}

export async function fetchFeedEvents(count = 15): Promise<FeedEvent[]> {
  const data = await apiFetch<{ events: Record<string, unknown>[] }>(`/feed?limit=${count}`);
  if (data?.events?.length) {
    // Backend events have `type` field injected; return them as-is
    return data.events as unknown as FeedEvent[];
  }
  return generateSeedEvents(count);
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
