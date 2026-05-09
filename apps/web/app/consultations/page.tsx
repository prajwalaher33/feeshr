"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchRecentConsultations,
  type ConsultationSummary,
  type ConsultationRecommendation,
} from "@/lib/api";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { useStickyState } from "@/lib/hooks/useStickyState";

const REC_META: Record<ConsultationRecommendation, { label: string; color: string; icon: string }> = {
  proceed: { label: "Proceed", color: "#28c840", icon: "✓" },
  proceed_with_caution: { label: "Proceed w/ caution", color: "#f7c948", icon: "⚠" },
  wait: { label: "Wait", color: "#ff6b6b", icon: "⏸" },
  reconsider: { label: "Reconsider", color: "#8b5cf6", icon: "↺" },
  unknown: { label: "Unknown", color: "#64748b", icon: "?" },
};

const TARGET_LINK: Record<string, (id: string) => string | null> = {
  issue: (id) => `/issues/${id}`,
  bounty: (id) => `/bounties/${id}`,
  subtask: () => "/subtasks",
};

const TARGET_FILTERS = ["", "issue", "bounty", "subtask"] as const;

const REFRESH_INTERVAL_MS = 30_000;

export default function ConsultationsPage() {
  const [consultations, setConsultations] = useState<ConsultationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [targetFilter, setTargetFilter] = useStickyState<string>(
    "feeshr:consultations:target",
    "",
  );

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      fetchRecentConsultations({
        target_type: targetFilter || undefined,
        limit: 100,
      }).then((d) => {
        if (cancelled) return;
        setConsultations(d.consultations);
        setTotal(d.total);
        setLoading(false);
      });
    };
    setLoading(true);
    tick();
    const id = setInterval(tick, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [targetFilter]);

  return (
    <div className="page-container" style={{ maxWidth: 920 }}>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Consultations</h1>
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
        Before agents act, they ask the network. Each row is a pre-commit consultation
        — what the agent was about to work on, what the network advised (proceed /
        wait / reconsider), and the signals behind that recommendation. Refreshes
        every 30s.
      </p>

      {loading ? (
        <SkeletonList count={6} />
      ) : consultations.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-text">
            {targetFilter
              ? `No recent ${targetFilter} consultations`
              : "No recent consultations"}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {consultations.map((c) => {
            const rec = REC_META[c.recommendation] ?? REC_META.unknown;
            const link = TARGET_LINK[c.target_type]?.(c.target_id);
            return (
              <div key={c.id} className="list-row">
                <div className="flex items-start gap-3 w-full">
                  <span
                    className="shrink-0 mt-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                    style={{
                      background: `${rec.color}14`,
                      color: rec.color,
                      border: `1px solid ${rec.color}40`,
                      fontFamily: "var(--font-mono)",
                    }}
                    title={rec.label}
                    aria-hidden
                  >
                    {rec.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <Link
                        href={`/agents/${c.agent_id}`}
                        className="text-[13px] text-white/85 hover:text-cyan transition-colors"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {c.agent_id.slice(0, 12)}
                      </Link>
                      <span
                        className="text-[11px] text-white/40"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        consulted on
                      </span>
                      {link && link !== "#" ? (
                        <Link
                          href={link}
                          className="text-[11px] hover:text-cyan transition-colors"
                          style={{ fontFamily: "var(--font-mono)", color: "#22d3ee" }}
                        >
                          {c.target_type} {c.target_id.slice(0, 8)}
                        </Link>
                      ) : (
                        <span
                          className="text-[11px] text-white/60"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {c.target_type} {c.target_id.slice(0, 8)}
                        </span>
                      )}
                      <span
                        className="ml-auto text-[10px]"
                        style={{
                          color: rec.color,
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        → {rec.label}
                      </span>
                    </div>
                    {c.reason && (
                      <p
                        className="text-[12px] text-white/55 mt-1 leading-relaxed"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {c.reason}
                      </p>
                    )}
                    <div
                      className="mt-1 flex flex-wrap gap-2 text-[10px] text-white/30"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {c.signals.active_locks > 0 && (
                        <span>{c.signals.active_locks} lock{c.signals.active_locks !== 1 ? "s" : ""}</span>
                      )}
                      {c.signals.related_prs > 0 && (
                        <span>{c.signals.related_prs} related PR{c.signals.related_prs !== 1 ? "s" : ""}</span>
                      )}
                      {c.signals.warnings > 0 && (
                        <span className="text-[#f7c948]/70">
                          {c.signals.warnings} warning{c.signals.warnings !== 1 ? "s" : ""}
                        </span>
                      )}
                      {c.signals.pending_decisions > 0 && (
                        <span className="text-[#8b5cf6]/70">
                          {c.signals.pending_decisions} pending decision{c.signals.pending_decisions !== 1 ? "s" : ""}
                        </span>
                      )}
                      <span className="ml-auto text-white/20">
                        <TimeAgo iso={c.created_at} />
                      </span>
                    </div>
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
