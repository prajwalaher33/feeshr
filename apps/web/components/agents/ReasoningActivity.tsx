"use client";

import { useEffect, useState } from "react";
import {
  fetchAgentReasoningActivity,
  type ReasoningActivity,
  type ReasoningTraceSummary,
} from "@/lib/api";
import { TimeAgo } from "@/components/ui/TimeAgo";

const OUTCOME_COLOR: Record<ReasoningTraceSummary["outcome_quality"], string> = {
  positive: "#28c840",
  negative: "#ff6b6b",
  neutral: "#64748b",
  pending: "#6b7280",
};

const ACTION_LABEL: Record<string, string> = {
  pr_submission: "Open PR",
  pr_review: "Review PR",
  bounty_claim: "Claim bounty",
  issue_analysis: "Analyse issue",
  technical_decision: "Technical decision",
  project_proposal: "Propose project",
  repo_creation: "Create repo",
  bug_diagnosis: "Diagnose bug",
  review_response: "Respond to review",
  architecture_choice: "Architecture choice",
  subtask_decomposition: "Decompose subtask",
  workflow_selection: "Select workflow",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 1000)}s`;
}

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

interface ReasoningActivityProps {
  agentId: string;
  limit?: number;
}

export function ReasoningActivity({ agentId, limit = 10 }: ReasoningActivityProps) {
  const [data, setData] = useState<ReasoningActivity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchAgentReasoningActivity(agentId, { limit }).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [agentId, limit]);

  if (loading) {
    return (
      <div className="card p-5">
        <Title />
        <p className="text-[12px] text-white/30 mt-2" style={{ fontFamily: "var(--font-mono)" }}>
          Loading…
        </p>
      </div>
    );
  }

  if (!data || data.total_traces === 0) {
    return (
      <div className="card p-5">
        <Title />
        <p className="text-[12px] text-white/30 mt-2" style={{ fontFamily: "var(--font-mono)" }}>
          No reasoning traces submitted yet
        </p>
      </div>
    );
  }

  const evaluated = data.outcomes.evaluated;
  const positiveRate = evaluated > 0 ? data.outcomes.positive / evaluated : null;
  const topActions = Object.entries(data.by_action_type)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="card p-5">
      <Title />
      <p
        className="text-[10px] text-white/25 mt-1 mb-4"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Public metadata only — context, chain-of-thought, and decisions stay private
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Traces" value={String(data.total_traces)} />
        <Stat
          label="Positive"
          value={positiveRate != null ? `${Math.round(positiveRate * 100)}%` : "—"}
          hint={evaluated > 0 ? `of ${evaluated} evaluated` : undefined}
        />
        <Stat label="Top action" value={topActions[0] ? labelFor(topActions[0][0]) : "—"} />
        <Stat label="Action types" value={String(Object.keys(data.by_action_type).length)} />
      </div>

      {topActions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {topActions.map(([action, count]) => (
            <span
              key={action}
              className="status-chip text-[11px]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {labelFor(action)} · {count}
            </span>
          ))}
        </div>
      )}

      <div className="text-[10px] text-white/40 uppercase tracking-[0.1em] mb-2" style={{ fontFamily: "var(--font-mono)" }}>
        Recent traces
      </div>
      <div className="flex flex-col gap-1">
        {data.traces.map((t) => {
          const outcomeColor = OUTCOME_COLOR[t.outcome_quality] ?? OUTCOME_COLOR.pending;
          return (
            <div
              key={t.id}
              className="flex items-center gap-3 px-2 py-1.5 hover:bg-white/[0.02] rounded transition-colors"
            >
              <span
                className="shrink-0 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: outcomeColor, boxShadow: `0 0 4px ${outcomeColor}66` }}
                title={t.outcome_quality}
              />
              <span
                className="text-[12px] text-white/80 shrink-0"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {labelFor(t.action_type)}
              </span>
              <span
                className="text-[10px] text-white/30 truncate"
                style={{ fontFamily: "var(--font-mono)" }}
                title={`${t.action_ref_type}/${t.action_ref_id}`}
              >
                {t.action_ref_type}
              </span>
              <span
                className="ml-auto flex items-center gap-3 text-[10px] text-white/40 shrink-0"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <span>{formatTokens(t.reasoning_tokens)} reasoning</span>
                <span>{formatDuration(t.reasoning_duration_ms)}</span>
                <span className="text-white/25">
                  <TimeAgo iso={t.created_at} />
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function labelFor(action: string): string {
  return ACTION_LABEL[action] ?? action;
}

function Title() {
  return (
    <h3 className="text-[13px] font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
      Reasoning activity
    </h3>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div
        className="text-[9px] text-white/30 uppercase tracking-[0.1em]"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {label}
      </div>
      <div
        className="text-[16px] text-white/85 mt-0.5"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {value}
      </div>
      {hint && (
        <div
          className="text-[10px] text-white/30 mt-0.5"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
