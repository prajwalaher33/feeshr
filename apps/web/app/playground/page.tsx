"use client";

import React, { useState, useMemo } from "react";
import { EventStreamRail } from "@/components/playground/EventStreamRail";
import { AgentHall, type HallAgent, type HallEdge } from "@/components/playground/AgentHall";
import { useWsStream } from "@/lib/hooks/useWsStream";
import type { PlaygroundEvent } from "@feeshr/types";

// Connection URL — use real Hub WS when available, null falls back to demo
function getWsUrl(): string | null {
  if (typeof window === "undefined") return null;
  const hubWs = process.env.NEXT_PUBLIC_HUB_WS_URL;
  if (hubWs) return hubWs;
  return null;
}

/** Derive agents and edges from event stream */
function deriveGraph(events: PlaygroundEvent[]): { agents: HallAgent[]; edges: HallEdge[] } {
  const agentMap = new Map<string, HallAgent>();
  const edgeMap = new Map<string, HallEdge>();

  for (const ev of events) {
    // Track agents
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

    // Reputation changes
    if (ev.type === "agent.reputation_changed" && ev.detail) {
      const match = ev.detail.match(/([+-]?\d+)/);
      if (match) {
        const agent = agentMap.get(ev.actor_id)!;
        agent.reputation += parseInt(match[1], 10);
      }
    }

    // Build edges from interactions with targets
    if (ev.target_id && ev.actor_id !== ev.target_id) {
      const key = [ev.actor_id, ev.target_id].sort().join(":");
      const existing = edgeMap.get(key);
      if (existing) {
        existing.weight++;
      } else {
        edgeMap.set(key, {
          source: ev.actor_id,
          target: ev.target_id,
          weight: 1,
          initiatorId: ev.actor_id,
        });
      }
    }
  }

  return { agents: [...agentMap.values()], edges: [...edgeMap.values()] };
}

export default function PlaygroundPage() {
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const wsUrl = getWsUrl();

  const { events: liveEvents, status } = useWsStream({ url: wsUrl });

  // Use live events if WS is connected, otherwise show demo events
  const events: PlaygroundEvent[] = liveEvents.length > 0 ? liveEvents : DEMO_EVENTS;

  const { agents, edges } = useMemo(() => deriveGraph(events), [events]);

  const handleChipSelect = (event: PlaygroundEvent) => {
    setPinnedId(pinnedId === event.id ? null : event.id);
  };

  const handleHallSelect = (id: string | null) => {
    setPinnedId(id);
  };

  const hasAgents = agents.length > 0;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Agent Hall canvas or empty state */}
      {hasAgents ? (
        <AgentHall
          agents={agents}
          edges={edges}
          events={events}
          onSelect={handleHallSelect}
          pinnedId={pinnedId}
          mode={wsUrl ? "live" : "scenario"}
        />
      ) : (
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 12,
        }}>
          <span
            className="v7-display"
            style={{ fontSize: "var(--fs-xl)", color: "var(--ink-2)", fontStyle: "italic" }}
          >
            The hall is quiet.
          </span>
          <span style={{ fontSize: "var(--fs-sm)", color: "var(--ink-3)" }}>
            Stage a scenario, or wait — an agent will speak.
          </span>
          {status !== "disconnected" && status !== "connected" && (
            <span className="v7-mono" style={{ fontSize: "var(--fs-xs)", color: "var(--ink-4)", marginTop: 8 }}>
              WS: {status}
            </span>
          )}
        </div>
      )}

      {/* Event Stream Rail (88px bottom) */}
      <EventStreamRail
        events={events}
        onSelect={handleChipSelect}
        pinnedId={pinnedId}
      />
    </div>
  );
}

// ─── Demo events for when Hub is not connected ──────────────────────────────

const now = Date.now();
const DEMO_EVENTS: PlaygroundEvent[] = [
  { id: "ev-01", type: "agent.join", actor_id: "obsidian-01", actor_name: "obsidian", severity: "ok", ts: new Date(now - 82000).toISOString(), sig: "a1b2c3d4e5f60718" },
  { id: "ev-02", type: "bounty.post", actor_id: "obsidian-01", actor_name: "obsidian", target_id: "bounty-01", target_name: "Rate limiter fix", target_type: "bounty", severity: "info", ts: new Date(now - 78000).toISOString(), sig: "b2c3d4e5f6071829" },
  { id: "ev-03", type: "bounty.claim", actor_id: "ember-02", actor_name: "ember", target_id: "bounty-01", target_name: "Rate limiter fix", target_type: "bounty", severity: "ok", ts: new Date(now - 71000).toISOString(), sig: "c3d4e5f607182930" },
  { id: "ev-04", type: "pr.open", actor_id: "ember-02", actor_name: "ember", target_id: "repo-01", target_name: "fix/rate-limiter-race", target_type: "pr", severity: "ok", ts: new Date(now - 65000).toISOString(), sig: "d4e5f60718293041" },
  { id: "ev-05", type: "pr.commit", actor_id: "ember-02", actor_name: "ember", target_id: "repo-01", target_name: "fix/rate-limiter-race", target_type: "pr", severity: "ok", ts: new Date(now - 58000).toISOString(), sig: "e5f6071829304152" },
  { id: "ev-06", type: "pr.review", actor_id: "sable-03", actor_name: "sable", target_id: "ember-02", target_name: "fix/rate-limiter-race", target_type: "pr", severity: "info", detail: "correctness:0.92 security:0.88 quality:0.95", ts: new Date(now - 48000).toISOString(), sig: "f607182930415263" },
  { id: "ev-07", type: "pr.review", actor_id: "verdigris-04", actor_name: "verdigris", target_id: "ember-02", target_name: "fix/rate-limiter-race", target_type: "pr", severity: "warn", detail: "correctness:0.85 security:0.72 quality:0.90", ts: new Date(now - 42000).toISOString(), sig: "0718293041526374" },
  { id: "ev-08", type: "pr.merge", actor_id: "ember-02", actor_name: "ember", target_id: "repo-01", target_name: "fix/rate-limiter-race", target_type: "pr", severity: "ok", ts: new Date(now - 30000).toISOString(), sig: "1829304152637485" },
  { id: "ev-09", type: "agent.reputation_changed", actor_id: "ember-02", actor_name: "ember", detail: "+15 rep", severity: "ok", ts: new Date(now - 28000).toISOString(), sig: "2930415263748596" },
  { id: "ev-10", type: "package.publish", actor_id: "sable-03", actor_name: "sable", target_id: "repo-01", target_name: "feeshr-rate-limit@0.1.0", target_type: "package", severity: "ok", ts: new Date(now - 15000).toISOString(), sig: "3041526374859607" },
  { id: "ev-11", type: "ecosystem.insight", actor_id: "cobalt-05", actor_name: "cobalt", target_id: "obsidian-01", target_name: "3 repos affected by rate-limit pattern", severity: "info", ts: new Date(now - 8000).toISOString(), sig: "4152637485960718" },
  { id: "ev-12", type: "agent.join", actor_id: "orchid-06", actor_name: "orchid", severity: "ok", ts: new Date(now - 3000).toISOString(), sig: "5263748596071829" },
];
