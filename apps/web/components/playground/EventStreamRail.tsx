"use client";

import React, { useRef, useEffect } from "react";
import type { PlaygroundEvent, EventSeverity } from "@feeshr/types";
import { AgentHueDot } from "@/components/agent/AgentHueDot";

interface EventStreamRailProps {
  events: PlaygroundEvent[];
  onSelect: (event: PlaygroundEvent) => void;
  pinnedId: string | null;
}

const SEVERITY_BORDER: Record<EventSeverity, string> = {
  ok: "var(--line)",
  info: "var(--info)",
  warn: "var(--warn)",
  err: "var(--err)",
};

const TYPE_GLYPH: Record<string, string> = {
  "agent.join": "\u25C6",      // diamond
  "agent.leave": "\u25C7",     // empty diamond
  "pr.open": "\u25B3",         // triangle up
  "pr.merge": "\u25B2",        // filled triangle
  "pr.review": "\u25CB",       // circle
  "pr.commit": "\u2022",       // bullet
  "repo.create": "\u25A1",     // square
  "bounty.post": "\u2606",     // star
  "bounty.claim": "\u2605",    // filled star
  "package.publish": "\u25A0", // filled square
  "project.propose": "\u25C8", // diamond in box
  "project.ship": "\u2713",    // check
  "ecosystem.pattern": "\u2261", // triple bar
  "scene.start": "\u25B6",    // play
  "scene.end": "\u25A0",      // stop
};

function getVerb(type: string): string {
  const parts = type.split(".");
  return parts[1] || type;
}

export function EventStreamRail({ events, onSelect, pinnedId }: EventStreamRailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  // Auto-scroll to newest (rightmost) when new events arrive
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [events.length]);

  // Detect if user scrolled away from right edge
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    autoScrollRef.current = scrollLeft + clientWidth >= scrollWidth - 40;
  };

  return (
    <div
      style={{
        height: 88,
        flexShrink: 0,
        borderTop: "1px solid var(--line)",
        background: "var(--bg-0)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Rail label */}
      <div style={{
        height: 24,
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 8,
        borderBottom: "1px solid var(--line)",
      }}>
        <span className="v7-micro-label" style={{ fontSize: 9 }}>Event Stream</span>
        <span className="v7-mono" style={{ fontSize: 9, color: "var(--ink-4)" }}>
          {events.length} events
        </span>
        <span style={{ flex: 1 }} />
        <span className="v7-mono" style={{ fontSize: 9, color: "var(--ink-4)" }}>
          newest &rarr;
        </span>
      </div>

      {/* Chip stream */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "0 12px",
          overflowX: "auto",
          overflowY: "hidden",
          scrollBehavior: "smooth",
        }}
      >
        {events.length === 0 && (
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--ink-4)", whiteSpace: "nowrap" }}>
            Waiting for events...
          </span>
        )}
        {events.map((ev) => (
          <EventChip
            key={ev.id}
            event={ev}
            pinned={pinnedId === ev.id}
            onClick={() => onSelect(ev)}
          />
        ))}
      </div>
    </div>
  );
}

function EventChip({ event, pinned, onClick }: { event: PlaygroundEvent; pinned: boolean; onClick: () => void }) {
  const borderColor = pinned ? "var(--phos-500)" : SEVERITY_BORDER[event.severity || "ok"];
  const glyph = TYPE_GLYPH[event.type] || "\u2022";

  return (
    <button
      onClick={onClick}
      className="v7-focus-ring"
      title={`${event.actor_name} ${getVerb(event.type)} ${event.target_name || ""} — ${event.sig?.slice(0, 16) || "unsigned"}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 32,
        padding: "0 10px",
        borderRadius: "var(--radius-sm)",
        border: `1px solid ${borderColor}`,
        background: pinned ? "color-mix(in srgb, var(--phos-500) 6%, var(--bg-1))" : "var(--bg-1)",
        cursor: "pointer",
        whiteSpace: "nowrap",
        flexShrink: 0,
        transition: "border-color var(--dur-xs) var(--ease-standard), background var(--dur-xs) var(--ease-standard)",
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        fontSize: "var(--fs-xs)",
      }}
    >
      {/* Agent hue dot */}
      <AgentHueDot agentId={event.actor_id} size={6} />

      {/* Type glyph */}
      <span style={{ fontSize: 10, color: "var(--ink-3)" }}>{glyph}</span>

      {/* Actor */}
      <span style={{ fontWeight: 500, color: "var(--ink-1)", maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis" }}>
        {event.actor_name}
      </span>

      {/* Verb */}
      <span style={{ color: "var(--ink-3)" }}>{getVerb(event.type)}</span>

      {/* Target */}
      {event.target_name && (
        <span style={{ fontWeight: 500, color: "var(--ink-1)", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis" }}>
          {event.target_name}
        </span>
      )}

      {/* Timestamp */}
      <span className="v7-mono" style={{ fontSize: 9, color: "var(--ink-4)", marginLeft: 2 }}>
        {formatRelativeTime(event.ts)}
      </span>

      {/* Sig prefix */}
      {event.sig && (
        <span className="v7-mono" style={{ fontSize: 8, color: "var(--ink-4)", opacity: 0.6 }}>
          {event.sig.slice(0, 8)}
        </span>
      )}
    </button>
  );
}

function formatRelativeTime(ts: string): string {
  const now = Date.now();
  const then = new Date(ts).getTime();
  if (isNaN(then)) return ts;
  const diff = Math.max(0, now - then);
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}
