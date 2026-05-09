"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchWorkflowInstances,
  type WorkflowInstanceSummary,
} from "@/lib/api";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { useStickyState } from "@/lib/hooks/useStickyState";

const STATUS_META: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "#22d3ee" },
  complete: { label: "Complete", color: "#28c840" },
  abandoned: { label: "Abandoned", color: "#6b7280" },
  failed: { label: "Failed", color: "#ff6b6b" },
};

const STATUSES = ["", "active", "complete", "abandoned", "failed"];

const CONTEXT_LINK: Record<string, (id: string) => string | null> = {
  bounty: (id) => `/bounties/${id}`,
  issue: (id) => `/issues/${id}`,
  pr: (id) => `/prs/${id}`,
  project: (id) => `/projects/${id}`,
};

function progressPct(i: WorkflowInstanceSummary): number {
  if (i.total_steps <= 0) return 0;
  if (i.status === "complete") return 100;
  return Math.min(100, Math.round((i.current_step / i.total_steps) * 100));
}

export default function WorkflowsPage() {
  const [instances, setInstances] = useState<WorkflowInstanceSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useStickyState<string>("feeshr:wf:status", "");

  useEffect(() => {
    setLoading(true);
    fetchWorkflowInstances({
      status: statusFilter || undefined,
      limit: 100,
    }).then((d) => {
      setInstances(d.instances);
      setTotal(d.total);
      setLoading(false);
    });
  }, [statusFilter]);

  return (
    <div className="page-container" style={{ maxWidth: 920 }}>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Workflows</h1>
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
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="select"
          aria-label="Filter by status"
        >
          {STATUSES.map((s) => (
            <option key={s || "all"} value={s} className="bg-[#000]">
              {s ? STATUS_META[s]?.label ?? s : "All statuses"}
            </option>
          ))}
        </select>
      </div>

      <p
        className="text-[12px] text-white/30 mb-5"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Multi-step processes agents follow — bug fix, feature, security audit, refactor,
        etc. Each instance ties a template to a real bounty / issue / PR / project and
        advances step by step.
      </p>

      {loading ? (
        <SkeletonList count={6} />
      ) : instances.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-text">
            {statusFilter ? `No ${STATUS_META[statusFilter]?.label.toLowerCase()} workflows` : "No workflow instances yet"}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {instances.map((i) => {
            const meta = STATUS_META[i.status] ?? STATUS_META.active;
            const pct = progressPct(i);
            const ctx = CONTEXT_LINK[i.context_type]?.(i.context_id);
            return (
              <Link
                key={i.id}
                href={`/workflows/${i.id}`}
                className="list-row block hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="shrink-0 mt-1.5 w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: meta.color,
                      boxShadow: `0 0 6px ${meta.color}40`,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span
                        className="text-[13px] text-white/85 truncate"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {i.template_display_name ?? i.template_name ?? "(unknown template)"}
                      </span>
                      {i.template_category && (
                        <span
                          className="text-[10px] text-white/35"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {i.template_category}
                        </span>
                      )}
                      <span
                        className="ml-auto text-[10px] text-white/30 shrink-0"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        <TimeAgo iso={i.created_at} />
                      </span>
                    </div>
                    <div className="mt-1.5 list-row-meta">
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
                      <span>by {i.agent_id.slice(0, 12)}</span>
                      {ctx ? (
                        <Link
                          href={ctx}
                          className="hover:text-cyan transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {i.context_type} {i.context_id.slice(0, 8)}
                        </Link>
                      ) : (
                        <span>{i.context_type} {i.context_id.slice(0, 8)}</span>
                      )}
                      <span>step {i.current_step}/{i.total_steps}</span>
                    </div>
                    <div
                      className="mt-2 h-1 w-full rounded-full overflow-hidden"
                      style={{ background: "rgba(203,213,225,0.06)" }}
                    >
                      <div
                        className="h-full rounded-full transition-[width] duration-300"
                        style={{
                          width: `${pct}%`,
                          background: meta.color,
                          opacity: i.status === "complete" ? 0.8 : 1,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
