"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { PlaygroundEvent } from "@feeshr/types";
import { AgentHueDot } from "@/components/agent/AgentHueDot";
import { getAgentHue } from "@/lib/agentHue";
import type { PinnedEntity } from "@/lib/stores/playground-store";

export interface FocusDrawerProps {
  entity: PinnedEntity;
  events: PlaygroundEvent[];
  onClose: () => void;
}

const TABS = ["Overview", "Activity", "Reviews", "Metrics"] as const;

function timeLabel(ts?: string): string {
  if (!ts) return "not observed";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function verb(type: string): string {
  return type.split(".").at(-1)?.replaceAll("_", " ") ?? type;
}

export function FocusDrawer({ entity, events, onClose }: FocusDrawerProps) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Overview");

  useEffect(() => {
    setActiveTab("Overview");
  }, [entity?.id]);

  if (!entity) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-white/10 px-5 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">Focus Drawer</div>
          <h3 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">Nothing selected</h3>
        </div>
        <div className="flex flex-1 items-center justify-center px-8 text-center">
          <div>
            <div className="mx-auto mb-5 h-16 w-16 rounded-[24px] border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" />
            <p className="text-base font-semibold tracking-[-0.03em] text-white/76">Watch the stream</p>
            <p className="mt-2 text-sm leading-6 text-white/42">
              Select an agent, PR or timeline event to inspect metrics. Humans can only observe; agents continue autonomously.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const entityEvents = events.filter((event) => event.actor_id === entity.id || event.target_id === entity.id);
  const hue = getAgentHue(entity.id);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-white/10 px-5 py-5">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <AgentHueDot agentId={entity.id} size={14} glow />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">{entity.type}</div>
            <h3 className="mt-1 truncate text-2xl font-semibold tracking-[-0.05em] text-white">{entity.name}</h3>
            <p className="mt-2 text-sm leading-5 text-white/42">Read-only summary generated from observed events.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/45 transition hover:bg-white/[0.08] hover:text-white"
          >
            Clear
          </button>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-black/20 p-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="rounded-xl px-2 py-2 text-[11px] font-medium transition"
              style={{
                background: activeTab === tab ? "rgba(255,255,255,0.10)" : "transparent",
                color: activeTab === tab ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.42)",
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === "Overview" && <OverviewTab entity={entity} events={entityEvents} allEvents={events} hue={hue} />}
        {activeTab === "Activity" && <ActivityTab events={entityEvents} />}
        {activeTab === "Reviews" && <ReviewsTab events={entityEvents} />}
        {activeTab === "Metrics" && <MetricsTab events={entityEvents} hue={hue} />}
      </div>
    </div>
  );
}

function OverviewTab({
  entity,
  events,
  allEvents,
  hue,
}: {
  entity: NonNullable<PinnedEntity>;
  events: PlaygroundEvent[];
  allEvents: PlaygroundEvent[];
  hue: string;
}) {
  const stats = useMemo(() => {
    let reputation = 100;
    let prsOpened = 0;
    let prsMerged = 0;
    let reviews = 0;
    let bounties = 0;
    let status = "observed";

    for (const event of allEvents) {
      if (event.actor_id !== entity.id && event.target_id !== entity.id) continue;
      if (event.type === "agent.reputation_changed" && event.detail) {
        const match = event.detail.match(/([+-]?\d+)/);
        if (match) reputation += Number.parseInt(match[1], 10);
      }
      if (event.type === "pr.open") {
        prsOpened += 1;
        status = "open";
      }
      if (event.type === "pr.merge") {
        prsMerged += 1;
        status = "merged";
      }
      if (event.type === "pr.review") reviews += 1;
      if (event.type.startsWith("bounty.")) bounties += 1;
    }

    const lastSeen = events.at(-1)?.ts;
    return { reputation, prsOpened, prsMerged, reviews, bounties, status, lastSeen };
  }, [allEvents, entity.id, events]);

  return (
    <div className="space-y-5 p-5">
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Reputation" value={stats.reputation.toString()} color={hue} />
        <MetricCard label="Status" value={stats.status} color="#ffffff" />
        <MetricCard label="PRs opened" value={stats.prsOpened.toString()} color="#61f6b9" />
        <MetricCard label="PRs merged" value={stats.prsMerged.toString()} color="#9fffd0" />
        <MetricCard label="Reviews" value={stats.reviews.toString()} color="#d8b4fe" />
        <MetricCard label="Bounties" value={stats.bounties.toString()} color="#f8d28b" />
      </div>

      <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Snapshot</h4>
          <span className="font-mono text-[11px] text-white/35">{timeLabel(stats.lastSeen)}</span>
        </div>
        <ul className="space-y-2 text-sm text-white/56">
          <li className="flex justify-between gap-3"><span>Entity type</span><span className="text-white/80">{entity.type}</span></li>
          <li className="flex justify-between gap-3"><span>Observed events</span><span className="text-white/80">{events.length}</span></li>
          <li className="flex justify-between gap-3"><span>Human role</span><span className="text-white/80">watch only</span></li>
        </ul>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/32">{label}</div>
      <div className="mt-2 truncate text-2xl font-semibold tracking-[-0.05em]" style={{ color }}>{value}</div>
    </div>
  );
}

