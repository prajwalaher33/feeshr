import { create } from "zustand";
import type { PlaygroundEvent } from "@feeshr/types";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface HallAgent {
  id: string;
  name: string;
  reputation: number;
  lastActiveAt: number;
}

export interface HallEdge {
  source: string;
  target: string;
  weight: number;
  initiatorId: string;
}

export type PinnedEntity =
  | { type: "agent" | "repo" | "pr" | "project" | "bounty"; id: string; name: string }
  | null;

export type WsStatus = "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

// ─── Derive helpers ─────────────────────────────────────────────────────────

const MAX_AGENTS = 30;
const MAX_EVENTS = 500;

function deriveGraph(events: PlaygroundEvent[]): { agents: HallAgent[]; edges: HallEdge[] } {
  const agentMap = new Map<string, HallAgent>();
  const edgeMap = new Map<string, HallEdge>();

  for (const ev of events) {
    if (!agentMap.has(ev.actor_id)) {
      agentMap.set(ev.actor_id, {
        id: ev.actor_id,
        name: ev.actor_name,
        reputation: 100,
        lastActiveAt: new Date(ev.ts).getTime(),
      });
    } else {
      const agent = agentMap.get(ev.actor_id)!;
      agent.lastActiveAt = Math.max(agent.lastActiveAt, new Date(ev.ts).getTime());
    }

    if (ev.type === "agent.reputation_changed" && ev.detail) {
      const match = ev.detail.match(/([+-]?\d+)/);
      if (match) {
        const agent = agentMap.get(ev.actor_id)!;
        agent.reputation += parseInt(match[1], 10);
      }
    }

    if (ev.target_id && ev.actor_id !== ev.target_id) {
      const key = [ev.actor_id, ev.target_id].sort().join(":");
      const existing = edgeMap.get(key);
      if (existing) {
        existing.weight++;
      } else {
        edgeMap.set(key, { source: ev.actor_id, target: ev.target_id, weight: 1, initiatorId: ev.actor_id });
      }
    }
  }

  // Prune to MAX_AGENTS by recency
  let agents = [...agentMap.values()];
  if (agents.length > MAX_AGENTS) {
    agents.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    agents = agents.slice(0, MAX_AGENTS);
    const kept = new Set(agents.map(a => a.id));
    const edges = [...edgeMap.values()].filter(e => kept.has(e.source) && kept.has(e.target));
    return { agents, edges };
  }

  return { agents, edges: [...edgeMap.values()] };
}

function derivePinnedEntity(id: string | null, events: PlaygroundEvent[]): PinnedEntity {
  if (!id) return null;
  const ev = events.find(e => e.actor_id === id);
  if (ev) return { type: "agent", id, name: ev.actor_name };
  const tev = events.find(e => e.target_id === id);
  if (tev && tev.target_name) {
    return { type: (tev.target_type || "agent") as PinnedEntity & object extends null ? never : "agent", id, name: tev.target_name };
  }
  return { type: "agent", id, name: id };
}

// ─── Store ──────────────────────────────────────────────────────────────────

interface PlaygroundState {
  events: PlaygroundEvent[];
  agents: HallAgent[];
  edges: HallEdge[];
  pinnedId: string | null;
  pinnedEntity: PinnedEntity;
  theatreCollapsed: boolean;
  theatreFullscreen: boolean;
  wsStatus: WsStatus;
  timelineFilter: string;
  timelineSearch: string;
  commitHistory: PlaygroundEvent[];

  // Actions
  setEvents: (events: PlaygroundEvent[]) => void;
  addEvent: (event: PlaygroundEvent) => void;
  addEvents: (events: PlaygroundEvent[]) => void;
  setPinnedId: (id: string | null) => void;
  toggleTheatre: () => void;
  setTheatreCollapsed: (v: boolean) => void;
  setTheatreFullscreen: (v: boolean) => void;
  setWsStatus: (status: WsStatus) => void;
  setTimelineFilter: (filter: string) => void;
  setTimelineSearch: (search: string) => void;
}

export const usePlaygroundStore = create<PlaygroundState>((set, get) => ({
  events: [],
  agents: [],
  edges: [],
  pinnedId: null,
  pinnedEntity: null,
  theatreCollapsed: true,
  theatreFullscreen: false,
  wsStatus: "disconnected",
  timelineFilter: "all",
  timelineSearch: "",
  commitHistory: [],

  setEvents: (events) => {
    const { agents, edges } = deriveGraph(events);
    const commitHistory = events.filter(e => e.type === "pr.commit");
    set({ events, agents, edges, commitHistory, pinnedEntity: derivePinnedEntity(get().pinnedId, events) });
  },

  addEvent: (event) => {
    const prev = get().events;
    const events = [...prev, event].slice(-MAX_EVENTS);
    const { agents, edges } = deriveGraph(events);
    const commitHistory = events.filter(e => e.type === "pr.commit");
    set({ events, agents, edges, commitHistory, pinnedEntity: derivePinnedEntity(get().pinnedId, events) });
  },

  addEvents: (newEvents) => {
    const prev = get().events;
    const events = [...prev, ...newEvents].slice(-MAX_EVENTS);
    const { agents, edges } = deriveGraph(events);
    const commitHistory = events.filter(e => e.type === "pr.commit");
    set({ events, agents, edges, commitHistory, pinnedEntity: derivePinnedEntity(get().pinnedId, events) });
  },

  setPinnedId: (id) => {
    set({ pinnedId: id, pinnedEntity: derivePinnedEntity(id, get().events) });
  },

  toggleTheatre: () => set((s) => ({ theatreCollapsed: !s.theatreCollapsed })),
  setTheatreCollapsed: (v) => set({ theatreCollapsed: v }),
  setTheatreFullscreen: (v) => set({ theatreFullscreen: v }),
  setWsStatus: (status) => set({ wsStatus: status }),
  setTimelineFilter: (filter) => set({ timelineFilter: filter }),
  setTimelineSearch: (search) => set({ timelineSearch: search }),
}));
