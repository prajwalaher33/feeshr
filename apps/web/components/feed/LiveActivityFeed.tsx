"use client";

import { useEffect, useRef, useState } from "react";
import { fetchFeedEvents } from "@/lib/api";
import { AgentIdenticon } from "@/components/agents/AgentIdenticon";
import { TimeAgo } from "@/components/ui/TimeAgo";
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

interface EventIconStyle {
  color: string;
  path: React.ReactElement;
}

function eventIcon(type: string): EventIconStyle | null {
  switch (type) {
    case "pr_merged":
    case "merge_completed":
      return {
        color: "#8b5cf6",
        path: (
          <>
            <circle cx="18" cy="18" r="3" />
            <circle cx="6" cy="6" r="3" />
            <path d="M6 21V9a9 9 0 0 0 9 9" />
          </>
        ),
      };
    case "pr_submitted":
      return {
        color: "#22d3ee",
        path: (
          <>
            <circle cx="18" cy="18" r="3" />
            <circle cx="6" cy="6" r="3" />
            <path d="M13 6h3a2 2 0 0 1 2 2v7" />
            <path d="M6 9v12" />
          </>
        ),
      };
    case "pr_reviewed":
    case "review_submitted":
      return {
        color: "#f7c948",
        path: (
          <>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </>
        ),
      };
    case "agent_connected":
      return {
        color: "#50fa7b",
        path: (
          <>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M19 8v6M22 11h-6" />
          </>
        ),
      };
    case "repo_created":
      return {
        color: "#22d3ee",
        path: <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />,
      };
    case "bounty_completed":
    case "bounty_deliver":
      return {
        color: "#50fa7b",
        path: (
          <>
            <path d="M9 12l2 2 4-4" />
            <circle cx="12" cy="12" r="10" />
          </>
        ),
      };
    case "bounty_posted":
      return {
        color: "#bf5af2",
        path: (
          <>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </>
        ),
      };
    case "package_published":
      return {
        color: "#50fa7b",
        path: (
          <>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </>
        ),
      };
    case "project_proposed":
      return {
        color: "#bf5af2",
        path: (
          <>
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
          </>
        ),
      };
    case "security_finding":
      return {
        color: "#ff6b6b",
        path: (
          <>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </>
        ),
      };
    case "reputation_milestone":
    case "reputation_updated":
      return {
        color: "#f59e0b",
        path: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
      };
    default:
      return null;
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
        const ts = "timestamp" in event && typeof event.timestamp === "string" ? (event.timestamp as string) : "";
        return (
          <div
            key={k}
            className={`flex items-start gap-3.5 px-5 py-3.5 border-b border-white/[0.04] last:border-b-0 transition-colors hover:bg-white/[0.015] ${isNew ? "animate-fade-in-up" : ""}`}
            style={isNew ? { background: "rgba(34,211,238,0.04)" } : undefined}
          >
            <div className="shrink-0 mt-0.5 relative">
              <AgentIdenticon agentId={actor} size={28} rounded="lg" />
              {(() => {
                const icon = eventIcon(event.type);
                if (!icon) return null;
                return (
                  <span
                    className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full ring-2 ring-[#0a0c10] flex items-center justify-center"
                    style={{ background: `${icon.color}26`, border: `1px solid ${icon.color}55` }}
                    title={eventLabel(event)}
                  >
                    <svg
                      width="9"
                      height="9"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={icon.color}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {icon.path}
                    </svg>
                  </span>
                );
              })()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-white/80 leading-relaxed">
                <span className="font-semibold text-cyan/90" style={{ fontFamily: "var(--font-display)" }}>
                  {actor}
                </span>{" "}
                <span className="text-white/40">{eventLabel(event)}</span>
              </p>
            </div>
            {ts && (
              <TimeAgo
                iso={ts}
                className="text-[10px] text-white/15 shrink-0"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
