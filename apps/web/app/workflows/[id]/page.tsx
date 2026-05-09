"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  fetchWorkflowInstance,
  type WorkflowInstanceDetail,
  type WorkflowProgressEntry,
  type WorkflowTemplateStep,
} from "@/lib/api";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TimeAgo } from "@/components/ui/TimeAgo";

const STATUS_META: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "#22d3ee" },
  complete: { label: "Complete", color: "#28c840" },
  abandoned: { label: "Abandoned", color: "#6b7280" },
  failed: { label: "Failed", color: "#ff6b6b" },
};

const STEP_STATUS_COLOR: Record<string, string> = {
  complete: "#28c840",
  in_progress: "#22d3ee",
  pending: "rgba(203,213,225,0.30)",
  failed: "#ff6b6b",
  skipped: "#6b7280",
};

const CONTEXT_LINK: Record<string, (id: string) => string | null> = {
  bounty: (id) => `/bounties/${id}`,
  issue: (id) => `/issues/${id}`,
  pr: (id) => `/prs/${id}`,
  project: (id) => `/projects/${id}`,
};

interface MergedStep {
  index: number;
  template?: WorkflowTemplateStep;
  progress?: WorkflowProgressEntry;
}

function mergeSteps(detail: WorkflowInstanceDetail): MergedStep[] {
  const total = detail.total_steps;
  const tmpl = Array.isArray(detail.template_steps) ? detail.template_steps : [];
  const log = Array.isArray(detail.progress_log) ? detail.progress_log : [];
  const out: MergedStep[] = [];
  for (let i = 1; i <= total; i++) {
    const template =
      tmpl.find((t) => t?.order === i) ?? tmpl[i - 1] ?? undefined;
    const progress = log.find((l) => l?.step === i);
    out.push({ index: i, template, progress });
  }
  return out;
}

export default function WorkflowInstancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [detail, setDetail] = useState<WorkflowInstanceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkflowInstance(id).then((d) => {
      setDetail(d);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="page-container">
        <SkeletonList count={5} />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <span className="empty-state-text">Workflow instance not found</span>
          <Link
            href="/workflows"
            className="mt-3 text-[12px] text-cyan/70 hover:text-cyan transition-colors"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            ← All workflows
          </Link>
        </div>
      </div>
    );
  }

  const meta = STATUS_META[detail.status] ?? STATUS_META.active;
  const merged = mergeSteps(detail);
  const ctx = CONTEXT_LINK[detail.context_type]?.(detail.context_id);

  return (
    <div className="page-container" style={{ maxWidth: 920 }}>
      <div className="mb-4">
        <Link
          href="/workflows"
          className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          ← All workflows
        </Link>
      </div>

      <div className="card p-5 mb-5">
        <div className="flex items-start gap-3 mb-3">
          <span
            className="shrink-0 mt-2 w-2 h-2 rounded-full"
            style={{
              backgroundColor: meta.color,
              boxShadow: `0 0 6px ${meta.color}40`,
            }}
          />
          <div className="flex-1 min-w-0">
            <h1
              className="text-[18px] text-white/90 font-medium leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {detail.template_display_name ?? detail.template_name ?? "Workflow"}
            </h1>
            <div
              className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/50"
              style={{ fontFamily: "var(--font-mono)" }}
            >
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
              {detail.template_category && <span>· {detail.template_category}</span>}
              <span>· step {detail.current_step}/{detail.total_steps}</span>
              <span>by {detail.agent_id.slice(0, 12)}</span>
              {ctx ? (
                <Link href={ctx} className="hover:text-cyan transition-colors">
                  → {detail.context_type} {detail.context_id.slice(0, 8)}
                </Link>
              ) : (
                <span>{detail.context_type} {detail.context_id.slice(0, 8)}</span>
              )}
              <span className="ml-auto text-white/30">
                created <TimeAgo iso={detail.created_at} />
              </span>
            </div>
          </div>
        </div>

        <div
          className="mt-3 h-1.5 w-full rounded-full overflow-hidden"
          style={{ background: "rgba(203,213,225,0.06)" }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${
                detail.status === "complete"
                  ? 100
                  : Math.min(100, Math.round((detail.current_step / Math.max(1, detail.total_steps)) * 100))
              }%`,
              background: meta.color,
            }}
          />
        </div>
      </div>

      <h2
        className="text-[12px] text-white/40 uppercase tracking-[0.1em] mb-3"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Steps
      </h2>

      <ol className="flex flex-col gap-3">
        {merged.map((s, i) => {
          const isLast = i === merged.length - 1;
          const stepStatus = (s.progress?.status as string) ?? "pending";
          const isCurrent = s.index === detail.current_step && detail.status === "active";
          const color = isCurrent
            ? "#22d3ee"
            : STEP_STATUS_COLOR[stepStatus] ?? STEP_STATUS_COLOR.pending;
          return (
            <li key={s.index} className="flex gap-3">
              <div className="flex flex-col items-center shrink-0">
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px]"
                  style={{
                    background: `${color}10`,
                    color,
                    border: `1px solid ${color}40`,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {s.index}
                </span>
                {!isLast && (
                  <span
                    className="flex-1 w-px my-1"
                    style={{ background: "rgba(203,213,225,0.10)" }}
                  />
                )}
              </div>

              <div className="flex-1 min-w-0 card p-3">
                <div className="flex items-baseline gap-2 mb-1.5 flex-wrap">
                  <span
                    className="text-[13px] text-white/85"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {(s.template?.name as string | undefined) ?? `Step ${s.index}`}
                  </span>
                  {isCurrent && (
                    <span
                      className="text-[10px] uppercase tracking-wider"
                      style={{ color, fontFamily: "var(--font-mono)" }}
                    >
                      current
                    </span>
                  )}
                  {!isCurrent && stepStatus !== "pending" && (
                    <span
                      className="text-[10px] uppercase tracking-wider"
                      style={{ color, fontFamily: "var(--font-mono)" }}
                    >
                      {stepStatus}
                    </span>
                  )}
                </div>
                {s.template?.description && (
                  <p
                    className="text-[12px] text-white/55 leading-relaxed"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {s.template.description as string}
                  </p>
                )}
                {s.progress && (
                  <div
                    className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] text-white/40"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {s.progress.started_at && (
                      <span>started {new Date(s.progress.started_at).toLocaleString()}</span>
                    )}
                    {s.progress.completed_at && (
                      <span>completed {new Date(s.progress.completed_at).toLocaleString()}</span>
                    )}
                    {s.progress.output_ref && <span>→ {s.progress.output_ref}</span>}
                  </div>
                )}
                {s.progress?.notes && (
                  <p
                    className="mt-1.5 text-[11px] text-white/55 leading-relaxed whitespace-pre-wrap"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {s.progress.notes as string}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
