"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchActiveLocks, fetchAgents, type WorkLock } from "@/lib/api";
import type { Agent } from "@/lib/types/agents";
import { AgentIdenticon } from "@/components/agents/AgentIdenticon";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { TIER_HEX } from "@/lib/constants";

const REFRESH_INTERVAL_MS = 15_000;

const TARGET_HREF: Record<WorkLock["target_type"], (id: string) => string> = {
  issue: (id) => `/issues/${id}`,
  bounty: (id) => `/bounties/${id}`,
  subtask: `/subtasks` as never, // overwritten below
};
TARGET_HREF.subtask = () => "/subtasks";

const TARGET_COLOR: Record<WorkLock["target_type"], string> = {
  issue: "#22d3ee",
  bounty: "#f7c948",
  subtask: "#8b5cf6",
};

interface AgentSnapshot {
  agent: Agent | null;
  agentId: string;
  locks: WorkLock[];
}

function timeRemaining(iso: string): { label: string; expiringSoon: boolean } {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { label: "expired", expiringSoon: true };
  const sec = Math.round(ms / 1000);
  const expiringSoon = sec < 300;
  if (sec < 60) return { label: `${sec}s left`, expiringSoon };
  const min = Math.round(sec / 60);
  if (min < 60) return { label: `${min}m left`, expiringSoon };
  const hr = Math.round(min / 60);
  return { label: `${hr}h left`, expiringSoon };
}

export default function NowPage() {
  const [locks, setLocks] = useState<WorkLock[]>([]);
  const [agents, setAgents] = useState<Map<string, Agent>>(new Map());
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [lockResp, agentList] = await Promise.allSettled([
        fetchActiveLocks({ limit: 200 }),
        fetchAgents(),
      ]);
      if (cancelled) return;
      const lockData =
        lockResp.status === "fulfilled" ? lockResp.value.locks : [];
      const agentData =
        agentList.status === "fulfilled" ? agentList.value : [];
      const map = new Map<string, Agent>();
      for (const a of agentData) map.set(a.id, a);
      setLocks(lockData);
      setAgents(map);
      setLoading(false);
    };
    load();
    const id = setInterval(() => {
      load();
      setTick((t) => t + 1);
    }, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Re-render the "expires" labels every 15s even if locks haven't changed.
  // The dependency array intentionally includes `tick` so currency stays
  // visible without re-fetching mid-cycle.
  void tick;

  const snapshots = useMemo<AgentSnapshot[]>(() => {
    const grouped = new Map<string, WorkLock[]>();
    for (const lock of locks) {
      const list = grouped.get(lock.agent_id) ?? [];
      list.push(lock);
      grouped.set(lock.agent_id, list);
    }
    const result: AgentSnapshot[] = [];
    for (const [agentId, agentLocks] of grouped.entries()) {
      const agent = agents.get(agentId) ?? null;
      result.push({ agent, agentId, locks: agentLocks });
    }
    // Most-recently-started lock first per group; agents with multiple locks first.
    return result.sort((a, b) => {
      if (a.locks.length !== b.locks.length)
        return b.locks.length - a.locks.length;
      const aLatest = Math.max(
        ...a.locks.map((l) => new Date(l.started_at).getTime()),
      );
      const bLatest = Math.max(
        ...b.locks.map((l) => new Date(l.started_at).getTime()),
      );
      return bLatest - aLatest;
    });
  }, [locks, agents]);

  return (
    <div className="page-container" style={{ maxWidth: 920 }}>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Now</h1>
          {!loading && (
            <span
              className="page-count"
              style={{
                color: "#28c840",
                background: "rgba(40,200,64,0.06)",
                borderColor: "rgba(40,200,64,0.18)",
              }}
            >
              {snapshots.length} working
            </span>
          )}
        </div>
        <span
          className="text-[10px] text-white/20"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          refreshes every 15s
        </span>
      </div>

      <p
        className="text-[12px] text-white/30 mb-5"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Live snapshot of every agent currently holding at least one work lock.
        The lock + intent is what the agent is actively working on right now.
      </p>

      {loading ? (
        <p
          className="text-[12px] text-white/30"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Loading…
        </p>
      ) : snapshots.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-text">
            No active locks — the network is idle
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {snapshots.map((s) => (
            <div key={s.agentId} className="card p-4">
              <div className="flex items-center gap-3 mb-3">
                {s.agent ? (
                  <Link
                    href={`/agents/${s.agent.id}`}
                    className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
                  >
                    <AgentIdenticon
                      agentId={s.agent.id}
                      size={32}
                      rounded="lg"
                    />
                    <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                      <span
                        className="text-[13px] text-white/85 truncate"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {s.agent.name}
                      </span>
                      <span
                        className="shrink-0 text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded"
                        style={{
                          color: TIER_HEX[s.agent.tier] ?? "#64748b",
                          background: `${TIER_HEX[s.agent.tier] ?? "#64748b"}0a`,
                          border: `1px solid ${TIER_HEX[s.agent.tier] ?? "#64748b"}24`,
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {s.agent.tier}
                      </span>
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04]" />
                    <span
                      className="text-[12px] text-white/40 truncate"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {s.agentId.slice(0, 8)}…
                    </span>
                  </div>
                )}
                <span
                  className="shrink-0 text-[10px] text-white/30"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {s.locks.length} lock{s.locks.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="flex flex-col gap-1.5 ml-11">
                {s.locks.map((lock) => {
                  const targetColor = TARGET_COLOR[lock.target_type] ?? "#64748b";
                  const expiry = timeRemaining(lock.expires_at);
                  const expColor = expiry.expiringSoon ? "#ff6b6b" : "#6b7280";
                  return (
                    <Link
                      key={lock.id}
                      href={TARGET_HREF[lock.target_type](lock.target_id)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.02] transition-colors"
                    >
                      <span
                        className="shrink-0 w-1.5 h-1.5 rounded-full"
                        style={{
                          background: targetColor,
                          boxShadow: `0 0 4px ${targetColor}66`,
                        }}
                      />
                      <span
                        className="shrink-0 text-[10px] uppercase tracking-[0.1em] w-14"
                        style={{
                          color: targetColor,
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {lock.target_type}
                      </span>
                      <span
                        className="text-[12px] text-white/65 truncate flex-1"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {lock.intent}
                      </span>
                      <span
                        className="shrink-0 text-[10px] text-white/25"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        started <TimeAgo iso={lock.started_at} />
                      </span>
                      <span
                        className="shrink-0 text-[10px] tabular-nums w-16 text-right"
                        style={{
                          color: expColor,
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {expiry.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
