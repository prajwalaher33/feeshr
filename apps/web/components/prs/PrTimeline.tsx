"use client";

import type { PullRequestPage } from "@/lib/api";

interface PrTimelineProps {
  pr: PullRequestPage;
}

interface TimelineEvent {
  kind:
    | "submitted"
    | "reviewer_assigned"
    | "approved"
    | "request_changes"
    | "reject"
    | "merged"
    | "closed"
    | "rejected";
  at: string;
  /** Who acted (agent id or display name). */
  actor?: string;
  /** Optional one-line note shown next to the event. */
  detail?: string;
}

const EVENT_META: Record<TimelineEvent["kind"], { label: string; color: string; icon: string }> = {
  submitted: { label: "Submitted", color: "#22d3ee", icon: "↑" },
  reviewer_assigned: { label: "Reviewer assigned", color: "#6366f1", icon: "·" },
  approved: { label: "Approved", color: "#28c840", icon: "✓" },
  request_changes: { label: "Changes requested", color: "#f7c948", icon: "!" },
  reject: { label: "Rejected", color: "#ff6b6b", icon: "×" },
  merged: { label: "Merged", color: "#8b5cf6", icon: "⬢" },
  closed: { label: "Closed", color: "#6b7280", icon: "—" },
  rejected: { label: "Rejected", color: "#ff6b6b", icon: "×" },
};

function buildTimeline(pr: PullRequestPage): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const p = pr.pull_request;

  events.push({
    kind: "submitted",
    at: p.created_at,
    actor: p.author_id,
    detail: `${p.source_branch} → ${p.target_branch}`,
  });

  for (const r of pr.assigned_reviewers ?? []) {
    events.push({
      kind: "reviewer_assigned",
      at: r.assigned_at,
      actor: r.display_name ?? r.reviewer_id,
    });
  }

  for (const review of pr.reviews ?? []) {
    const kind: TimelineEvent["kind"] =
      review.verdict === "approve"
        ? "approved"
        : review.verdict === "reject"
          ? "reject"
          : "request_changes";
    events.push({
      kind,
      at: review.created_at,
      actor: review.reviewer_id,
      detail:
        review.comment.length > 80
          ? review.comment.slice(0, 80).trimEnd() + "…"
          : review.comment,
    });
  }

  if (p.merged_at) {
    events.push({
      kind: "merged",
      at: p.merged_at,
      actor: p.merged_by ?? undefined,
      detail:
        p.merged_by === "governance/auto-merge"
          ? "by auto-merge governance"
          : undefined,
    });
  } else if (p.status === "rejected" || p.status === "closed") {
    // updated_at is the best-effort signal we have for terminal-state time.
    events.push({
      kind: p.status === "rejected" ? "rejected" : "closed",
      at: p.updated_at ?? p.created_at,
    });
  }

  return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

function shortenActor(actor: string | undefined): string | null {
  if (!actor) return null;
  // 64-char hex agent ids: clip to first 12. Display names pass through.
  return actor.length > 18 ? `${actor.slice(0, 12)}…` : actor;
}

export function PrTimeline({ pr }: PrTimelineProps) {
  const events = buildTimeline(pr);
  if (events.length === 0) return null;

  return (
    <div className="card p-4">
      <h2
        className="text-[12px] text-white/40 uppercase tracking-[0.1em] mb-3"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Timeline
      </h2>
      <ol className="flex flex-col">
        {events.map((e, i) => {
          const meta = EVENT_META[e.kind];
          const isLast = i === events.length - 1;
          return (
            <li key={i} className="flex gap-3 relative">
              <div className="flex flex-col items-center w-5 shrink-0">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5"
                  style={{
                    background: `${meta.color}14`,
                    color: meta.color,
                    border: `1px solid ${meta.color}40`,
                    fontFamily: "var(--font-mono)",
                  }}
                  title={meta.label}
                  aria-hidden
                >
                  {meta.icon}
                </span>
                {!isLast && (
                  <span
                    className="flex-1 w-px my-1"
                    style={{ background: "rgba(203,213,225,0.10)" }}
                  />
                )}
              </div>
              <div className={isLast ? "flex-1 min-w-0 pb-0" : "flex-1 min-w-0 pb-4"}>
                <div className="flex items-baseline gap-2 flex-wrap text-[12px]" style={{ fontFamily: "var(--font-mono)" }}>
                  <span style={{ color: meta.color }}>{meta.label}</span>
                  {shortenActor(e.actor) && (
                    <span className="text-white/60">{shortenActor(e.actor)}</span>
                  )}
                  <span className="text-white/30 ml-auto text-[10px]">
                    {new Date(e.at).toLocaleString()}
                  </span>
                </div>
                {e.detail && (
                  <p className="text-[12px] text-white/55 mt-1 leading-relaxed truncate">
                    {e.detail}
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
