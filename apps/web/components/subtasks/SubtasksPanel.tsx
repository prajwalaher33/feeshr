"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchSubtasks,
  type Subtask,
  type SubtaskStatus,
} from "@/lib/api";

interface SubtasksPanelProps {
  parentType: "bounty" | "issue" | "project";
  parentId: string;
  /** Override the default heading. Defaults to "Subtasks". */
  title?: string;
}

const STATUS_COLOR: Record<SubtaskStatus, string> = {
  blocked: "#6b7280",
  open: "#22d3ee",
  claimed: "#f7c948",
  in_progress: "#6366f1",
  review: "#8b5cf6",
  complete: "#28c840",
  cancelled: "#ff6b6b",
};

const EFFORT_BARS: Record<NonNullable<Subtask["estimated_effort"]>, number> = {
  trivial: 1,
  small: 2,
  medium: 3,
  large: 4,
};

export function SubtasksPanel({ parentType, parentId, title }: SubtasksPanelProps) {
  const [subtasks, setSubtasks] = useState<Subtask[] | null>(null);

  useEffect(() => {
    if (!parentId) return;
    let cancelled = false;
    fetchSubtasks({ parent_type: parentType, parent_id: parentId, limit: 50 }).then((d) => {
      if (cancelled) return;
      setSubtasks(d.subtasks);
    });
    return () => {
      cancelled = true;
    };
  }, [parentType, parentId]);

  if (subtasks === null) {
    return (
      <div
        className="card px-5 py-4 mb-4 text-[12px] text-white/30"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Loading subtasks…
      </div>
    );
  }

  if (subtasks.length === 0) {
    return null;
  }

  // Group by status for the summary chips.
  const counts: Partial<Record<SubtaskStatus, number>> = {};
  for (const s of subtasks) counts[s.status] = (counts[s.status] ?? 0) + 1;

  return (
    <div className="card p-4 mb-4">
      <div className="flex items-baseline gap-2 mb-3">
        <h2
          className="text-[12px] uppercase tracking-[0.1em] text-white/40"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {title ?? "Subtasks"}
        </h2>
        <span
          className="text-[10px] text-white/25"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {subtasks.length}
        </span>
        <Link
          href="/subtasks"
          className="ml-auto text-[10px] text-white/30 hover:text-cyan transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          all subtasks →
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {(Object.entries(counts) as [SubtaskStatus, number][]).map(([status, count]) => (
          <span
            key={status}
            className="status-chip text-[10px]"
            style={{
              color: STATUS_COLOR[status],
              background: `${STATUS_COLOR[status]}0a`,
              border: `1px solid ${STATUS_COLOR[status]}18`,
              fontFamily: "var(--font-mono)",
            }}
          >
            {status} · {count}
          </span>
        ))}
      </div>

      <ul className="flex flex-col gap-1.5">
        {subtasks.map((s) => {
          const color = STATUS_COLOR[s.status];
          const bars = s.estimated_effort ? EFFORT_BARS[s.estimated_effort] : 0;
          return (
            <li
              key={s.id}
              className="flex items-baseline gap-2 px-2 py-1 rounded hover:bg-white/[0.02] transition-colors"
            >
              <span
                className="shrink-0 w-1.5 h-1.5 rounded-full"
                style={{ background: color }}
              />
              <span
                className="text-[12px] text-white/80 truncate flex-1 min-w-0"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {s.title}
              </span>
              {bars > 0 && (
                <span
                  className="flex items-center gap-0.5 shrink-0"
                  title={`effort: ${s.estimated_effort}`}
                >
                  {[1, 2, 3, 4].map((n) => (
                    <span
                      key={n}
                      className="w-0.5 h-2 rounded-sm"
                      style={{
                        background:
                          n <= bars
                            ? "rgba(203,213,225,0.55)"
                            : "rgba(203,213,225,0.10)",
                      }}
                    />
                  ))}
                </span>
              )}
              {s.depends_on.length > 0 && (
                <span
                  className="shrink-0 text-[10px] text-white/30"
                  style={{ fontFamily: "var(--font-mono)" }}
                  title={s.depends_on.join(", ")}
                >
                  ⇠{s.depends_on.length}
                </span>
              )}
              {s.assigned_to ? (
                <Link
                  href={`/agents/${s.assigned_to}`}
                  className="shrink-0 text-[10px] text-white/40 hover:text-cyan transition-colors"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {s.assigned_to.slice(0, 12)}
                </Link>
              ) : (
                <span
                  className="shrink-0 text-[10px] text-white/20"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  unassigned
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
