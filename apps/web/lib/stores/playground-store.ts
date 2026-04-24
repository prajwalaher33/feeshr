import { create } from "zustand";
import type { PlaygroundEvent } from "@feeshr/types";

// ─── Public model used by every playground surface ─────────────────────────

export interface HallAgent {
  id: string;
  name: string;
  reputation: number;
  lastActiveAt: number;
  status: "active" | "idle";
}

export interface HallEdge {
  source: string;
  target: string;
  weight: number;
  initiatorId: string;
}

export type PinnedEntity = {
  type: "agent" | "pr" | "bounty" | "repo" | "project" | "package";
  id: string;
  name: string;
} | null;

export type WsStatus = "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

// ─── Limits keep the canvas readable during long-running demos ─────────────

const MAX_EVENTS = 900;
const MAX_AGENTS = 64;
const MAX_EDGES = 140;
const BASE_REPUTATION = 100;
const IDLE_THRESHOLD = 120_000;

// ─── Derivation helpers ────────────────────────────────────────────────────

function numericTime(ts: string): number {
  const t = new Date(ts).getTime();
  return Number.isFinite(t) ? t : Date.now();
}

function sortedUniqueEvents(events: PlaygroundEvent[]): PlaygroundEvent[] {
  const byId = new Map<string, PlaygroundEvent>();
  for (const event of events) byId.set(event.id, event);
  return [...byId.values()]
    .sort((a, b) => numericTime(a.ts) - numericTime(b.ts))
    .slice(-MAX_EVENTS);
}

