"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  fetchWorkflowTemplate,
  type WorkflowTemplateDetail,
  type WorkflowTemplateDetailStep,
} from "@/lib/api";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TimeAgo } from "@/components/ui/TimeAgo";

const CATEGORY_COLOR: Record<string, string> = {
  bug_fix: "#ff6b6b",
  feature: "#22d3ee",
  security_audit: "#f7c948",
  documentation: "#6366f1",
  refactor: "#8b5cf6",
  dependency_update: "#28c840",
  performance: "#f97316",
  testing: "#64748b",
};

const GATE_COLOR: Record<string, string> = {
  ci_pass: "#28c840",
  review_approve: "#22d3ee",
  maintainer_approve: "#8b5cf6",
};

export default function WorkflowTemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [tmpl, setTmpl] = useState<WorkflowTemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkflowTemplate(id).then((t) => {
      setTmpl(t);
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

  if (!tmpl) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <span className="empty-state-text">Template not found</span>
          <Link
            href="/workflows/templates"
            className="mt-3 text-[12px] text-cyan/70 hover:text-cyan transition-colors"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            ← All templates
          </Link>
        </div>
      </div>
    );
  }

  const color = CATEGORY_COLOR[tmpl.category] ?? "#64748b";
  const sortedSteps = [...tmpl.steps].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
  const completionPct = Math.round((tmpl.avg_completion_rate ?? 0) * 100);

  return (
    <div className="page-container" style={{ maxWidth: 920 }}>
      <div className="mb-4">
        <Link
          href="/workflows/templates"
          className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          ← All templates
        </Link>
      </div>

      <div className="card p-5 mb-5">
        <div className="flex items-baseline gap-2 flex-wrap mb-2">
          <h1
            className="text-[20px] text-white/90 font-medium leading-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {tmpl.display_name || tmpl.name}
          </h1>
          <span
            className="status-chip text-[10px]"
            style={{
              color,
              background: `${color}0a`,
              border: `1px solid ${color}18`,
              fontFamily: "var(--font-mono)",
            }}
          >
            {tmpl.category}
          </span>
        </div>
        <p className="text-[13px] text-white/70 leading-relaxed mb-3">
          {tmpl.description}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <Stat label="Steps" value={String(sortedSteps.length)} />
          <Stat label="Times used" value={tmpl.times_used.toLocaleString()} />
          <Stat
            label="Completion"
            value={tmpl.times_used > 0 ? `${completionPct}%` : "—"}
            hint={tmpl.times_used > 0 ? "of started instances" : undefined}
          />
          <Stat
            label="Applies to"
            value={tmpl.applicable_to.length > 0 ? String(tmpl.applicable_to.length) : "—"}
            hint={tmpl.applicable_to.slice(0, 3).join(", ")}
          />
        </div>

        <div
          className="mt-3 flex items-center gap-3 text-[10px] text-white/30"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span>by {tmpl.created_by.slice(0, 12)}</span>
          <span>created <TimeAgo iso={tmpl.created_at} /></span>
        </div>
      </div>

      <h2
        className="text-[12px] text-white/40 uppercase tracking-[0.1em] mb-3"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Step blueprint
      </h2>

      <ol className="flex flex-col gap-3">
        {sortedSteps.map((s, i) => (
          <StepCard
            key={i}
            step={s}
            index={s.order ?? i + 1}
            isLast={i === sortedSteps.length - 1}
            categoryColor={color}
          />
        ))}
      </ol>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <div
        className="text-[9px] text-white/30 uppercase tracking-[0.1em]"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {label}
      </div>
      <div
        className="text-[16px] text-white/85 mt-0.5 tabular-nums"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {value}
      </div>
      {hint && (
        <div
          className="text-[10px] text-white/25 mt-0.5 truncate"
          style={{ fontFamily: "var(--font-mono)" }}
          title={hint}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

function StepCard({
  step,
  index,
  isLast,
  categoryColor,
}: {
  step: WorkflowTemplateDetailStep;
  index: number;
  isLast: boolean;
  categoryColor: string;
}) {
  const gate = step.gate as string | undefined;
  const gateColor = gate ? GATE_COLOR[gate] ?? "#64748b" : null;
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center shrink-0">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px]"
          style={{
            background: `${categoryColor}10`,
            color: categoryColor,
            border: `1px solid ${categoryColor}40`,
            fontFamily: "var(--font-mono)",
          }}
        >
          {index}
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
            {(step.name as string | undefined) ?? `Step ${index}`}
          </span>
          {step.estimated_effort && (
            <span
              className="text-[10px] text-white/35"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              · {step.estimated_effort as string}
            </span>
          )}
          {gate && gateColor && (
            <span
              className="ml-auto status-chip text-[10px]"
              style={{
                color: gateColor,
                background: `${gateColor}0a`,
                border: `1px solid ${gateColor}18`,
                fontFamily: "var(--font-mono)",
              }}
              title="advancement gate"
            >
              gate: {gate}
            </span>
          )}
        </div>
        {step.description && (
          <p
            className="text-[12px] text-white/55 leading-relaxed"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {step.description as string}
          </p>
        )}
        {step.required_skills && step.required_skills.length > 0 && (
          <div
            className="mt-2 flex flex-wrap gap-1.5 text-[10px]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {step.required_skills.map((sk) => (
              <span key={sk} className="status-chip text-[10px]">
                {sk}
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
