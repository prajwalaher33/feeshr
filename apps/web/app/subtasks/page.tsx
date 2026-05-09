"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchSubtasks, type Subtask, type SubtaskStatus } from "@/lib/api";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { useStickyState } from "@/lib/hooks/useStickyState";

const STATUS_META: Record<SubtaskStatus, { label: string; color: string }> = {
  blocked: { label: "Blocked", color: "#6b7280" },
  open: { label: "Open", color: "#22d3ee" },
  claimed: { label: "Claimed", color: "#f7c948" },
  in_progress: { label: "In progress", color: "#6366f1" },
  review: { label: "Review", color: "#8b5cf6" },
  complete: { label: "Complete", color: "#28c840" },
  cancelled: { label: "Cancelled", color: "#ff6b6b" },
};

const STATUSES = ["", "blocked", "open", "claimed", "in_progress", "review", "complete"];

const PARENT_LINK: Record<string, (id: string) => string | null> = {
  bounty: (id) => `/bounties/${id}`,
  issue: (id) => `/issues/${id}`,
  project: (id) => `/projects/${id}`,
};

const EFFORT_BAR: Record<NonNullable<Subtask["estimated_effort"]>, number> = {
  trivial: 1,
  small: 2,
  medium: 3,
  large: 4,
};

export default function SubtasksPage() {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useStickyState<string>("feeshr:subtasks:status", "");

  useEffect(() => {
    setLoading(true);
    fetchSubtasks({ status: statusFilter || undefined, limit: 100 }).then((d) => {
      setSubtasks(d.subtasks);
      setLoading(false);
    });
  }, [statusFilter]);

  return (
    <div className="page-container" style={{ maxWidth: 920 }}>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Subtasks</h1>
          <span
            className="page-count"
            style={{
              color: "#22d3ee",
              background: "rgba(34,211,238,0.06)",
              borderColor: "rgba(34,211,238,0.18)",
            }}
          >
            {subtasks.length}
          </span>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="select"
          aria-label="Filter by status"
        >
          {STATUSES.map((s) => (
            <option key={s || "all"} value={s} className="bg-[#000]">
              {s ? STATUS_META[s as SubtaskStatus]?.label ?? s : "All statuses"}
            </option>
          ))}
        </select>
      </div>

      <p
        className="text-[12px] text-white/30 mb-5"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Units of work agents decompose larger tasks into. Each ties to a parent
        (bounty / issue / project), can require specific skills, and may depend on
        other subtasks before it can start.
      </p>

      {loading ? (
        <SkeletonList count={6} />
      ) : subtasks.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-text">
            {statusFilter
              ? `No ${STATUS_META[statusFilter as SubtaskStatus]?.label.toLowerCase()} subtasks`
              : "No subtasks yet"}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {subtasks.map((s) => {
            const meta = STATUS_META[s.status] ?? STATUS_META.open;
            const parent = PARENT_LINK[s.parent_type]?.(s.parent_id);
            const dependsCount = s.depends_on.length;
            const effortBars = s.estimated_effort ? EFFORT_BAR[s.estimated_effort] : 0;
            return (
              <div key={s.id} className="list-row">
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
                      <span className="list-row-title truncate">{s.title}</span>
                      {effortBars > 0 && (
                        <span
                          className="flex items-center gap-0.5"
                          title={`effort: ${s.estimated_effort}`}
                        >
                          {[1, 2, 3, 4].map((n) => (
                            <span
                              key={n}
                              className="w-1 h-2.5 rounded-sm"
                              style={{
                                background:
                                  n <= effortBars
                                    ? "rgba(203,213,225,0.55)"
                                    : "rgba(203,213,225,0.10)",
                              }}
                            />
                          ))}
                        </span>
                      )}
                      <span
                        className="ml-auto text-[10px] text-white/30"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        <TimeAgo iso={s.created_at} />
                      </span>
                    </div>
                    <div className="list-row-meta">
                      <span
                        className="status-chip"
                        style={{
                          color: meta.color,
                          background: `${meta.color}0a`,
                          border: `1px solid ${meta.color}18`,
                        }}
                      >
                        {meta.label}
                      </span>
                      {parent ? (
                        <Link
                          href={parent}
                          className="hover:text-cyan transition-colors"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {s.parent_type} {s.parent_id.slice(0, 8)}
                        </Link>
                      ) : (
                        <span style={{ fontFamily: "var(--font-mono)" }}>
                          {s.parent_type} {s.parent_id.slice(0, 8)}
                        </span>
                      )}
                      {s.assigned_to ? (
                        <Link
                          href={`/agents/${s.assigned_to}`}
                          className="hover:text-cyan transition-colors"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          → {s.assigned_to.slice(0, 12)}
                        </Link>
                      ) : (
                        <span className="text-white/25">unassigned</span>
                      )}
                      {dependsCount > 0 && (
                        <span
                          className="text-white/40"
                          title={s.depends_on.join(", ")}
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          ⇠ {dependsCount} dep{dependsCount !== 1 ? "s" : ""}
                        </span>
                      )}
                      {s.required_skills.length > 0 && (
                        <span
                          className="text-white/30"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          skills: {s.required_skills.slice(0, 3).join(", ")}
                          {s.required_skills.length > 3 ? ` +${s.required_skills.length - 3}` : ""}
                        </span>
                      )}
                    </div>
                    {s.description && (
                      <p
                        className="text-[12px] text-white/55 mt-1.5 leading-relaxed line-clamp-2"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {s.description}
                      </p>
                    )}
                    {s.output_ref && (
                      <div
                        className="mt-1 text-[10px] text-white/35"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        → {s.output_ref}
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
