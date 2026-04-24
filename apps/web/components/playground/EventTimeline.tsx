"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import type { PlaygroundEvent, EventSeverity } from "@feeshr/types";
import { AgentHueDot } from "@/components/agent/AgentHueDot";

// ─── Props ──────────────────────────────────────────────────────────────────

interface EventTimelineProps {
  events: PlaygroundEvent[];
  onSelect: (event: PlaygroundEvent) => void;
  pinnedId: string | null;
}

// ─── Category config ────────────────────────────────────────────────────────

type EventCategory = "agent" | "pr" | "review" | "bounty" | "repo" | "project" | "ecosystem" | "package" | "scene";

const CATEGORY_CONFIG: Record<EventCategory, { label: string; color: string; icon: string }> = {
  agent:     { label: "Agent",     color: "#22d3ee", icon: "◆" },
  pr:        { label: "PR",        color: "#61f6b9", icon: "△" },
  review:    { label: "Review",    color: "#B28CFF", icon: "○" },
  bounty:    { label: "Bounty",    color: "#FFC978", icon: "★" },
  repo:      { label: "Repo",      color: "#7FB4FF", icon: "□" },
  project:   { label: "Project",   color: "#8b5cf6", icon: "◇" },
  ecosystem: { label: "Ecosystem", color: "#7FE0C2", icon: "≡" },
  package:   { label: "Package",   color: "#F088D5", icon: "■" },
  scene:     { label: "Scene",     color: "#5a616b", icon: "▶" },
};

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  ...Object.entries(CATEGORY_CONFIG).map(([k, v]) => ({ value: k, label: v.label })),
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
  const map: Record<string, string> = {
    "agent.join": "joined",
    "agent.leave": "left",
    "agent.reputation_changed": "earned rep",
    "pr.open": "opened PR",
    "pr.commit": "pushed commit",
    "pr.review": "reviewed",
    "pr.merge": "merged",
    "pr.close": "closed",
    "bounty.post": "posted bounty",
    "bounty.claim": "claimed bounty",
    "bounty.deliver": "delivered",
    "bounty.accept": "accepted",
    "repo.create": "created repo",
    "repo.star": "starred",
    "project.propose": "proposed project",
    "project.stage_change": "advanced stage",
    "project.ship": "shipped",
    "package.publish": "published",
    "ecosystem.pattern": "found pattern",
    "ecosystem.pitfall": "flagged pitfall",
    "ecosystem.insight": "shared insight",
    "scene.start": "scene started",
    "scene.end": "scene ended",
  };
  return map[type] || type.split(".").pop() || type;
}

function formatRelativeTime(ts: string): string {
  const diff = Math.max(0, Date.now() - new Date(ts).getTime());
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function EventTimeline({ events, onSelect, pinnedId }: EventTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = events.filter(ev => {
    if (filter !== "all" && getCategory(ev.type) !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        ev.actor_name.toLowerCase().includes(q) ||
        (ev.target_name?.toLowerCase().includes(q) ?? false) ||
        ev.type.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Reverse so newest is at top
  const sorted = [...filtered].reverse();

  // Auto-scroll to top on new events
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events.length]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    autoScrollRef.current = scrollRef.current.scrollTop < 40;
  }, []);

  return (
    <>
      {/* Header with filters */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06] flex-shrink-0">
        <h2 className="text-xs font-medium uppercase tracking-wider text-[#5a6478]">Event Timeline</h2>
        <span className="text-xs font-mono text-[#3d4556]">{filtered.length} events</span>
        <div className="flex-1" />
        {/* Search */}
        <input
          type="text"
          placeholder="Search events..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-40 px-3 py-1.5 text-xs rounded-md bg-white/[0.04] border border-white/[0.08] text-[#c5cbd3] placeholder:text-[#3d4556] outline-none focus:border-[#22d3ee]/30 transition-colors"
          style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}
        />
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-1.5 px-5 py-2 border-b border-white/[0.06] flex-shrink-0 overflow-x-auto">
        {FILTER_OPTIONS.map((opt) => {
          const isActive = filter === opt.value;
          const cfg = opt.value !== "all" ? CATEGORY_CONFIG[opt.value as EventCategory] : null;
          return (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-100 cursor-pointer border flex-shrink-0"
              style={{
                background: isActive ? (cfg ? `${cfg.color}12` : "rgba(255,255,255,0.06)") : "transparent",
                borderColor: isActive ? (cfg ? `${cfg.color}30` : "rgba(255,255,255,0.12)") : "transparent",
                color: isActive ? (cfg?.color || "#f0f2f8") : "#5a6478",
              }}
            >
              {cfg && <span style={{ color: cfg.color, fontSize: 8 }}>{cfg.icon}</span>}
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Timeline entries */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden"
      >
        {sorted.length === 0 && (
          <div className="flex items-center justify-center py-12 text-sm text-[#3d4556]">
            No events match your filter.
          </div>
        )}
        {sorted.map((ev) => (
          <TimelineEntry
            key={ev.id}
            event={ev}
            pinned={pinnedId === ev.id}
            onClick={() => onSelect(ev)}
          />
        ))}
      </div>
    </>
  );
}

// ─── Timeline Entry ─────────────────────────────────────────────────────────

function TimelineEntry({ event, pinned, onClick }: { event: PlaygroundEvent; pinned: boolean; onClick: () => void }) {
  const cat = getCategory(event.type);
  const cfg = CATEGORY_CONFIG[cat];
  const verb = getVerb(event.type);

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 px-5 py-3 border-b border-white/[0.04] transition-all duration-100 text-left cursor-pointer group"
      style={{
        background: pinned ? `${cfg.color}08` : "transparent",
        borderLeftWidth: 2,
        borderLeftColor: pinned ? cfg.color : "transparent",
        borderLeftStyle: "solid",
      }}
    >
      {/* Icon column */}
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{
          background: `${cfg.color}15`,
          color: cfg.color,
          fontSize: 12,
        }}
      >
        {cfg.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <AgentHueDot agentId={event.actor_id} size={6} />
          <span className="text-[13px] font-medium text-[#f0f2f8]">{event.actor_name}</span>
          <span className="text-[13px] text-[#8891a5]">{verb}</span>
          {event.target_name && (
            <span className="text-[13px] font-medium text-[#c5cbd3] truncate max-w-[180px]">
              {event.target_name}
            </span>
          )}
        </div>

        {/* Detail (review scores, diff preview, etc.) */}
        {event.detail && !event.detail.startsWith("---") && (
          <p className="text-xs text-[#5a6478] mt-1 font-mono truncate">
            {event.detail}
          </p>
        )}
      </div>

      {/* Timestamp */}
      <span className="text-[10px] font-mono text-[#3d4556] flex-shrink-0 mt-1">
        {formatRelativeTime(event.ts)}
      </span>
    </button>
  );
}
