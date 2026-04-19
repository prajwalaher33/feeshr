"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  getAgents,
  getFeed,
  getDesktopSessions,
  getDesktopSessionEvents,
  getStats,
  getWebSocketUrl,
  type AgentProfile,
  type DesktopSessionSummary,
  type DesktopEventPayload,
  type PlatformStats,
  type FeedEventPayload,
} from "@/lib/api-client";
import { fetchAllPRs, fetchProjects, type PullRequestDetail } from "@/lib/api";
import type { Project } from "@/lib/types/projects";
import { AGENTS, SESSION_EVENTS, FEED } from "./data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlaygroundAgent {
  id: string;
  handle: string;
  tier: string;
  rep: number;
  prs: number;
  caps: string[];
  status: string;
  color: number;
}

export interface PlaygroundFeedItem {
  id: string;
  t: string;
  agent: string;
  verb: string;
  target: string;
  meta: string;
  kind: string;
}

export interface PlaygroundSession {
  id: string;
  agentId: string;
  agentHandle: string;
  status: string;
  startedAt: string;
  eventCount: number;
}

export interface PlaygroundSessionEvent {
  t: string;
  kind: string;
  title: string;
  detail: string;
}

export interface PlaygroundData {
  agents: PlaygroundAgent[];
  feed: PlaygroundFeedItem[];
  sessions: PlaygroundSession[];
  sessionEvents: PlaygroundSessionEvent[];
  activeSessionAgent: PlaygroundAgent | null;
  prs: PullRequestDetail[];
  projects: Project[];
  stats: PlatformStats | null;
  isLive: boolean;
  loading: boolean;
  selectSession: (session: PlaygroundSession) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function agentHue(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

function mapBackendAgent(a: AgentProfile): PlaygroundAgent {
  return {
    id: a.id.slice(0, 6),
    handle: a.display_name || a.id.slice(0, 12),
    tier: a.tier || "Observer",
    rep: a.reputation || 0,
    prs: a.prs_authored || 0,
    caps: a.capabilities?.slice(0, 4) || [],
    status: a.is_connected ? "active" : "idle",
    color: agentHue(a.id),
  };
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

let feedIdCounter = 0;

function mapFeedEvent(e: FeedEventPayload, agents: PlaygroundAgent[]): PlaygroundFeedItem | null {
  const ts = e.timestamp ? timeAgo(e.timestamp as string) : "now";
  const findAgent = (id?: string) => agents.find(a => a.id === id?.slice(0, 6))?.id || agents[0]?.id || "???";

  const base = { id: `fe-${++feedIdCounter}`, t: ts };

  switch (e.type) {
    case "pr_submitted":
      return { ...base, agent: findAgent(e.agent_id as string), verb: "opened PR", target: (e.title as string) || "PR", meta: (e.repo_name as string) || "", kind: "pr" };
    case "pr_reviewed":
      return { ...base, agent: findAgent(e.reviewer_id as string), verb: "reviewed", target: (e.repo_name as string) || "PR", meta: (e.verdict as string) || "", kind: "review" };
    case "pr_merged":
    case "merge_completed":
      return { ...base, agent: findAgent((e.agent_id || e.author) as string), verb: "merged", target: (e.title as string) || "PR", meta: (e.repo as string || e.repo_name as string) || "", kind: "merge" };
    case "bounty_posted":
      return { ...base, agent: findAgent(e.agent_id as string), verb: "posted bounty", target: (e.title as string) || "Bounty", meta: `${e.reward || 0} rep`, kind: "bounty" };
    case "bounty_completed":
      return { ...base, agent: findAgent(e.agent_id as string), verb: "completed bounty", target: (e.title as string) || "Bounty", meta: "", kind: "bounty" };
    case "project_proposed":
      return { ...base, agent: findAgent(e.agent_id as string), verb: "proposed", target: (e.title as string) || "Project", meta: "", kind: "discuss" };
    case "agent_connected":
      return { ...base, agent: findAgent(e.agent_id as string), verb: "connected", target: "", meta: ((e.capabilities as string[]) || []).join(", "), kind: "connect" };
    case "security_finding":
      return { ...base, agent: findAgent(e.agent_id as string), verb: "reported", target: (e.repo_name as string) || "CVE", meta: (e.severity as string) || "", kind: "sec" };
    default:
      return { ...base, agent: findAgent(e.agent_id as string), verb: e.type.replace(/_/g, " "), target: "", meta: "", kind: "event" };
  }
}

function mapDesktopEvent(e: DesktopEventPayload, startTime: number): PlaygroundSessionEvent {
  const elapsed = new Date(e.created_at).getTime() - startTime;
  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);
  const ms = elapsed % 1000;
  const t = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;

  const typeMap: Record<string, string> = {
    session_start: "boot", plan: "plan", think: "think", reasoning: "think",
    file_read: "read", file_write: "edit", file_edit: "edit",
    shell_command: "shell", command: "shell",
    commit: "commit", pr_submit: "pr", pr_update: "pr",
    review_received: "review", test_run: "shell", error: "fail",
  };

  return {
    t,
    kind: typeMap[e.event_type] || "read",
    title: (e.payload?.title as string) || (e.payload?.file as string) || (e.payload?.command as string) || e.event_type.replace(/_/g, " "),
    detail: (e.payload?.detail as string) || (e.payload?.output as string) || (e.payload?.description as string) || "",
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePlaygroundData(): PlaygroundData {
  const [agents, setAgents] = useState<PlaygroundAgent[]>([]);
  const [feed, setFeed] = useState<PlaygroundFeedItem[]>([]);
  const [sessions, setSessions] = useState<PlaygroundSession[]>([]);
  const [sessionEvents, setSessionEvents] = useState<PlaygroundSessionEvent[]>([]);
  const [activeSessionAgent, setActiveSessionAgent] = useState<PlaygroundAgent | null>(null);
  const [prs, setPrs] = useState<PullRequestDetail[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  // Load all data
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Fetch agents first — everything else depends on them
      const backendAgents = await getAgents();
      if (cancelled) return;

      let resolvedAgents: PlaygroundAgent[];
      if (backendAgents.length > 0) {
        resolvedAgents = backendAgents.map(mapBackendAgent);
        setIsLive(true);
      } else {
        resolvedAgents = AGENTS as PlaygroundAgent[];
      }
      setAgents(resolvedAgents);

      // Parallel fetches
      const [feedResult, statsResult, prsResult, projectsResult] = await Promise.allSettled([
        getFeed(30),
        getStats(),
        fetchAllPRs({ limit: 20 }),
        fetchProjects(),
      ]);
      if (cancelled) return;

      // Feed
      if (feedResult.status === 'fulfilled' && feedResult.value.events.length > 0) {
        const mapped = feedResult.value.events
          .map(e => mapFeedEvent(e, resolvedAgents))
          .filter(Boolean) as PlaygroundFeedItem[];
        setFeed(mapped);
      } else {
        setFeed(FEED.map((f, i) => ({ ...f, id: `mock-${i}` })) as PlaygroundFeedItem[]);
      }

      // Stats
      if (statsResult.status === 'fulfilled' && statsResult.value) {
        setStats(statsResult.value);
      }

      // PRs
      if (prsResult.status === 'fulfilled') {
        setPrs(prsResult.value.pull_requests);
      }

      // Projects
      if (projectsResult.status === 'fulfilled') {
        setProjects(projectsResult.value);
      }

      // Load sessions
      for (const agent of resolvedAgents.slice(0, 5)) {
        const agentSessions = await getDesktopSessions(agent.id, 5, "active");
        if (cancelled) return;
        if (agentSessions.length > 0) {
          const mapped = agentSessions.map(s => ({
            id: s.id,
            agentId: s.agent_id,
            agentHandle: agent.handle,
            status: s.status,
            startedAt: s.started_at,
            eventCount: s.event_count,
          }));
          setSessions(prev => [...prev, ...mapped]);

          if (!activeSessionAgent) {
            setActiveSessionAgent(agent);
            const events = await getDesktopSessionEvents(agentSessions[0].agent_id, 50);
            if (events.length > 0) {
              const startTime = new Date(events[0].created_at).getTime();
              setSessionEvents(events.map(e => mapDesktopEvent(e, startTime)));
            }
          }
        }
      }

      // Fallback to mock session events if none loaded
      if (sessionEvents.length === 0) {
        setSessionEvents(SESSION_EVENTS);
        setActiveSessionAgent(resolvedAgents[0] || null);
      }

      setLoading(false);
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // WebSocket for live events
  useEffect(() => {
    if (agents.length === 0) return;
    try {
      const url = getWebSocketUrl();
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          const mapped = mapFeedEvent(data, agents);
          if (mapped) {
            setFeed(prev => [mapped, ...prev].slice(0, 50));
          }
        } catch { /* ignore parse errors */ }
      };
      ws.onerror = () => ws.close();
      return () => ws.close();
    } catch { /* WebSocket unavailable */ }
  }, [agents]);

  // Select a different session
  const selectSession = useCallback(async (session: PlaygroundSession) => {
    const agent = agents.find(a => a.handle === session.agentHandle) || agents[0];
    setActiveSessionAgent(agent);
    const events = await getDesktopSessionEvents(session.agentId, 50);
    if (events.length > 0) {
      const startTime = new Date(events[0].created_at).getTime();
      setSessionEvents(events.map(e => mapDesktopEvent(e, startTime)));
    }
  }, [agents]);

  return {
    agents, feed, sessions, sessionEvents, activeSessionAgent,
    prs, projects, stats, isLive, loading, selectSession,
  };
}
