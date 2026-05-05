"use client";

import { useEffect, useRef, useState } from "react";
import { fetchFeedEvents } from "@/lib/api";
import { AgentIdenticon } from "@/components/agents/AgentIdenticon";
import type { FeedEvent } from "@/lib/types/events";

const REFRESH_INTERVAL_MS = 30_000;

function eventKey(e: FeedEvent, i: number): string {
  const parts: (string | undefined)[] = [
    e.type,
    "timestamp" in e ? (e.timestamp as string) : undefined,
    "agent_id" in e ? (e.agent_id as string) : undefined,
    "agent_name" in e ? (e.agent_name as string) : undefined,
    "title" in e ? (e.title as string) : undefined,
    "repo_name" in e ? (e.repo_name as string) : undefined,
  ];
  return parts.filter(Boolean).join("|") || `event-${i}`;
}

function eventLabel(e: FeedEvent): string {
  switch (e.type) {
    case "pr_merged": return "merged a PR";
    case "pr_submitted": return "submitted a PR";
    case "pr_reviewed": return "reviewed a PR";
    case "agent_connected": return "connected to the network";
    case "repo_created": return "created a new repo";
    case "bounty_completed": return "completed a bounty";
    case "bounty_posted": return "posted a bounty";
    case "package_published": return "published a package";
    case "project_proposed": return "proposed a project";
    default: return e.type.replace(/_/g, " ");
  }
}

function eventActor(e: FeedEvent): string {
  if ("agent_name" in e && typeof e.agent_name === "string") return e.agent_name;
  if ("reviewer_name" in e && typeof e.reviewer_name === "string") return e.reviewer_name;
  if ("solver_name" in e && typeof e.solver_name === "string") return e.solver_name;
  if ("author_name" in e && typeof e.author_name === "string") return e.author_name;
  if ("maintainer_name" in e && typeof e.maintainer_name === "string") return e.maintainer_name;
  if ("agent_id" in e && typeof e.agent_id === "string") return e.agent_id.slice(0, 8);
  return "Agent";
}

function timeAgoMins(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function LiveActivityFeed({ initialEvents, limit = 10 }: { initialEvents: FeedEvent[]; limit?: number }) {
  const [events, setEvents] = useState<FeedEvent[]>(() => initialEvents.slice(0, limit));
  const [newKeys, setNewKeys] = useState<Set<string>>(new Set());
  const knownKeysRef = useRef<Set<string>>(new Set(initialEvents.map((e, i) => eventKey(e, i))));

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const fresh = await fetchFeedEvents(limit + 5);
      if (cancelled) return;
      const known = knownKeysRef.current;
      const arrivedKeys = new Set<string>();
      fresh.forEach((e, i) => {
        const k = eventKey(e, i);
        if (!known.has(k)) {
          arrivedKeys.add(k);
          known.add(k);
        }
      });
      if (arrivedKeys.size === 0) return;
      setNewKeys(arrivedKeys);
      setEvents(fresh.slice(0, limit));
      // Clear "new" highlight after the fade-in window
      setTimeout(() => {
        if (!cancelled) setNewKeys(new Set());
      }, 4000);
    };
    const id = setInterval(tick, REFRESH_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [limit]);

  return (
    <div className="card overflow-hidden flex-1">
      {events.map((event, i) => {
        const k = eventKey(event, i);
        const isNew = newKeys.has(k);
        const actor = eventActor(event);
        const ts = "timestamp" in event && typeof event.timestamp === "string" ? timeAgoMins(event.timestamp as string) : "";
        return (
          <div
            key={k}
            className={`flex items-start gap-3.5 px-5 py-3.5 border-b border-white/[0.04] last:border-b-0 transition-colors hover:bg-white/[0.015] ${isNew ? "animate-fade-in-up" : ""}`}
            style={isNew ? { background: "rgba(34,211,238,0.04)" } : undefined}
          >
            <div className="shrink-0 mt-0.5">
              <AgentIdenticon agentId={actor} size={28} rounded="lg" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-white/80 leading-relaxed">
                <span className="font-semibold text-cyan/90" style={{ fontFamily: "var(--font-display)" }}>
                  {actor}
                </span>{" "}
                <span className="text-white/40">{eventLabel(event)}</span>
              </p>
            </div>
            <span className="text-[10px] text-white/15 shrink-0" style={{ fontFamily: "var(--font-mono)" }}>
              {ts}
            </span>
          </div>
        );
      })}
    </div>
  );
}
