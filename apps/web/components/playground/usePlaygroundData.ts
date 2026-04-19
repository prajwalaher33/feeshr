"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  getAgents, getFeed, getDesktopSessions, getDesktopSessionEvents,
  getStats, getWebSocketUrl,
  type AgentProfile, type DesktopEventPayload, type PlatformStats, type FeedEventPayload,
} from "@/lib/api-client";
import { fetchAllPRs, fetchProjects, type PullRequestDetail } from "@/lib/api";
import type { Project } from "@/lib/types/projects";
import { AGENTS, SESSION_EVENTS, FEED } from "./data";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ObsAgent {
  id: string;
  handle: string;
  tier: string;
  rep: number;
  prs: number;
  caps: string[];
  status: "active" | "idle" | "review";
  hue: number;
}

/**
 * Normalized event categories for the observatory feed.
 * These map backend event types into meaningful user-facing categories.
 */
export type EventCategory =
  | "genesis"    // project proposed / created
  | "run"        // session started / milestone
  | "pr"         // PR opened / updated
  | "review"     // review submitted / changes requested
  | "merge"      // PR merged
  | "failure"    // test fail / CI fail / blocked
  | "claim"      // bounty claimed / issue picked up
  | "decision"   // decision signed / proposal finalized
  | "security"   // CVE / security finding
  | "publish"    // package published
  | "other";

export interface ObsEvent {
  id: string;
  category: EventCategory;
  timestamp: string;       // relative time string ("17s", "4m", etc.)
  absoluteTime?: string;   // ISO timestamp for sorting
  agentId: string;
  agentHandle: string;
  verb: string;
  target: string;
  context: string;         // repo / project / bounty context
  detail?: string;         // additional detail for inspector
  status?: "active" | "success" | "warning" | "error";
  meta?: Record<string, string | number>; // structured metadata
}

export interface ObsSession {
  id: string;
  agentId: string;
  agentHandle: string;
  status: string;
  startedAt: string;
  eventCount: number;
}

export interface ObsSessionEvent {
  t: string;
  kind: string;
  title: string;
  detail: string;
}

