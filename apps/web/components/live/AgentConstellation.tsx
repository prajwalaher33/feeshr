"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fetchAgents, fetchFeedEvents } from "@/lib/api";
import { TIER_HEX } from "@/lib/constants";
import { AgentIdenticon } from "@/components/agents/AgentIdenticon";
import type { Agent } from "@/lib/types/agents";
import type { FeedEvent } from "@/lib/types/events";

const REFRESH_MS = 15_000;
const FLASH_DURATION_MS = 4500;

interface AgentFlash {
  action: string;
  expiresAt: number;
}

function actorIdFor(e: FeedEvent): string | undefined {
  if ("agent_id" in e && typeof e.agent_id === "string") return e.agent_id;
  if ("reviewer_id" in e && typeof e.reviewer_id === "string") return e.reviewer_id;
  return undefined;
}

function actorNameFor(e: FeedEvent): string | undefined {
  if ("agent_name" in e && typeof e.agent_name === "string") return e.agent_name;
  if ("reviewer_name" in e && typeof e.reviewer_name === "string") return e.reviewer_name;
  if ("solver_name" in e && typeof e.solver_name === "string") return e.solver_name;
  if ("author_name" in e && typeof e.author_name === "string") return e.author_name;
  return undefined;
}

function shortAction(e: FeedEvent): string {
  switch (e.type) {
    case "pr_submitted": return "submitted PR";
    case "pr_merged": return "merged PR";
    case "pr_reviewed": return "reviewed PR";
    case "agent_connected": return "connected";
    case "repo_created": return "created repo";
    case "bounty_completed": return "won bounty";
    case "bounty_posted": return "posted bounty";
    case "package_published": return "shipped package";
    case "project_proposed": return "proposed project";
    case "security_finding": return "found vulnerability";
    case "reputation_milestone": return "leveled up";
    default: return e.type.replace(/_/g, " ");
  }
}

export function AgentConstellation() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [flashes, setFlashes] = useState<Map<string, AgentFlash>>(new Map());
  const [loading, setLoading] = useState(true);
  const lastEventKeysRef = useRef<Set<string>>(new Set());

  // Initial agent load + event polling
  useEffect(() => {
    let cancelled = false;

    fetchAgents().then((data) => {
      if (!cancelled) {
        setAgents([...data].sort((a, b) => b.reputation - a.reputation));
        setLoading(false);
      }
    });

    const tick = async () => {
      const events = await fetchFeedEvents(20);
      if (cancelled) return;
      const known = lastEventKeysRef.current;
      const fresh: { id: string; action: string }[] = [];
      events.forEach((e) => {
        const key = `${e.type}|${"timestamp" in e ? e.timestamp : ""}|${actorIdFor(e) ?? ""}`;
        if (!known.has(key)) {
          known.add(key);
          const aid = actorIdFor(e);
          if (aid) fresh.push({ id: aid, action: shortAction(e) });
        }
      });
      // First populate of known keys: don't flash for SSR-stable items
      if (known.size === events.length && fresh.length === events.length) return;
      if (fresh.length === 0) return;

      const now = Date.now();
      setFlashes((prev) => {
        const next = new Map(prev);
        fresh.forEach((f) => {
          next.set(f.id, { action: f.action, expiresAt: now + FLASH_DURATION_MS });
        });
        return next;
      });
    };

    // Seed known keys so we don't flash everything on first load
    fetchFeedEvents(20).then((events) => {
      if (cancelled) return;
      events.forEach((e) => {
        const key = `${e.type}|${"timestamp" in e ? e.timestamp : ""}|${actorIdFor(e) ?? ""}`;
        lastEventKeysRef.current.add(key);
      });
    });

    const interval = setInterval(tick, REFRESH_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Expire stale flashes
  useEffect(() => {
    if (flashes.size === 0) return;
    const id = setInterval(() => {
      const now = Date.now();
      setFlashes((prev) => {
        const next = new Map<string, AgentFlash>();
        prev.forEach((flash, agentId) => {
          if (flash.expiresAt > now) next.set(agentId, flash);
        });
        return next.size === prev.size ? prev : next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [flashes.size]);

  if (loading) {
    return (
      <div className="card p-6 flex items-center justify-center" style={{ minHeight: 320 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="card p-6 text-center" style={{ minHeight: 320 }}>
        <span className="text-[12px] text-white/30" style={{ fontFamily: "var(--font-mono)" }}>
          No agents connected yet
        </span>
      </div>
    );
  }

  return (
    <div className="card p-5 relative overflow-hidden" style={{ minHeight: 320 }}>
      {/* Ambient background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(34,211,238,0.04) 0%, transparent 70%)," +
            "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(139,92,246,0.025) 0%, transparent 70%)",
        }}
      />
      <div className="relative grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))" }}>
        {agents.map((agent) => {
          const flash = flashes.get(agent.id);
          const isActive = !!flash;
          const tierColor = TIER_HEX[agent.tier] ?? "#64748b";
          return (
            <Link
              key={agent.id}
              href={`/agents/${agent.id}`}
              className="group relative flex flex-col items-center gap-1.5 transition-transform duration-300 hover:scale-105"
            >
              <div className="relative">
                <div
                  className={`absolute inset-0 rounded-2xl transition-all duration-700 ${isActive ? "scale-[1.35] opacity-90" : "scale-100 opacity-30"}`}
                  style={{
                    background: `radial-gradient(circle, ${tierColor}55 0%, transparent 70%)`,
                    filter: "blur(8px)",
                    animation: isActive ? "constellation-pulse 1.6s ease-in-out infinite" : "constellation-breathe 4s ease-in-out infinite",
                  }}
                />
                <div className="relative">
                  <AgentIdenticon agentId={agent.id} size={48} rounded="xl" />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-[#0a0c10] transition-transform duration-300 ${isActive ? "scale-110" : ""}`}
                    style={{ background: tierColor, boxShadow: isActive ? `0 0 8px ${tierColor}` : undefined }}
                  />
                </div>
              </div>
              <span className="text-[10px] text-white/40 truncate max-w-[80px] text-center group-hover:text-white/70 transition-colors" style={{ fontFamily: "var(--font-mono)" }}>
                {agent.name}
              </span>

              {/* Flash tooltip with the action */}
              {flash && (
                <div
                  className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md text-[9px] uppercase tracking-[0.08em] whitespace-nowrap pointer-events-none"
                  style={{
                    background: `${tierColor}1a`,
                    border: `1px solid ${tierColor}40`,
                    color: tierColor,
                    fontFamily: "var(--font-mono)",
                    animation: "fade-in-up 0.3s ease-out",
                  }}
                >
                  {flash.action}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      <style jsx>{`
        @keyframes constellation-pulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        @keyframes constellation-breathe {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </div>
  );
}
