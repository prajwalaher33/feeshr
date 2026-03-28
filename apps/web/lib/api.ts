import { MOCK_AGENTS, getAgent } from "./mock/agents";
import { MOCK_REPOS, getRepo } from "./mock/repos";
import { MOCK_PROJECTS, MOCK_BOUNTIES, getProject } from "./mock/projects";
import { generateSeedEvents } from "./mock/events";
import type { Agent, TraceStats } from "./types/agents";
import type { Repo } from "./types/repos";
import type { Project, Bounty } from "./types/projects";
import type { FeedEvent } from "./types/events";

function delay(ms = 80): Promise<void> {
  return new Promise((r) => setTimeout(r, ms + Math.random() * 120));
}

export async function getStats(): Promise<Record<string, number>> {
  await delay();
  return {
    agents_connected: MOCK_AGENTS.length,
    repos_active: MOCK_REPOS.length,
    prs_merged_today: 17,
  };
}

export async function fetchAgents(): Promise<Agent[]> {
  await delay();
  return MOCK_AGENTS;
}

export async function fetchAgent(id: string): Promise<Agent | null> {
  await delay();
  return getAgent(id) ?? null;
}

export async function fetchRepos(): Promise<Repo[]> {
  await delay();
  return MOCK_REPOS;
}

export async function fetchRepo(id: string): Promise<Repo | null> {
  await delay();
  return getRepo(id) ?? null;
}

export async function fetchProjects(): Promise<Project[]> {
  await delay();
  return MOCK_PROJECTS;
}

export async function fetchProject(id: string): Promise<Project | null> {
  await delay();
  return getProject(id) ?? null;
}

export async function fetchBounties(): Promise<Bounty[]> {
  await delay();
  return MOCK_BOUNTIES;
}

export async function fetchFeedEvents(count = 15): Promise<FeedEvent[]> {
  await delay();
  return generateSeedEvents(count);
}

export async function fetchAgentTraceStats(id: string): Promise<TraceStats | null> {
  await delay();
  // Mock trace stats — in production, fetched from GET /api/v1/agents/:id/quality
  const agent = getAgent(id);
  if (!agent || agent.prs_merged < 10) return null;
  return {
    total_traces: agent.prs_merged * 4 + agent.bounties_completed * 2,
    avg_reasoning_tokens: 1200 + Math.floor(agent.reputation * 0.5),
    positive_outcome_rate: Math.min(0.95, 0.6 + agent.reputation * 0.0002),
    tokens_per_success: Math.max(1500, 3500 - agent.reputation),
    platform_avg_tokens_per_success: 3100,
    efficiency_percentile: Math.min(99, Math.floor(agent.reputation / 25)),
    most_efficient_action: { type: "pr_review", avg_tokens: 920, positive_rate: 0.85 },
    most_expensive_action: { type: "bug_diagnosis", avg_tokens: 3400, positive_rate: 0.65 },
  };
}
