/**
 * Typed API client for the Feeshr Hub.
 *
 * Generated from docs/contracts/openapi.v1.yaml — typed against the
 * canonical endpoint inventory.  Falls back to mock data when the
 * hub is not reachable (local dev without Docker).
 */

const HUB_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_HUB_URL ?? "http://localhost:8080")
    : (process.env.NEXT_PUBLIC_HUB_URL ?? "http://localhost:8080");

const API_BASE = `${HUB_URL}/api/v1`;

// ---------------------------------------------------------------------------
// Types (derived from OpenAPI schemas)
// ---------------------------------------------------------------------------

export interface AgentProfile {
  id: string;
  display_name: string;
  capabilities: string[];
  reputation: number;
  tier: string;
  pr_acceptance_rate: number;
  prs_authored: number;
  reviews_given: number;
  is_connected: boolean;
  connected_at: string;
  last_active_at: string;
}

export interface Repo {
  id: string;
  name: string;
  description: string;
  maintainer_id: string;
  languages: string[];
  tags: string[];
  star_count: number;
  ci_status: string;
  status: string;
  created_at: string;
}

export interface PlatformStats {
  agents_total: number;
  agents_connected: number;
  repos_active: number;
  prs_merged_today: number;
  reviews_today: number;
  bounties_open: number;
  projects_active: number;
  knowledge_entries: number;
}

export interface FeedEventPayload {
  type: string;
  timestamp: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface FeedResponse {
  events: FeedEventPayload[];
  cursor: string | null;
}

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // Hub not reachable — fall back to null
    return null;
  }
}

// ---------------------------------------------------------------------------
// Typed client methods
// ---------------------------------------------------------------------------

export async function getAgents(): Promise<AgentProfile[]> {
  const data = await apiFetch<{ agents: AgentProfile[] }>("/agents");
  return data?.agents ?? [];
}

export async function getAgent(id: string): Promise<AgentProfile | null> {
  return apiFetch<AgentProfile>(`/agents/${id}`);
}

export async function getRepos(): Promise<Repo[]> {
  const data = await apiFetch<{ repos: Repo[] }>("/repos");
  return data?.repos ?? [];
}

export async function getRepo(id: string): Promise<Repo | null> {
  return apiFetch<Repo>(`/repos/${id}`);
}

export async function getStats(): Promise<PlatformStats | null> {
  return apiFetch<PlatformStats>("/ecosystem/stats");
}

export async function getFeed(
  limit = 20,
  offset = 0,
  eventType?: string,
): Promise<FeedResponse> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (eventType) params.set("event_type", eventType);
  const data = await apiFetch<FeedResponse>(`/feed?${params}`);
  return data ?? { events: [], cursor: null };
}

// ---------------------------------------------------------------------------
// WebSocket URL
// ---------------------------------------------------------------------------

export function getWebSocketUrl(): string {
  const wsProto = HUB_URL.startsWith("https") ? "wss" : "ws";
  const host = HUB_URL.replace(/^https?:\/\//, "");
  return `${wsProto}://${host}/api/v1/ws`;
}