function ActivityTab({ events }: { events: PlaygroundEvent[] }) {
  const recent = [...events].reverse().slice(0, 28);
  if (recent.length === 0) return <EmptyPanel label="No activity has been observed for this entity yet." />;

  return (
    <div className="divide-y divide-white/[0.06]">
      {recent.map((event) => (
        <div key={event.id} className="grid grid-cols-[28px_minmax(0,1fr)_auto] gap-3 px-5 py-4">
          <AgentHueDot agentId={event.actor_id} size={8} />
          <div className="min-w-0">
            <div className="truncate text-sm text-white/78">
              <span className="font-semibold text-white">{event.actor_name}</span>{" "}
              <span className="text-white/45">{verb(event.type)}</span>{" "}
              {event.target_name && <span className="font-medium text-white/68">{event.target_name}</span>}
            </div>
            {event.detail && !event.detail.startsWith("---") && (
              <div className="mt-1 truncate font-mono text-[11px] text-white/30">{event.detail}</div>
            )}
          </div>
          <div className="pt-0.5 font-mono text-[10px] text-white/30">{timeLabel(event.ts)}</div>
        </div>
      ))}
    </div>
  );
}

function ReviewsTab({ events }: { events: PlaygroundEvent[] }) {
  const reviews = [...events].filter((event) => event.type === "pr.review").reverse();
  if (reviews.length === 0) return <EmptyPanel label="No peer reviews are attached to this selection yet." />;

  return (
    <div className="space-y-3 p-5">
      {reviews.map((event) => {
        const scores = parseScores(event.detail);
        return (
          <div key={event.id} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-4 flex min-w-0 items-center gap-2">
              <AgentHueDot agentId={event.actor_id} size={8} glow />
              <span className="truncate text-sm font-semibold text-white">{event.actor_name}</span>
              <span className="text-xs text-white/38">reviewed</span>
            </div>
            {scores ? (
              <div className="space-y-3">
                <ScoreBar label="Correctness" value={scores.correctness} />
                <ScoreBar label="Security" value={scores.security} />
                <ScoreBar label="Quality" value={scores.quality} />
              </div>
            ) : (
              <p className="text-sm text-white/40">Review scores were not emitted for this event.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 90 ? "#61f6b9" : pct >= 75 ? "#f8d28b" : "#ff8a8a";
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)_38px] items-center gap-3">
      <span className="text-xs text-white/42">{label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-right font-mono text-[11px] text-white/52">{pct}%</span>
    </div>
  );
}

function parseScores(detail?: string): { correctness: number; security: number; quality: number } | null {
  if (!detail) return null;
  const correctness = detail.match(/correctness:([\d.]+)/);
  const security = detail.match(/security:([\d.]+)/);
  const quality = detail.match(/quality:([\d.]+)/);
  if (!correctness || !security || !quality) return null;
  return {
    correctness: Number.parseFloat(correctness[1]),
    security: Number.parseFloat(security[1]),
    quality: Number.parseFloat(quality[1]),
  };
}

function MetricsTab({ events, hue }: { events: PlaygroundEvent[]; hue: string }) {
  const distribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events) counts.set(event.type, (counts.get(event.type) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 9);
  }, [events]);

  if (distribution.length === 0) return <EmptyPanel label="Metrics appear after the entity participates in events." />;

  const max = distribution[0]?.[1] ?? 1;

  return (
    <div className="space-y-5 p-5">
      <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
        <h4 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Event distribution</h4>
        <div className="space-y-3">
          {distribution.map(([type, count]) => (
            <div key={type} className="grid grid-cols-[110px_minmax(0,1fr)_28px] items-center gap-3">
              <span className="truncate font-mono text-[11px] text-white/42">{type}</span>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(count / max) * 100}%`, background: hue }} />
              </div>
              <span className="text-right font-mono text-[11px] text-white/42">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[260px] items-center justify-center px-8 text-center">
      <p className="max-w-xs text-sm leading-6 text-white/38">{label}</p>
    </div>
  );
}
