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

const CATEGORY_CONFIG: Record<EventCategory, { label: string; color: string; bg: string; icon: string }> = {
  agent: { label: "Agent", color: "#7dd3fc", bg: "rgba(125,211,252,0.12)", icon: "●" },
  pr: { label: "Pull request", color: "#61f6b9", bg: "rgba(97,246,185,0.12)", icon: "↗" },
  review: { label: "Review", color: "#d8b4fe", bg: "rgba(216,180,254,0.13)", icon: "✓" },
  bounty: { label: "Bounty", color: "#f8d28b", bg: "rgba(248,210,139,0.13)", icon: "★" },
  repo: { label: "Repo", color: "#93c5fd", bg: "rgba(147,197,253,0.12)", icon: "□" },
  project: { label: "Project", color: "#c4b5fd", bg: "rgba(196,181,253,0.12)", icon: "◇" },
  ecosystem: { label: "Ecosystem", color: "#99f6e4", bg: "rgba(153,246,228,0.12)", icon: "≋" },
  package: { label: "Package", color: "#f0abfc", bg: "rgba(240,171,252,0.12)", icon: "⬡" },
  scene: { label: "Scene", color: "#cbd5e1", bg: "rgba(203,213,225,0.10)", icon: "▶" },
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
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
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
      <div className="shrink-0 border-b border-white/10 bg-black/10 px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30">⌕</span>
            <input
              value={timelineSearch}
              onChange={(event) => setTimelineSearch(event.target.value)}
              placeholder="Search actor, action or target"
              className="h-10 w-full rounded-2xl border border-white/10 bg-white/[0.055] pl-9 pr-3 text-sm text-white/80 outline-none transition focus:border-white/20 focus:bg-white/[0.08] placeholder:text-white/28"
            />
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:max-w-[560px]">
            {FILTERS.map((filter) => {
              const active = timelineFilter === filter.value;
              const cfg = filter.value === "all" ? null : CATEGORY_CONFIG[filter.value as EventCategory];
              return (
                <button
                  key={filter.value}
                  onClick={() => setTimelineFilter(filter.value)}
                  className="shrink-0 rounded-full border px-3 py-2 text-[11px] font-medium transition"
                  style={{
                    borderColor: active ? (cfg?.color ?? "rgba(255,255,255,0.28)") : "rgba(255,255,255,0.09)",
                    background: active ? (cfg?.bg ?? "rgba(255,255,255,0.08)") : "rgba(255,255,255,0.035)",
                    color: active ? (cfg?.color ?? "rgba(255,255,255,0.86)") : "rgba(255,255,255,0.46)",
                  }}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="absolute bottom-6 left-[35px] top-6 w-px bg-gradient-to-b from-white/10 via-white/10 to-transparent" />

        {filtered.length === 0 ? (
          <div className="flex h-full min-h-[180px] items-center justify-center text-center">
            <div>
              <div className="text-sm font-medium text-white/60">No matching events</div>
              <p className="mt-1 text-xs text-white/35">This surface is view-only; adjust filters to change what you watch.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
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
      className="group relative grid w-full grid-cols-[42px_minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-white/18 hover:bg-white/[0.065]"
      style={{
        borderColor: pinned ? `${cfg.color}66` : "rgba(255,255,255,0.08)",
        background: pinned ? `${cfg.bg}` : "rgba(255,255,255,0.035)",
        boxShadow: pinned ? `0 18px 48px ${cfg.color}18` : "none",
      }}
    >
      <div
        className="relative z-10 flex h-9 w-9 items-center justify-center rounded-2xl border text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"
        style={{ borderColor: `${cfg.color}44`, background: cfg.bg, color: cfg.color }}
      >
        {cfg.icon}
        {isFirst && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#61f6b9] shadow-[0_0_12px_rgba(97,246,185,0.7)]" />}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <AgentHueDot agentId={event.actor_id} size={7} glow={pinned} />
          <span className="font-semibold tracking-[-0.02em] text-white/90">{event.actor_name}</span>
          <span className="text-white/48">{getVerb(event.type)}</span>
          {event.target_name && (
            <span className="truncate font-semibold tracking-[-0.01em] text-white/72">{event.target_name}</span>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/34">
          <span style={{ color: cfg.color }}>{cfg.label}</span>
          <span>•</span>
          <span>{event.severity}</span>
          {event.detail && !event.detail.startsWith("---") && (
            <>
              <span>•</span>
              <span className="max-w-[460px] truncate font-mono">{event.detail}</span>
            </>
          )}
        </div>
      </div>

      <div className="pt-1 text-right font-mono text-[10px] text-white/32">
        <div>{relativeTime(event.ts)}</div>
        <div className="mt-1 text-white/22">
          {new Date(event.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
      </div>
    </button>
  );
}
