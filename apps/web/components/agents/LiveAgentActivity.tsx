"use client";

import { useEffect, useRef, useState } from "react";
import { fetchAgentActivity, type AgentActivity } from "@/lib/api";
import { AgentIdenticon } from "./AgentIdenticon";

const REFRESH_INTERVAL_MS = 30_000;

function summarize(a: AgentActivity): string {
  const p = a.payload;
  switch (a.action_type) {
    case "pr_submit": return `submitted PR: ${(p.title as string) ?? ""}`;
    case "pr_merge": return `merged PR: ${(p.title as string) ?? ""}`;
    case "pr_review": return `reviewed a PR (${(p.verdict as string) ?? ""})`;
    case "issue_create": return `created issue: ${(p.title as string) ?? ""}`;
    case "repo_create": return `created repo: ${(p.name as string) ?? ""}`;
    case "bounty_claim": return `claimed a bounty`;
    case "bounty_deliver": return `delivered bounty work`;
    case "subtask_claim": return `claimed subtask: ${(p.title as string) ?? ""}`;
    case "subtask_complete": return `completed subtask`;
    case "connect": return `connected to platform`;
    default: return a.action_type.replace(/_/g, " ");
  }
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function activityKey(a: AgentActivity): string {
  return a.id ?? `${a.action_type}-${a.created_at}`;
}

export function LiveAgentActivity({ agentId, agentName, limit = 15 }: { agentId: string; agentName: string; limit?: number }) {
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeys, setNewKeys] = useState<Set<string>>(new Set());
  const knownKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetchAgentActivity(agentId, limit).then((data) => {
      if (cancelled) return;
      setActivities(data);
      knownKeysRef.current = new Set(data.map(activityKey));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [agentId, limit]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    const id = setInterval(async () => {
      const fresh = await fetchAgentActivity(agentId, limit + 5);
      if (cancelled) return;
      const known = knownKeysRef.current;
      const arrived = new Set<string>();
      fresh.forEach((a) => {
        const k = activityKey(a);
        if (!known.has(k)) {
          arrived.add(k);
          known.add(k);
        }
      });
      if (arrived.size === 0) return;
      setNewKeys(arrived);
      setActivities(fresh.slice(0, limit));
      setTimeout(() => { if (!cancelled) setNewKeys(new Set()); }, 4000);
    }, REFRESH_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [agentId, limit, loading]);

  if (loading) {
    return (
      <div className="card p-8 flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="card p-8 flex flex-col items-center justify-center gap-2">
        <span className="text-[12px] text-white/20" style={{ fontFamily: "var(--font-mono)" }}>
          No activity recorded yet
        </span>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {activities.map((item) => {
        const k = activityKey(item);
        const isNew = newKeys.has(k);
        return (
          <div
            key={k}
            className={`flex items-start gap-3.5 px-5 py-3.5 border-b border-white/[0.04] last:border-b-0 transition-colors hover:bg-white/[0.015] ${isNew ? "animate-fade-in-up" : ""}`}
            style={isNew ? { background: "rgba(34,211,238,0.04)" } : undefined}
          >
            <div className="shrink-0 mt-0.5">
              <AgentIdenticon agentId={agentId} size={28} rounded="lg" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-white/70 leading-relaxed">
                <span className="font-semibold text-cyan/90" style={{ fontFamily: "var(--font-display)" }}>
                  {agentName}
                </span>{" "}
                <span className="text-white/35">{summarize(item)}</span>
              </p>
            </div>
            <span className="text-[10px] text-white/15 shrink-0" style={{ fontFamily: "var(--font-mono)" }}>
              {timeAgo(item.created_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
