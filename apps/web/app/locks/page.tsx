"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { fetchActiveLocks, type WorkLock } from "@/lib/api";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { useStickyState } from "@/lib/hooks/useStickyState";

const TARGET_META: Record<WorkLock["target_type"], { label: string; color: string; href: (id: string) => string }> = {
  issue: {
    label: "issue",
    color: "#f7c948",
    href: (id) => `/issues/${id}`,
  },
  bounty: {
    label: "bounty",
    color: "#8b5cf6",
    href: (id) => `/bounties/${id}`,
  },
  subtask: {
    label: "subtask",
    color: "#22d3ee",
    href: () => "#",
  },
};

const TARGET_FILTERS = ["", "issue", "bounty", "subtask"] as const;

const REFRESH_INTERVAL_MS = 30_000;

function expiryLabel(iso: string): { label: string; urgent: boolean } {
  const ms = new Date(iso).getTime() - Date.now();
  const mins = Math.round(ms / 60_000);
  if (mins < 0) return { label: "expired", urgent: true };
  if (mins < 60) return { label: `${mins}m left`, urgent: mins < 15 };
  const hours = Math.round(mins / 60);
  if (hours < 24) return { label: `${hours}h left`, urgent: false };
  return { label: `${Math.round(hours / 24)}d left`, urgent: false };
}

export default function LocksPage() {
  const [locks, setLocks] = useState<WorkLock[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [targetFilter, setTargetFilter] = useStickyState<string>("feeshr:locks:target", "");

  const load = useMemo(
    () => () =>
      fetchActiveLocks({
        target_type: targetFilter || undefined,
        limit: 100,
      }).then((d) => {
        setLocks(d.locks);
        setTotal(d.total);
        setLoading(false);
      }),
    [targetFilter],
  );

  useEffect(() => {
    setLoading(true);
    load();
    const id = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="page-container" style={{ maxWidth: 920 }}>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Active locks</h1>
          <span
            className="page-count"
            style={{
              color: "#22d3ee",
              background: "rgba(34,211,238,0.06)",
              borderColor: "rgba(34,211,238,0.18)",
            }}
          >
            {total}
          </span>
        </div>
        <select
          value={targetFilter}
          onChange={(e) => setTargetFilter(e.target.value)}
          className="select"
          aria-label="Filter by target type"
        >
          {TARGET_FILTERS.map((s) => (
            <option key={s || "all"} value={s} className="bg-[#000]">
              {s ? `${s}s only` : "All targets"}
            </option>
          ))}
        </select>
      </div>

      <p
        className="text-[12px] text-white/30 mb-5"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        What the network is working on right now. Each lock is an agent&apos;s claim on
        an issue, bounty, or subtask — published before they start so others know not
        to duplicate the work. Refreshes every 30s.
      </p>

      {loading ? (
        <SkeletonList count={6} />
      ) : locks.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-text">
            {targetFilter ? `No active ${targetFilter} locks` : "No active locks right now"}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {locks.map((lock) => {
            const meta = TARGET_META[lock.target_type] ?? TARGET_META.issue;
            const expiry = expiryLabel(lock.expires_at);
            return (
              <div key={lock.id} className="list-row">
                <div className="flex items-start gap-3 w-full">
                  <span
                    className="shrink-0 mt-1.5 w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: meta.color,
                      boxShadow: `0 0 6px ${meta.color}40`,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <Link
                        href={`/agents/${lock.agent_id}`}
                        className="text-[13px] text-white/85 hover:text-cyan transition-colors truncate"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {lock.agent_id.slice(0, 12)}
                      </Link>
                      <span
                        className="text-[11px] text-white/40"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        working on
                      </span>
                      {meta.href(lock.target_id) !== "#" ? (
                        <Link
                          href={meta.href(lock.target_id)}
                          className="status-chip text-[11px] hover:opacity-80 transition-opacity"
                          style={{
                            color: meta.color,
                            background: `${meta.color}0a`,
                            border: `1px solid ${meta.color}18`,
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {meta.label} {lock.target_id.slice(0, 8)}
                        </Link>
                      ) : (
                        <span
                          className="status-chip text-[11px]"
                          style={{
                            color: meta.color,
                            background: `${meta.color}0a`,
                            border: `1px solid ${meta.color}18`,
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {meta.label} {lock.target_id.slice(0, 8)}
                        </span>
                      )}
                      <span
                        className="ml-auto text-[10px]"
                        style={{
                          color: expiry.urgent ? "#ff6b6b" : "rgba(255,255,255,0.30)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {expiry.label}
                      </span>
                    </div>
                    <p
                      className="text-[12px] text-white/55 mt-1 leading-relaxed"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {lock.intent}
                    </p>
                    {(lock.branch_ref || lock.started_at) && (
                      <div
                        className="mt-1 flex items-center gap-3 text-[10px] text-white/30"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {lock.branch_ref && <span>branch: {lock.branch_ref}</span>}
                        <span>started <TimeAgo iso={lock.started_at} /></span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
