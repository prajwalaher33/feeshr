"use client";

import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import {
  fetchDecision,
  type TechnicalDecisionPage,
  type DecisionVoteRecord,
} from "@/lib/api";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TimeAgo } from "@/components/ui/TimeAgo";

const STATUS_META: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "#22d3ee" },
  voting: { label: "Voting", color: "#6366f1" },
  resolved: { label: "Resolved", color: "#28c840" },
  deadlocked: { label: "Deadlocked", color: "#ff6b6b" },
  withdrawn: { label: "Withdrawn", color: "#6b7280" },
};

export default function DecisionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<TechnicalDecisionPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDecision(id).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [id]);

  const totals = useMemo(() => {
    if (!data) return { totalWeight: 0, totalCount: 0 };
    let totalWeight = 0;
    let totalCount = 0;
    for (const t of Object.values(data.tally)) {
      totalWeight += t.weight;
      totalCount += t.count;
    }
    return { totalWeight, totalCount };
  }, [data]);

  if (loading) {
    return (
      <div className="page-container">
        <SkeletonList count={5} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <span className="empty-state-text">Decision not found</span>
          <Link
            href="/decisions"
            className="mt-3 text-[12px] text-cyan/70 hover:text-cyan transition-colors"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            ← All decisions
          </Link>
        </div>
      </div>
    );
  }

  const d = data.decision;
  const meta = STATUS_META[d.status] ?? STATUS_META.open;
  const deadlinePassed =
    new Date(d.voting_deadline).getTime() < Date.now();

  return (
    <div className="page-container" style={{ maxWidth: 920 }}>
      <div className="mb-4">
        <Link
          href="/decisions"
          className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          ← All decisions
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
            <h1 className="text-[20px] text-white/90 font-medium leading-tight">
              {d.title}
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
              <span>scope: {d.scope_type}</span>
              <span>by {d.proposed_by.slice(0, 12)}</span>
              <span>
                deadline {deadlinePassed ? "passed " : ""}
                <TimeAgo iso={d.voting_deadline} />
              </span>
            </div>
          </div>
        </div>
        {d.context && (
          <p className="text-[13px] text-white/70 leading-relaxed whitespace-pre-wrap">
            {d.context}
          </p>
        )}
      </div>

      <h2
        className="text-[12px] text-white/40 uppercase tracking-[0.1em] mb-3"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Options
      </h2>
      <div className="flex flex-col gap-2 mb-6">
        {d.options.map((opt) => {
          const tally = data.tally[opt.id] ?? { weight: 0, count: 0 };
          const pct =
            totals.totalWeight > 0
              ? (tally.weight / totals.totalWeight) * 100
              : 0;
          const isWinning = d.winning_option_id === opt.id;
          return (
            <div
              key={opt.id}
              className="card p-3 relative overflow-hidden"
              style={
                isWinning
                  ? {
                      borderColor: "rgba(40,200,64,0.35)",
                      background: "rgba(40,200,64,0.03)",
                    }
                  : undefined
              }
            >
              <div
                className="absolute inset-y-0 left-0 transition-[width] duration-500"
                style={{
                  width: `${pct}%`,
                  background: isWinning
                    ? "rgba(40,200,64,0.07)"
                    : "rgba(99,102,241,0.06)",
                  pointerEvents: "none",
                }}
              />
              <div className="relative flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-[13px] text-white/85"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {opt.title ?? opt.id}
                    </span>
                    {isWinning && (
                      <span
                        className="text-[10px] uppercase tracking-wider"
                        style={{
                          color: "#28c840",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        winning
                      </span>
                    )}
                  </div>
                  {opt.description && (
                    <p className="text-[12px] text-white/50 mt-0.5">
                      {opt.description}
                    </p>
                  )}
                </div>
                <div
                  className="text-right shrink-0 text-[11px] text-white/60 tabular-nums"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  <div>{tally.weight.toFixed(1)} weight</div>
                  <div className="text-white/30 text-[10px]">
                    {tally.count} vote{tally.count !== 1 ? "s" : ""} · {pct.toFixed(0)}%
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {d.decision_rationale && (
        <div
          className="card p-4 mb-6"
          style={{ borderColor: "rgba(40,200,64,0.20)" }}
        >
          <div
            className="text-[10px] uppercase tracking-[0.1em] mb-1.5"
            style={{ color: "#28c840", fontFamily: "var(--font-mono)" }}
          >
            Rationale
          </div>
          <p className="text-[13px] text-white/70 leading-relaxed whitespace-pre-wrap">
            {d.decision_rationale}
          </p>
        </div>
      )}

      <h2
        className="text-[12px] text-white/40 uppercase tracking-[0.1em] mb-3"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Votes ({data.votes.length})
      </h2>
      {data.votes.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-text">No votes cast yet</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {data.votes.map((v: DecisionVoteRecord) => {
            const opt = d.options.find((o) => o.id === v.option_id);
            return (
              <div key={v.id} className="card p-3">
                <div
                  className="flex items-center gap-2 mb-1.5 text-[11px]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  <span className="text-white/70">
                    {v.voter_display_name ?? v.voter_id.slice(0, 12)}
                  </span>
                  <span className="text-white/30">→</span>
                  <span style={{ color: "#6366f1" }}>{opt?.title ?? v.option_id}</span>
                  <span className="text-white/30">· weight {v.vote_weight.toFixed(1)}</span>
                  <span className="ml-auto text-white/30 text-[10px]">
                    <TimeAgo iso={v.created_at} />
                  </span>
                </div>
                <p className="text-[12px] text-white/65 leading-relaxed whitespace-pre-wrap">
                  {v.reasoning}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
