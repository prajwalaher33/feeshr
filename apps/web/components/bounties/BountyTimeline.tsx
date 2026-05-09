"use client";

import type { BountyDetail } from "@/lib/api";

interface BountyTimelineProps {
  bounty: BountyDetail;
}

interface TimelineEvent {
  kind:
    | "posted"
    | "claimed"
    | "delivered"
    | "accepted"
    | "disputed"
    | "expired"
    | "deadline";
  at: string;
  actor?: string;
  detail?: string;
}

const EVENT_META: Record<TimelineEvent["kind"], { label: string; color: string; icon: string }> = {
  posted: { label: "Posted", color: "#22d3ee", icon: "↑" },
  claimed: { label: "Claimed", color: "#f7c948", icon: "·" },
  delivered: { label: "Delivered", color: "#6366f1", icon: "✓" },
  accepted: { label: "Accepted", color: "#28c840", icon: "★" },
  disputed: { label: "Disputed", color: "#ff6b6b", icon: "!" },
  expired: { label: "Expired", color: "#6b7280", icon: "—" },
  deadline: { label: "Deadline", color: "#6b7280", icon: "◷" },
};

function buildTimeline(b: BountyDetail): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  events.push({
    kind: "posted",
    at: b.created_at,
    actor: b.posted_by,
    detail: `${b.reputation_reward} rep reward`,
  });

  if (b.claimed_at && b.claimed_by) {
    events.push({
      kind: "claimed",
      at: b.claimed_at,
      actor: b.claimed_by,
    });
  }

  if (b.status === "delivered" || b.status === "accepted" || b.status === "disputed") {
    // We don't have an explicit `delivered_at` so we approximate from the
    // status row's stored timestamps — only render if delivery_ref present.
    if (b.delivery_ref) {
      events.push({
        kind: "delivered",
        at: b.claimed_at ?? b.created_at,
        actor: b.claimed_by ?? undefined,
        detail: `delivery ref: ${b.delivery_ref}`,
      });
    }
  }

  if (b.status === "accepted") {
    events.push({
      kind: "accepted",
      at: b.deadline,
      actor: b.posted_by,
      detail: "reward paid out",
    });
  }
  if (b.status === "disputed") {
    events.push({ kind: "disputed", at: b.deadline });
  }
  if (b.status === "expired") {
    events.push({ kind: "expired", at: b.deadline });
  }

  // Always show deadline marker if it hasn't fired yet.
  const deadlineMs = new Date(b.deadline).getTime();
  if (
    b.status !== "accepted" &&
    b.status !== "disputed" &&
    b.status !== "expired"
  ) {
    events.push({
      kind: "deadline",
      at: b.deadline,
      detail: deadlineMs > Date.now() ? "upcoming" : "passed",
    });
  }

  return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

function shortenActor(actor?: string): string | null {
  if (!actor) return null;
  return actor.length > 18 ? `${actor.slice(0, 12)}…` : actor;
}

export function BountyTimeline({ bounty }: BountyTimelineProps) {
  const events = buildTimeline(bounty);
  if (events.length === 0) return null;

  return (
    <div className="card p-4">
      <h2
        className="text-[12px] text-white/40 uppercase tracking-[0.1em] mb-3"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Lifecycle
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
                <div
                  className="flex items-baseline gap-2 flex-wrap text-[12px]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
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
