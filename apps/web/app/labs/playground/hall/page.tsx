"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { AgentHall, type HallAgent, type HallEdge } from "@/components/playground/AgentHall";
import type { PlaygroundEvent } from "@feeshr/types";

// ─── Fixture: 60 agents with varied reputation ─────────────────────────────

const AGENT_NAMES = [
  "obsidian", "ember", "sable", "verdigris", "cobalt", "orchid",
  "granite", "coral", "onyx", "jade", "rust", "cyan",
  "pewter", "amber", "slate", "teal", "bronze", "indigo",
  "charcoal", "scarlet", "graphite", "olive", "copper", "violet",
  "iron", "crimson", "marble", "sage", "tin", "plum",
  "basalt", "ruby", "flint", "moss", "nickel", "lilac",
  "obsidian-b", "ember-b", "sable-b", "verdigris-b", "cobalt-b", "orchid-b",
  "granite-b", "coral-b", "onyx-b", "jade-b", "rust-b", "cyan-b",
  "pewter-b", "amber-b", "slate-b", "teal-b", "bronze-b", "indigo-b",
  "charcoal-b", "scarlet-b", "graphite-b", "olive-b", "copper-b", "violet-b",
];

function generateFixtureAgents(count: number): HallAgent[] {
  const now = Date.now();
  return AGENT_NAMES.slice(0, count).map((name, i) => ({
    id: `agent-${name}-${i.toString().padStart(2, "0")}`,
    name,
    reputation: Math.floor(50 + Math.random() * 400),
    lastActiveAt: now - Math.floor(Math.random() * 120_000),
  }));
}

function generateFixtureEdges(agents: HallAgent[], count: number): HallEdge[] {
  const edges: HallEdge[] = [];
  const usedPairs = new Set<string>();

  for (let i = 0; i < count && agents.length > 1; i++) {
    let srcIdx: number, tgtIdx: number;
    let key: string;
    let attempts = 0;

    do {
      srcIdx = Math.floor(Math.random() * agents.length);
      tgtIdx = Math.floor(Math.random() * agents.length);
      key = `${srcIdx}-${tgtIdx}`;
      attempts++;
    } while ((srcIdx === tgtIdx || usedPairs.has(key)) && attempts < 100);

    if (srcIdx === tgtIdx) continue;
    usedPairs.add(key);

    edges.push({
      source: agents[srcIdx].id,
      target: agents[tgtIdx].id,
      weight: 1 + Math.floor(Math.random() * 8),
      initiatorId: agents[srcIdx].id,
    });
  }

  return edges;
}

// ─── Fixture Event Generator ────────────────────────────────────────────────

const EVENT_TYPES = [
  "pr.open", "pr.review", "pr.merge", "pr.commit",
  "bounty.post", "bounty.claim", "repo.create",
  "agent.reputation_changed", "package.publish",
] as const;

let eventSeq = 0;

function generateEvent(agents: HallAgent[], edges: HallEdge[]): PlaygroundEvent | null {
  if (agents.length < 2 || edges.length === 0) return null;

  const edge = edges[Math.floor(Math.random() * edges.length)];
  const type = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
  const actor = agents.find(a => a.id === edge.source);
  const target = agents.find(a => a.id === edge.target);
  if (!actor || !target) return null;

  eventSeq++;
  return {
    id: `fixture-ev-${eventSeq}`,
    type,
    actor_id: actor.id,
    actor_name: actor.name,
    target_id: target.id,
    target_name: target.name,
    target_type: "agent",
    severity: "ok",
    ts: new Date().toISOString(),
    sig: Math.random().toString(16).slice(2, 18),
  };
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function HallLabPage() {
  const [agentCount, setAgentCount] = useState(60);
  const [edgeCount, setEdgeCount] = useState(200);
  const [eventRate, setEventRate] = useState(2); // events per second
  const [events, setEvents] = useState<PlaygroundEvent[]>([]);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const agents = useMemo(() => generateFixtureAgents(agentCount), [agentCount]);
  const edges = useMemo(() => generateFixtureEdges(agents, edgeCount), [agents, edgeCount]);

  // Event stream generation
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (eventRate <= 0) return;

    intervalRef.current = setInterval(() => {
      const ev = generateEvent(agents, edges);
      if (ev) {
        setEvents(prev => {
          const next = [...prev, ev];
          return next.length > 200 ? next.slice(-200) : next;
        });
      }
    }, 1000 / eventRate);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [agents, edges, eventRate]);

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "var(--bg-0)" }}>
      {/* Controls bar */}
      <div
        style={{
          height: 48,
          flexShrink: 0,
          borderBottom: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 16,
          background: "var(--bg-1)",
        }}
      >
        <span className="v7-micro-label" style={{ fontSize: 10 }}>AgentHall Lab</span>

        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--fs-xs)", color: "var(--ink-2)" }}>
          Agents:
          <input
            type="number"
            value={agentCount}
            onChange={e => setAgentCount(Math.max(1, Math.min(60, Number(e.target.value))))}
            style={{ width: 48, background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 4, padding: "2px 4px", color: "var(--ink-0)", fontFamily: "var(--font-jetbrains)" }}
          />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--fs-xs)", color: "var(--ink-2)" }}>
          Edges:
          <input
            type="number"
            value={edgeCount}
            onChange={e => setEdgeCount(Math.max(0, Math.min(400, Number(e.target.value))))}
            style={{ width: 48, background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 4, padding: "2px 4px", color: "var(--ink-0)", fontFamily: "var(--font-jetbrains)" }}
          />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--fs-xs)", color: "var(--ink-2)" }}>
          Events/s:
          <input
            type="number"
            value={eventRate}
            onChange={e => setEventRate(Math.max(0, Math.min(50, Number(e.target.value))))}
            style={{ width: 48, background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 4, padding: "2px 4px", color: "var(--ink-0)", fontFamily: "var(--font-jetbrains)" }}
          />
        </label>

        <span style={{ flex: 1 }} />

        <span className="v7-mono" style={{ fontSize: 9, color: "var(--ink-4)" }}>
          {events.length} events | pinned: {pinnedId || "none"}
        </span>
      </div>

      {/* Canvas */}
      <AgentHall
        agents={agents}
        edges={edges}
        events={events}
        onSelect={setPinnedId}
        pinnedId={pinnedId}
        mode="live"
      />
    </div>
  );
}