function reputationDelta(detail?: string): number {
  const match = detail?.match(/([+-]?\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function deriveGraph(events: PlaygroundEvent[]): { agents: HallAgent[]; edges: HallEdge[] } {
  const now = Date.now();
  const agentMap = new Map<string, HallAgent>();

  // First pass: every actor is an agent node.
  for (const event of events) {
    const ts = numericTime(event.ts);
    const existing = agentMap.get(event.actor_id);
    if (existing) {
      existing.name = event.actor_name || existing.name;
      existing.lastActiveAt = Math.max(existing.lastActiveAt, ts);
      existing.status = now - existing.lastActiveAt < IDLE_THRESHOLD ? "active" : "idle";
      if (event.type === "agent.reputation_changed") {
        existing.reputation = Math.max(0, existing.reputation + reputationDelta(event.detail));
      }
      continue;
    }

    agentMap.set(event.actor_id, {
      id: event.actor_id,
      name: event.actor_name,
      reputation: Math.max(0, BASE_REPUTATION + (event.type === "agent.reputation_changed" ? reputationDelta(event.detail) : 0)),
      lastActiveAt: ts,
      status: now - ts < IDLE_THRESHOLD ? "active" : "idle",
    });
  }

  const edgeMap = new Map<string, HallEdge>();

  // Second pass: only draw edges between known agents so repos/bounties do not
  // create orphan nodes on the force-directed canvas.
  for (const event of events) {
    if (!event.target_id || event.actor_id === event.target_id) continue;
    if (!agentMap.has(event.target_id)) continue;

    const key = [event.actor_id, event.target_id].sort().join(":");
    const existing = edgeMap.get(key);
    if (existing) {
      existing.weight += 1;
    } else {
      edgeMap.set(key, {
        source: event.actor_id,
        target: event.target_id,
        weight: 1,
        initiatorId: event.actor_id,
      });
    }
  }

  const agents = [...agentMap.values()]
    .sort((a, b) => (b.reputation + b.lastActiveAt / 1_000_000_000) - (a.reputation + a.lastActiveAt / 1_000_000_000))
    .slice(0, MAX_AGENTS);
  const keptAgents = new Set(agents.map((agent) => agent.id));
  const edges = [...edgeMap.values()]
    .filter((edge) => keptAgents.has(edge.source) && keptAgents.has(edge.target))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_EDGES);

  return { agents, edges };
}

function derivePinnedEntity(id: string | null, events: PlaygroundEvent[]): PinnedEntity {
  if (!id) return null;

  const exactEvent = events.find((event) => event.id === id);
  if (exactEvent) {
    if (exactEvent.target_id && exactEvent.target_name && exactEvent.target_type) {
      return {
        type: exactEvent.target_type,
        id: exactEvent.target_id,
        name: exactEvent.target_name,
      };
    }
    return { type: "agent", id: exactEvent.actor_id, name: exactEvent.actor_name };
  }

  const actorEvent = events.find((event) => event.actor_id === id);
  if (actorEvent) return { type: "agent", id, name: actorEvent.actor_name };

  const targetEvent = events.find((event) => event.target_id === id);
  if (targetEvent?.target_name && targetEvent.target_type) {
    return { type: targetEvent.target_type, id, name: targetEvent.target_name };
  }

  return { type: "agent", id, name: id.slice(0, 12) };
}

function deriveCommitHistory(events: PlaygroundEvent[]): PlaygroundEvent[] {
  return events.filter((event) => event.type === "pr.commit");
}

// ─── Zustand store ─────────────────────────────────────────────────────────

interface PlaygroundState {
  events: PlaygroundEvent[];
  agents: HallAgent[];
  edges: HallEdge[];
  pinnedId: string | null;
  pinnedEntity: PinnedEntity;
  latestCommit: PlaygroundEvent | null;
  commitHistory: PlaygroundEvent[];
  theatreCollapsed: boolean;
  theatreFullscreen: boolean;
  wsStatus: WsStatus;
  eventRate: number;
  timelineFilter: string;
  timelineSearch: string;

  setEvents: (events: PlaygroundEvent[]) => void;
  addEvent: (event: PlaygroundEvent) => void;
  addEvents: (events: PlaygroundEvent[]) => void;
  setPinnedId: (id: string | null) => void;
  setTheatreCollapsed: (collapsed: boolean) => void;
  toggleTheatre: () => void;
  setTheatreFullscreen: (fullscreen: boolean) => void;
  setWsStatus: (status: WsStatus) => void;
  setEventRate: (rate: number) => void;
  setTimelineFilter: (filter: string) => void;
  setTimelineSearch: (search: string) => void;
}

function applyEvents(
  set: (partial: Partial<PlaygroundState>) => void,
  get: () => PlaygroundState,
  nextEvents: PlaygroundEvent[],
) {
  const events = sortedUniqueEvents(nextEvents);
  const { agents, edges } = deriveGraph(events);
  const commitHistory = deriveCommitHistory(events);
  const latestCommit = commitHistory.at(-1) || null;
  const pinnedEntity = derivePinnedEntity(get().pinnedId, events);

  set({ events, agents, edges, commitHistory, latestCommit, pinnedEntity });
}

export const usePlaygroundStore = create<PlaygroundState>((set, get) => ({
  events: [],
  agents: [],
  edges: [],
  pinnedId: null,
  pinnedEntity: null,
  latestCommit: null,
  commitHistory: [],
  theatreCollapsed: false,
  theatreFullscreen: false,
  wsStatus: "disconnected",
  eventRate: 0,
  timelineFilter: "all",
  timelineSearch: "",

  setEvents: (events) => applyEvents(set, get, events),
  addEvent: (event) => applyEvents(set, get, [...get().events, event]),
  addEvents: (events) => applyEvents(set, get, [...get().events, ...events]),

  setPinnedId: (id) => {
    set({ pinnedId: id, pinnedEntity: derivePinnedEntity(id, get().events) });
  },
  setTheatreCollapsed: (collapsed) => set({ theatreCollapsed: collapsed }),
  toggleTheatre: () => set((state) => ({ theatreCollapsed: !state.theatreCollapsed })),
  setTheatreFullscreen: (fullscreen) => set({ theatreFullscreen: fullscreen }),
  setWsStatus: (status) => set({ wsStatus: status }),
  setEventRate: (rate) => set({ eventRate: rate }),
  setTimelineFilter: (filter) => set({ timelineFilter: filter }),
  setTimelineSearch: (search) => set({ timelineSearch: search }),
}));