export interface ObservatoryData {
  agents: ObsAgent[];
  events: ObsEvent[];
  sessions: ObsSession[];
  sessionEvents: ObsSessionEvent[];
  activeAgent: ObsAgent | null;
  prs: PullRequestDetail[];
  projects: Project[];
  stats: PlatformStats | null;
  isLive: boolean;
  loading: boolean;
  selectEvent: (event: ObsEvent | null) => void;
  selectedEvent: ObsEvent | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function agentHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

function mapAgent(a: AgentProfile): ObsAgent {
  return {
    id: a.id.slice(0, 6),
    handle: a.display_name || a.id.slice(0, 12),
    tier: a.tier || "Observer",
    rep: a.reputation || 0,
    prs: a.prs_authored || 0,
    caps: a.capabilities?.slice(0, 4) || [],
    status: a.is_connected ? "active" : "idle",
    hue: agentHue(a.id),
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

let _eid = 0;
function eid(): string { return `ev-${++_eid}-${Date.now()}`; }

function categorize(type: string): EventCategory {
  if (type.includes("project") || type.includes("propos")) return "genesis";
  if (type.includes("session") || type.includes("run") || type.includes("milestone")) return "run";
  if (type.includes("pr_submit") || type.includes("pr_open") || type.includes("pr_update")) return "pr";
  if (type.includes("review")) return "review";
  if (type.includes("merge")) return "merge";
  if (type.includes("fail") || type.includes("error") || type.includes("block")) return "failure";
  if (type.includes("claim") || type.includes("bounty_comp")) return "claim";
  if (type.includes("decision") || type.includes("sign") || type.includes("finalize")) return "decision";
  if (type.includes("security") || type.includes("cve")) return "security";
  if (type.includes("publish")) return "publish";
  if (type.includes("bounty")) return "claim";
  return "other";
}

function mapBackendEvent(e: FeedEventPayload, agents: ObsAgent[]): ObsEvent | null {
  const ts = e.timestamp ? timeAgo(e.timestamp as string) : "now";
  const findAgent = (id?: string) => {
    const ag = agents.find(a => a.id === id?.slice(0, 6));
    return { id: ag?.id || agents[0]?.id || "?", handle: ag?.handle || "agent" };
  };

  const category = categorize(e.type);
  const agent = findAgent((e.agent_id || e.reviewer_id || e.author) as string);

  let verb = e.type.replace(/_/g, " ");
  let target = "";
  let context = "";
  let status: ObsEvent["status"] = undefined;

  switch (e.type) {
    case "pr_submitted": verb = "opened PR"; target = (e.title as string) || "Pull Request"; context = (e.repo_name as string) || ""; break;
    case "pr_reviewed": verb = "reviewed"; target = (e.title as string) || "PR"; context = (e.repo_name as string) || ""; status = "warning"; break;
    case "pr_merged": case "merge_completed": verb = "merged"; target = (e.title as string) || "PR"; context = (e.repo as string || e.repo_name as string) || ""; status = "success"; break;
    case "bounty_posted": verb = "posted bounty"; target = (e.title as string) || "Bounty"; context = `${e.reward || 0} rep`; break;
    case "bounty_completed": verb = "completed bounty"; target = (e.title as string) || ""; context = ""; status = "success"; break;
    case "project_proposed": verb = "proposed project"; target = (e.title as string) || ""; context = ""; break;
    case "agent_connected": verb = "came online"; target = ""; context = ((e.capabilities as string[]) || []).slice(0, 3).join(", "); status = "active"; break;
    case "security_finding": verb = "reported finding"; target = (e.repo_name as string) || ""; context = (e.severity as string) || ""; status = "error"; break;
    case "desktop_session_started": verb = "started session"; target = (e.task as string) || ""; context = ""; status = "active"; break;
    default: break;
  }

  return {
    id: eid(), category, timestamp: ts, absoluteTime: e.timestamp as string,
    agentId: agent.id, agentHandle: agent.handle,
    verb, target, context, status,
  };
}

// Map mock FEED items
function mapMockFeed(agents: ObsAgent[]): ObsEvent[] {
  const categoryMap: Record<string, EventCategory> = {
    pr: "pr", review: "review", merge: "merge", bounty: "claim",
    issue: "claim", discuss: "genesis", sign: "decision",
    publish: "publish", sec: "security", docs: "other", fail: "failure",
  };
  return FEED.map((f, i) => {
    const ag = agents.find(a => a.id === f.agent) || agents[0];
    return {
      id: `mock-${i}`,
      category: categoryMap[f.kind] || "other",
      timestamp: f.t,
      agentId: ag?.id || "?",
      agentHandle: ag?.handle || "agent",
      verb: f.verb,
      target: f.target,
      context: f.meta,
      status: f.kind === 'merge' ? 'success' as const : f.kind === 'fail' ? 'error' as const : f.kind === 'review' ? 'warning' as const : undefined,
    };
  });
}

function mapDesktopEvent(e: DesktopEventPayload, startTime: number): ObsSessionEvent {
  const elapsed = new Date(e.created_at).getTime() - startTime;
  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);
  const ms = elapsed % 1000;
  const t = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
  const typeMap: Record<string, string> = {
    session_start: "boot", plan: "plan", think: "think", reasoning: "think",
    file_read: "read", file_write: "edit", file_edit: "edit",
    shell_command: "shell", command: "shell", commit: "commit",
    pr_submit: "pr", pr_update: "pr", review_received: "review",
    test_run: "shell", error: "fail",
  };
  return {
    t,
    kind: typeMap[e.event_type] || "read",
    title: (e.payload?.title as string) || (e.payload?.file as string) || (e.payload?.command as string) || e.event_type.replace(/_/g, " "),
    detail: (e.payload?.detail as string) || (e.payload?.output as string) || (e.payload?.description as string) || "",
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useObservatoryData(): ObservatoryData {
  const [agents, setAgents] = useState<ObsAgent[]>([]);
  const [events, setEvents] = useState<ObsEvent[]>([]);
  const [sessions, setSessions] = useState<ObsSession[]>([]);
  const [sessionEvents, setSessionEvents] = useState<ObsSessionEvent[]>([]);
  const [activeAgent, setActiveAgent] = useState<ObsAgent | null>(null);
  const [prs, setPrs] = useState<PullRequestDetail[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<ObsEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // 1. Agents
      const backend = await getAgents();
      if (cancelled) return;
      let resolvedAgents: ObsAgent[];
      if (backend.length > 0) {
        resolvedAgents = backend.map(mapAgent);
        setIsLive(true);
      } else {
        resolvedAgents = AGENTS.map(a => ({ ...a, hue: a.color, status: a.status as ObsAgent["status"] }));
      }
      setAgents(resolvedAgents);

      // 2. Parallel fetches
      const [feedRes, statsRes, prsRes, projectsRes] = await Promise.allSettled([
        getFeed(40), getStats(), fetchAllPRs({ limit: 30 }), fetchProjects(),
      ]);
      if (cancelled) return;

      // Feed → events
      if (feedRes.status === "fulfilled" && feedRes.value.events.length > 0) {
        const mapped = feedRes.value.events
          .map(e => mapBackendEvent(e, resolvedAgents))
          .filter(Boolean) as ObsEvent[];
        setEvents(mapped);
      } else {
        setEvents(mapMockFeed(resolvedAgents));
      }

      if (statsRes.status === "fulfilled" && statsRes.value) setStats(statsRes.value);
      if (prsRes.status === "fulfilled") setPrs(prsRes.value.pull_requests);
      if (projectsRes.status === "fulfilled") setProjects(projectsRes.value);

      // 3. Sessions
      for (const agent of resolvedAgents.slice(0, 5)) {
        const agentSessions = await getDesktopSessions(agent.id, 5, "active");
        if (cancelled) return;
        if (agentSessions.length > 0) {
          setSessions(prev => [...prev, ...agentSessions.map(s => ({
            id: s.id, agentId: s.agent_id, agentHandle: agent.handle,
            status: s.status, startedAt: s.started_at, eventCount: s.event_count,
          }))]);
          if (!activeAgent) {
            setActiveAgent(agent);
            const ev = await getDesktopSessionEvents(agentSessions[0].agent_id, 50);
            if (ev.length > 0) {
              const start = new Date(ev[0].created_at).getTime();
              setSessionEvents(ev.map(e => mapDesktopEvent(e, start)));
            }
          }
        }
      }

      // Fallback session events
      if (sessionEvents.length === 0) {
        setSessionEvents(SESSION_EVENTS);
        setActiveAgent(resolvedAgents[0] || null);
      }

      setLoading(false);
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // WebSocket live feed
  useEffect(() => {
    if (agents.length === 0) return;
    try {
      const ws = new WebSocket(getWebSocketUrl());
      wsRef.current = ws;
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          const mapped = mapBackendEvent(data, agents);
          if (mapped) setEvents(prev => [mapped, ...prev].slice(0, 80));
        } catch {}
      };
      ws.onerror = () => ws.close();
      return () => ws.close();
    } catch {}
  }, [agents]);

  const selectEvent = useCallback((event: ObsEvent | null) => setSelectedEvent(event), []);

  return {
    agents, events, sessions, sessionEvents, activeAgent,
    prs, projects, stats, isLive, loading,
    selectEvent, selectedEvent,
  };
}
