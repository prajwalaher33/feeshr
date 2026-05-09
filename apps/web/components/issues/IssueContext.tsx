"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchActiveLocks,
  fetchSubtasks,
  type WorkLock,
  type Subtask,
  type SubtaskStatus,
} from "@/lib/api";

interface IssueContextProps {
  issueId: string;
  resolvedByPr?: string | null;
}

const SUBTASK_COLOR: Record<SubtaskStatus, string> = {
  blocked: "#6b7280",
  open: "#22d3ee",
  claimed: "#f7c948",
  in_progress: "#6366f1",
  review: "#8b5cf6",
  complete: "#28c840",
  cancelled: "#ff6b6b",
};

function expiryLabel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return "expired";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m left`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h left`;
  return `${Math.round(hours / 24)}d left`;
}

export function IssueContext({ issueId, resolvedByPr }: IssueContextProps) {
  const [lock, setLock] = useState<WorkLock | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!issueId) return;
    let cancelled = false;
    Promise.allSettled([
      fetchActiveLocks({ target_type: "issue", limit: 200 }),
      fetchSubtasks({ parent_type: "issue", parent_id: issueId, limit: 100 }),
    ]).then(([locksRes, subRes]) => {
      if (cancelled) return;
      if (locksRes.status === "fulfilled") {
        setLock(locksRes.value.locks.find((l) => l.target_id === issueId) ?? null);
      }
      if (subRes.status === "fulfilled") {
        setSubtasks(subRes.value.subtasks);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [issueId]);

  if (loading) {
    return (
      <div className="card px-5 py-4 mb-4 text-[12px] text-white/30" style={{ fontFamily: "var(--font-mono)" }}>
        Loading network activity…
      </div>
    );
  }

  const hasContext = lock != null || subtasks.length > 0 || resolvedByPr;
  if (!hasContext) {
    return (
      <div className="card px-5 py-4 mb-4 text-[12px] text-white/30" style={{ fontFamily: "var(--font-mono)" }}>
        No agents working on this yet
      </div>
    );
  }

  // Group subtasks by status for the summary line.
  const counts: Partial<Record<SubtaskStatus, number>> = {};
  for (const s of subtasks) counts[s.status] = (counts[s.status] ?? 0) + 1;

  return (
    <div className="card p-4 mb-4 flex flex-col gap-3">
      <div
        className="text-[10px] uppercase tracking-[0.12em] text-white/40"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Network activity
      </div>

      {lock && (
        <div className="flex items-start gap-3">
          <span
            className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full"
            style={{ background: "#22d3ee", boxShadow: "0 0 4px rgba(34,211,238,0.5)" }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap" style={{ fontFamily: "var(--font-mono)" }}>
              <Link
                href={`/agents/${lock.agent_id}`}
                className="text-[12px] text-white/85 hover:text-cyan transition-colors"
              >
                {lock.agent_id.slice(0, 12)}
              </Link>
              <span className="text-[11px] text-white/45">claimed this</span>
              <Link
                href="/locks"
                className="text-[10px] text-white/30 hover:text-cyan transition-colors ml-auto"
              >
                {expiryLabel(lock.expires_at)} →
              </Link>
            </div>
            <p
              className="text-[12px] text-white/55 mt-0.5 leading-relaxed"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {lock.intent}
            </p>
          </div>
        </div>
      )}

      {subtasks.length > 0 && (
        <div className="flex items-start gap-3">
          <span
            className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full"
            style={{ background: "#f7c948", boxShadow: "0 0 4px rgba(247,201,72,0.5)" }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap text-[11px]" style={{ fontFamily: "var(--font-mono)" }}>
              <span className="text-white/70">
                {subtasks.length} subtask{subtasks.length !== 1 ? "s" : ""}
              </span>
              <Link
                href="/subtasks"
                className="text-white/30 hover:text-cyan transition-colors ml-auto"
              >
                view all →
              </Link>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(Object.entries(counts) as [SubtaskStatus, number][]).map(([status, count]) => (
                <span
                  key={status}
                  className="status-chip text-[10px]"
                  style={{
                    color: SUBTASK_COLOR[status],
                    background: `${SUBTASK_COLOR[status]}0a`,
                    border: `1px solid ${SUBTASK_COLOR[status]}18`,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {status} · {count}
                </span>
              ))}
            </div>
            <ul
              className="mt-2 flex flex-col gap-1 text-[11px] text-white/50"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {subtasks.slice(0, 3).map((s) => (
                <li key={s.id} className="flex items-baseline gap-2 truncate">
                  <span
                    className="shrink-0 w-1 h-1 rounded-full"
                    style={{ background: SUBTASK_COLOR[s.status] }}
                  />
                  <span className="truncate">{s.title}</span>
                  {s.assigned_to && (
                    <span className="text-white/25 shrink-0 ml-auto">
                      {s.assigned_to.slice(0, 12)}
                    </span>
                  )}
                </li>
              ))}
              {subtasks.length > 3 && (
                <li className="text-white/20 text-[10px]">
                  +{subtasks.length - 3} more
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {resolvedByPr && (
        <div className="flex items-start gap-3">
          <span
            className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full"
            style={{ background: "#28c840", boxShadow: "0 0 4px rgba(40,200,64,0.5)" }}
          />
          <div className="flex-1 min-w-0 flex items-baseline gap-2" style={{ fontFamily: "var(--font-mono)" }}>
            <Link
              href={`/prs/${resolvedByPr}`}
              className="text-[12px] text-[#28c840] hover:underline"
            >
              Resolved by PR {resolvedByPr.slice(0, 8)}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

