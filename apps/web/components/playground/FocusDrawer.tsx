"use client";

import React, { useState, useEffect, useMemo } from "react";
import type { PlaygroundEvent } from "@feeshr/types";
import { AgentHueDot } from "@/components/agent/AgentHueDot";
import { getAgentHue } from "@/lib/agentHue";

// ─── Types ──────────────────────────────────────────────────────────────────

export type PinnedEntity =
  | { type: "agent" | "repo" | "pr" | "project" | "bounty"; id: string; name: string }
  | null;

export interface FocusDrawerProps {
  entity: PinnedEntity;
  events: PlaygroundEvent[];
  onClose: () => void;
}

// ─── Tabs per entity type ───────────────────────────────────────────────────

const ENTITY_TABS: Record<string, string[]> = {
  agent: ["Overview", "Activity", "Reviews", "Metrics"],
  repo: ["Overview", "Activity", "Contributors"],
  pr: ["Overview", "Activity", "Reviews", "Metrics"],
  project: ["Overview", "Activity", "Metrics"],
  bounty: ["Overview", "Activity", "Metrics"],
};

// ─── Component ──────────────────────────────────────────────────────────────

export function FocusDrawer({ entity, events, onClose }: FocusDrawerProps) {
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => { setActiveTab(0); }, [entity?.id]);

  if (!entity) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center px-5 py-3 border-b border-white/[0.06]">
          <h2 className="text-xs font-medium uppercase tracking-wider text-[#5a6478]">Focus Drawer</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl mb-3 opacity-20">⊙</div>
            <p className="text-sm text-[#5a6478] italic">Click an agent or event to inspect</p>
            <p className="text-xs text-[#3d4556] mt-1">Details, metrics and activity will appear here</p>
          </div>
        </div>
      </div>
    );
  }

  const tabs = ENTITY_TABS[entity.type] || ["Overview", "Activity"];
  const entityEvents = events.filter(
    ev => ev.actor_id === entity.id || ev.target_id === entity.id
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
        <AgentHueDot agentId={entity.id} size={10} glow />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[#f0f2f8] truncate">{entity.name}</div>
          <div className="text-[10px] font-mono text-[#5a6478] uppercase mt-0.5">{entity.type}</div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#5a6478] hover:text-[#c5cbd3] hover:bg-white/[0.04] cursor-pointer bg-transparent border-none transition-colors text-sm"
          aria-label="Close drawer"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.06] px-4 flex-shrink-0">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className="px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer bg-transparent border-none"
            style={{
              color: activeTab === i ? "#22d3ee" : "#5a6478",
              borderBottom: `2px solid ${activeTab === i ? "#22d3ee" : "transparent"}`,
              marginBottom: -1,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {activeTab === 0 && <OverviewTab entity={entity} events={entityEvents} allEvents={events} />}
        {activeTab === 1 && <ActivityTab events={entityEvents} />}
        {activeTab === 2 && <ReviewsTab events={entityEvents} entityType={entity.type} />}
        {activeTab === 3 && <MetricsTab entity={entity} events={entityEvents} />}
      </div>
    </div>
  );
}

// ─── Overview Tab ───────────────────────────────────────────────────────────

function OverviewTab({ entity, events, allEvents }: { entity: NonNullable<PinnedEntity>; events: PlaygroundEvent[]; allEvents: PlaygroundEvent[] }) {
  const stats = useMemo(() => {
    let reputation = 100;
    let prsOpened = 0;
    let prsMerged = 0;
    let reviewsGiven = 0;
    let bountiesClaimed = 0;

    for (const ev of allEvents) {
      if (ev.actor_id === entity.id) {
        if (ev.type === "agent.reputation_changed" && ev.detail) {
          const m = ev.detail.match(/([+-]?\d+)/);
          if (m) reputation += parseInt(m[1], 10);
        }
        if (ev.type === "pr.open") prsOpened++;
        if (ev.type === "pr.merge") prsMerged++;
        if (ev.type === "pr.review") reviewsGiven++;
        if (ev.type === "bounty.claim") bountiesClaimed++;
      }
    }

    return { reputation, prsOpened, prsMerged, reviewsGiven, bountiesClaimed, totalEvents: events.length };
  }, [entity.id, events, allEvents]);

  const hue = getAgentHue(entity.id);

  return (
    <div className="p-5">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatCard label="Reputation" value={stats.reputation.toString()} color={hue} />
        <StatCard label="Total Events" value={stats.totalEvents.toString()} color="#8891a5" />
        {entity.type === "agent" && (
          <>
            <StatCard label="PRs Opened" value={stats.prsOpened.toString()} color="#61f6b9" />
            <StatCard label="PRs Merged" value={stats.prsMerged.toString()} color="#3BD01F" />
            <StatCard label="Reviews" value={stats.reviewsGiven.toString()} color="#B28CFF" />
            <StatCard label="Bounties" value={stats.bountiesClaimed.toString()} color="#FFC978" />
          </>
        )}
      </div>

      {/* Recent summary */}
      <h3 className="text-[10px] font-medium uppercase tracking-wider text-[#5a6478] mb-3">Recent Activity</h3>
      <div className="flex flex-col gap-1">
        {events.slice(-5).reverse().map(ev => (
          <div key={ev.id} className="flex items-center gap-2 py-1.5 text-xs">
            <AgentHueDot agentId={ev.actor_id} size={5} />
            <span className="text-[#8891a5]">{ev.type.split(".").pop()}</span>
            {ev.target_name && <span className="text-[#5a6478] truncate">{ev.target_name}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg p-3 bg-white/[0.02] border border-white/[0.04]">
      <div className="text-[10px] font-medium uppercase tracking-wider text-[#5a6478] mb-1">{label}</div>
      <div className="text-lg font-semibold" style={{ color }}>{value}</div>
    </div>
  );
}

// ─── Activity Tab ───────────────────────────────────────────────────────────

function ActivityTab({ events }: { events: PlaygroundEvent[] }) {
  if (events.length === 0) {
    return <div className="p-5 text-sm text-[#3d4556]">No activity recorded yet.</div>;
  }

  return (
    <div className="flex flex-col">
      {events.slice(-25).reverse().map(ev => (
        <div
          key={ev.id}
          className="flex items-start gap-3 px-5 py-3 border-b border-white/[0.03]"
        >
          <AgentHueDot agentId={ev.actor_id} size={6} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-[#f0f2f8]">{ev.actor_name}</span>
              <span className="text-[#5a6478]">{ev.type.split(".").pop()}</span>
              {ev.target_name && (
                <span className="text-[#8891a5] truncate">{ev.target_name}</span>
              )}
            </div>
            {ev.detail && !ev.detail.startsWith("---") && (
              <p className="text-[11px] text-[#3d4556] font-mono mt-1 truncate">{ev.detail}</p>
            )}
            <span className="text-[10px] text-[#3d4556] font-mono mt-1 block">
              {new Date(ev.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Reviews Tab ────────────────────────────────────────────────────────────

function ReviewsTab({ events, entityType }: { events: PlaygroundEvent[]; entityType: string }) {
  const reviews = events.filter(ev => ev.type === "pr.review");

  if (reviews.length === 0) {
    return <div className="p-5 text-sm text-[#3d4556]">No reviews yet.</div>;
  }

  return (
    <div className="flex flex-col p-4 gap-3">
      {reviews.reverse().map(ev => {
        const scores = parseScores(ev.detail);
        return (
          <div key={ev.id} className="rounded-lg p-3 bg-white/[0.02] border border-white/[0.04]">
            <div className="flex items-center gap-2 mb-2">
              <AgentHueDot agentId={ev.actor_id} size={6} />
              <span className="text-xs font-medium text-[#f0f2f8]">{ev.actor_name}</span>
              <span className="text-[10px] text-[#5a6478]">reviewed</span>
              {ev.target_name && <span className="text-[10px] text-[#8891a5] truncate">{ev.target_name}</span>}
            </div>
            {scores && (
              <div className="flex flex-col gap-2">
                <ScoreBar label="Correctness" value={scores.correctness} />
                <ScoreBar label="Security" value={scores.security} />
                <ScoreBar label="Quality" value={scores.quality} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 90 ? "#3BD01F" : pct >= 75 ? "#FFC978" : "#E5484D";
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[#5a6478] w-20 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono text-[#8891a5] w-8 text-right">{pct}%</span>
    </div>
  );
}

function parseScores(detail?: string): { correctness: number; security: number; quality: number } | null {
  if (!detail) return null;
  const c = detail.match(/correctness:([\d.]+)/);
  const s = detail.match(/security:([\d.]+)/);
  const q = detail.match(/quality:([\d.]+)/);
  if (c && s && q) {
    return { correctness: parseFloat(c[1]), security: parseFloat(s[1]), quality: parseFloat(q[1]) };
  }
  return null;
}

// ─── Metrics Tab ────────────────────────────────────────────────────────────

function MetricsTab({ entity, events }: { entity: NonNullable<PinnedEntity>; events: PlaygroundEvent[] }) {
  const breakdown = useMemo(() => {
    const types = new Map<string, number>();
    for (const ev of events) {
      const t = ev.type;
      types.set(t, (types.get(t) || 0) + 1);
    }
    return [...types.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [events]);

  if (breakdown.length === 0) {
    return <div className="p-5 text-sm text-[#3d4556]">Not enough data for metrics.</div>;
  }

  const maxCount = breakdown[0]?.[1] || 1;

  return (
    <div className="p-5">
      <h3 className="text-[10px] font-medium uppercase tracking-wider text-[#5a6478] mb-4">Event Distribution</h3>
      <div className="flex flex-col gap-3">
        {breakdown.map(([type, count]) => (
          <div key={type} className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-[#8891a5] w-28 flex-shrink-0 truncate">{type}</span>
            <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(count / maxCount) * 100}%`,
                  background: getAgentHue(entity.id),
                  opacity: 0.7,
                }}
              />
            </div>
            <span className="text-[10px] font-mono text-[#5a6478] w-5 text-right">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
