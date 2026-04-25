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
  if (!ts) return "--";
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
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h3 className="text-[13px] font-semibold text-white/60">Inspector</h3>
        </div>
        <div className="flex flex-1 items-center justify-center px-10 text-center">
          <div>
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                <path d="M12 5V3M12 21V19M5 12H3M21 12H19" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M7.05 7.05L5.64 5.64M18.36 18.36L16.95 16.95M7.05 16.95L5.64 18.36M18.36 5.64L16.95 7.05" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-[14px] font-medium text-white/50">Select to inspect</p>
            <p className="mt-2 text-[13px] leading-5 text-white/25">
              Click an agent or event to view metrics and activity.
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
      {/* Entity header */}
      <div className="shrink-0 border-b border-white/[0.06] px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white/[0.05]">
              <AgentHueDot agentId={entity.id} size={16} glow />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-white/30">{entity.type}</div>
              <h3 className="truncate text-[17px] font-semibold tracking-[-0.03em] text-white">{entity.name}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/25 transition hover:bg-white/[0.06] hover:text-white/60"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M4 4L10 10M10 4L4 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Segmented control */}
        <div className="o-segmented mt-4 grid-cols-4">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`o-segmented-btn ${activeTab === tab ? "o-segmented-btn-active" : ""}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
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
    <div className="p-5">
      {/* Metric grid */}
      <div className="grid grid-cols-3 gap-2">
        <MetricCard label="Reputation" value={stats.reputation.toString()} color={hue} />
        <MetricCard label="PRs" value={stats.prsOpened.toString()} color="#30d158" />
        <MetricCard label="Merged" value={stats.prsMerged.toString()} color="#30d158" />
        <MetricCard label="Reviews" value={stats.reviews.toString()} color="#bf5af2" />
        <MetricCard label="Bounties" value={stats.bounties.toString()} color="#ff9f0a" />
        <MetricCard label="Events" value={events.length.toString()} color="#64d2ff" />
      </div>

      {/* Summary card */}
      <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
        <h4 className="mb-3 text-[11px] font-semibold text-white/25">Details</h4>
        <div className="space-y-2.5 text-[13px]">
          <DetailRow label="Type" value={entity.type} />
          <DetailRow label="Status" value={stats.status} />
          <DetailRow label="Last seen" value={timeLabel(stats.lastSeen)} />
          <DetailRow label="Total events" value={events.length.toString()} />
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/30">{label}</span>
      <span className="font-medium text-white/70">{value}</span>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3 py-3">
      <div className="text-[10px] font-medium text-white/25">{label}</div>
      <div className="mt-1.5 text-[20px] font-semibold tracking-[-0.04em]" style={{ color }}>{value}</div>
    </div>
  );
}

function ActivityTab({ events }: { events: PlaygroundEvent[] }) {
  const recent = [...events].reverse().slice(0, 28);
  if (recent.length === 0) return <EmptyPanel label="No activity observed yet." />;

  return (
    <div className="divide-y divide-white/[0.04]">
      {recent.map((event) => (
        <div key={event.id} className="flex items-start gap-3 px-5 py-3.5">
          <AgentHueDot agentId={event.actor_id} size={7} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px]">
              <span className="font-semibold text-white/80">{event.actor_name}</span>{" "}
              <span className="text-white/35">{verb(event.type)}</span>{" "}
              {event.target_name && <span className="font-medium text-white/55">{event.target_name}</span>}
            </div>
            {event.detail && !event.detail.startsWith("---") && (
              <div className="mt-1 truncate font-mono text-[11px] text-white/18">{event.detail}</div>
            )}
          </div>
          <span className="shrink-0 pt-0.5 font-mono text-[10px] text-white/18">{timeLabel(event.ts)}</span>
        </div>
      ))}
    </div>
  );
}

function ReviewsTab({ events }: { events: PlaygroundEvent[] }) {
  const reviews = [...events].filter((event) => event.type === "pr.review").reverse();
  if (reviews.length === 0) return <EmptyPanel label="No reviews attached yet." />;

  return (
    <div className="space-y-3 p-5">
      {reviews.map((event) => {
        const scores = parseScores(event.detail);
        return (
          <div key={event.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
            <div className="mb-4 flex items-center gap-2.5">
              <AgentHueDot agentId={event.actor_id} size={8} glow />
              <span className="text-[13px] font-semibold text-white/80">{event.actor_name}</span>
              <span className="text-[12px] text-white/25">reviewed</span>
            </div>
            {scores ? (
              <div className="space-y-3">
                <ScoreBar label="Correctness" value={scores.correctness} />
                <ScoreBar label="Security" value={scores.security} />
                <ScoreBar label="Quality" value={scores.quality} />
              </div>
            ) : (
              <p className="text-[13px] text-white/30">Scores not emitted.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 90 ? "#30d158" : pct >= 75 ? "#ff9f0a" : "#ff453a";
  return (
    <div className="grid grid-cols-[80px_minmax(0,1fr)_34px] items-center gap-3">
      <span className="text-[12px] text-white/35">{label}</span>
      <div className="h-[6px] overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-right font-mono text-[11px] text-white/45">{pct}%</span>
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
    <div className="p-5">
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
        <h4 className="mb-4 text-[11px] font-semibold text-white/25">Event distribution</h4>
        <div className="space-y-3">
          {distribution.map(([type, count]) => (
            <div key={type} className="grid grid-cols-[100px_minmax(0,1fr)_24px] items-center gap-3">
              <span className="truncate font-mono text-[11px] text-white/30">{type}</span>
              <div className="h-[6px] overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${(count / max) * 100}%`, background: hue }}
                />
              </div>
              <span className="text-right font-mono text-[11px] text-white/35">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center px-10 text-center">
      <p className="text-[13px] leading-5 text-white/25">{label}</p>
    </div>
  );
}
