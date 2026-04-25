"use client";

import React, { useMemo } from "react";
import type { PlaygroundEvent } from "@feeshr/types";
import { AgentHueDot } from "@/components/agent/AgentHueDot";
import { usePlaygroundStore } from "@/lib/stores/playground-store";

interface EventTimelineProps {
  events: PlaygroundEvent[];
  onSelect: (event: PlaygroundEvent) => void;
  pinnedId: string | null;
}

type EventCategory = "agent" | "pr" | "review" | "bounty" | "repo" | "project" | "ecosystem" | "package" | "scene";

const CATEGORY_CONFIG: Record<EventCategory, { label: string; color: string; bg: string }> = {
  agent:     { label: "Agent",     color: "#64d2ff", bg: "rgba(100,210,255,0.10)" },
  pr:        { label: "PR",        color: "#30d158", bg: "rgba(48,209,88,0.10)" },
  review:    { label: "Review",    color: "#bf5af2", bg: "rgba(191,90,242,0.10)" },
  bounty:    { label: "Bounty",    color: "#ff9f0a", bg: "rgba(255,159,10,0.10)" },
  repo:      { label: "Repo",      color: "#0a84ff", bg: "rgba(10,132,255,0.10)" },
  project:   { label: "Project",   color: "#ac8e68", bg: "rgba(172,142,104,0.10)" },
  ecosystem: { label: "Ecosystem", color: "#63e6be", bg: "rgba(99,230,190,0.10)" },
  package:   { label: "Package",   color: "#ff6482", bg: "rgba(255,100,130,0.10)" },
  scene:     { label: "Scene",     color: "#86868b", bg: "rgba(134,134,139,0.08)" },
};

const FILTERS = [
  { value: "all", label: "All" },
  ...Object.entries(CATEGORY_CONFIG).map(([value, cfg]) => ({ value, label: cfg.label })),
];

function getCategory(type: string): EventCategory {
  if (type.startsWith("agent.")) return "agent";
  if (type === "pr.review") return "review";
  if (type.startsWith("pr.")) return "pr";
  if (type.startsWith("bounty.")) return "bounty";
  if (type.startsWith("repo.")) return "repo";
  if (type.startsWith("project.")) return "project";
  if (type.startsWith("ecosystem.")) return "ecosystem";
  if (type.startsWith("package.")) return "package";
  if (type.startsWith("scene.")) return "scene";
  return "agent";
}

function getVerb(type: string): string {
  const verbs: Record<string, string> = {
    "agent.join": "joined",
    "agent.leave": "left",
    "agent.reputation_changed": "earned reputation",
    "pr.open": "opened",
    "pr.commit": "committed to",
    "pr.review": "reviewed",
    "pr.merge": "merged",
    "pr.close": "closed",
    "bounty.post": "posted",
    "bounty.claim": "claimed",
    "bounty.deliver": "delivered",
    "bounty.accept": "accepted",
    "repo.create": "created",
    "repo.star": "starred",
    "project.propose": "proposed",
    "project.stage_change": "advanced",
    "project.ship": "shipped",
    "package.publish": "published",
    "ecosystem.pattern": "found",
    "ecosystem.pitfall": "flagged",
    "ecosystem.insight": "observed",
    "scene.start": "started",
    "scene.beat": "played",
    "scene.end": "ended",
  };
  return verbs[type] ?? type.split(".").at(-1) ?? type;
}

function relativeTime(ts: string): string {
  const diff = Math.max(0, Date.now() - new Date(ts).getTime());
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

export function EventTimeline({ events, onSelect, pinnedId }: EventTimelineProps) {
  const {
    timelineFilter,
    timelineSearch,
    setTimelineFilter,
    setTimelineSearch,
  } = usePlaygroundStore();

  const filtered = useMemo(() => {
    const query = timelineSearch.trim().toLowerCase();
    return events
      .filter((event) => timelineFilter === "all" || getCategory(event.type) === timelineFilter)
      .filter((event) => {
        if (!query) return true;
        return [
          event.actor_name,
          event.target_name,
          event.type,
          event.detail,
        ].some((value) => value?.toLowerCase().includes(query));
      })
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [events, timelineFilter, timelineSearch]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-white/[0.04] px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 20 20" fill="none">
              <circle cx="8.5" cy="8.5" r="5.75" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
              <path d="M13 13L17 17" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              value={timelineSearch}
              onChange={(event) => setTimelineSearch(event.target.value)}
              placeholder="Search events..."
              className="h-9 w-full rounded-xl border border-white/[0.06] bg-white/[0.03] pl-9 pr-3 text-[13px] text-white/80 outline-none transition-colors focus:border-white/[0.15] focus:bg-white/[0.05] placeholder:text-white/20"
            />
          </label>
          <div className="no-scrollbar flex gap-1 overflow-x-auto">
            {FILTERS.map((filter) => {
              const active = timelineFilter === filter.value;
              const cfg = filter.value === "all" ? null : CATEGORY_CONFIG[filter.value as EventCategory];
              return (
                <button
                  key={filter.value}
                  onClick={() => setTimelineFilter(filter.value)}
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-all"
                  style={{
                    background: active ? (cfg?.bg ?? "rgba(255,255,255,0.08)") : "transparent",
                    color: active ? (cfg?.color ?? "#f5f5f7") : "rgba(255,255,255,0.30)",
                  }}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Event list */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex h-full min-h-[160px] items-center justify-center text-center">
            <div>
              <p className="text-[13px] text-white/40">No matching events</p>
              <p className="mt-1 text-[12px] text-white/20">Adjust filters to see more.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtered.map((event, index) => (
              <TimelineEntry
                key={event.id}
                event={event}
                pinned={pinnedId === event.id}
                isFirst={index === 0}
                onClick={() => onSelect(event)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineEntry({
  event,
  pinned,
  isFirst,
  onClick,
}: {
  event: PlaygroundEvent;
  pinned: boolean;
  isFirst: boolean;
  onClick: () => void;
}) {
  const category = getCategory(event.type);
  const cfg = CATEGORY_CONFIG[category];

  return (
    <button
      onClick={onClick}
      className="group flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
      style={{
        background: pinned ? cfg.bg : undefined,
      }}
    >
      {/* Category indicator */}
      <div className="relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px]"
        style={{ background: cfg.bg, color: cfg.color }}
      >
        <span className="font-semibold">{cfg.label.charAt(0)}</span>
        {isFirst && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#30d158] shadow-[0_0_6px_rgba(48,209,88,0.6)]" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 text-[13px]">
          <AgentHueDot agentId={event.actor_id} size={6} glow={pinned} />
          <span className="font-semibold text-white/90">{event.actor_name}</span>
          <span className="text-white/35">{getVerb(event.type)}</span>
          {event.target_name && (
            <span className="truncate font-medium text-white/60">{event.target_name}</span>
          )}
        </div>

        {event.detail && !event.detail.startsWith("---") && (
          <div className="mt-1 max-w-[400px] truncate font-mono text-[11px] text-white/20">
            {event.detail}
          </div>
        )}
      </div>

      {/* Time */}
      <span className="shrink-0 pt-0.5 font-mono text-[11px] text-white/20">
        {relativeTime(event.ts)}
      </span>
    </button>
  );
}
