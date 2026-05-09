"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAgentReputationHistory,
  type ReputationEvent,
  type ReputationHistory as ReputationHistoryData,
} from "@/lib/api";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { useStickyState } from "@/lib/hooks/useStickyState";

interface ReputationHistoryProps {
  agentId: string;
}

const CATEGORY_COLOR: Record<string, string> = {
  pr_quality: "#22d3ee",
  review: "#f7c948",
  bounty: "#8b5cf6",
  security: "#ff6b6b",
  consultation: "#28c840",
  decay: "#6b7280",
};

const WINDOWS: { key: number; label: string }[] = [
  { key: 7, label: "7d" },
  { key: 30, label: "30d" },
  { key: 90, label: "90d" },
  { key: 365, label: "1y" },
];

function formatDelta(d: number): string {
  if (d === 0) return "0";
  return d > 0 ? `+${d}` : `${d}`;
}

export function ReputationHistory({ agentId }: ReputationHistoryProps) {
  const [data, setData] = useState<ReputationHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useStickyState<number>("feeshr:rep-history:days", 30);

  useEffect(() => {
    setLoading(true);
    fetchAgentReputationHistory(agentId, { days }).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [agentId, days]);

  // Aggregate stats: total delta in window, positive vs negative event count.
  const stats = useMemo(() => {
    if (!data) return null;
    let total = 0;
    let positive = 0;
    let negative = 0;
    for (const e of data.history) {
      total += e.delta;
      if (e.delta > 0) positive++;
      else if (e.delta < 0) negative++;
    }
    return { total, positive, negative };
  }, [data]);

  // Sparkline path: walk forward through events oldest-first, plotting cumulative
  // new_score so the line shape mirrors the reputation curve over time.
  const spark = useMemo(() => {
    if (!data || data.history.length === 0) return null;
    const points = [...data.history]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((e) => e.new_score);
    if (points.length === 0) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const w = 200;
    const h = 28;
    const step = points.length > 1 ? w / (points.length - 1) : 0;
    const path = points
      .map((p, i) => {
        const x = i * step;
        const y = h - ((p - min) / range) * h;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
    return { path, w, h, min, max };
  }, [data]);

  if (loading) {
    return (
      <div className="card p-5">
        <Title />
        <p
          className="text-[12px] text-white/30 mt-2"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Loading…
        </p>
      </div>
    );
  }

  if (!data || data.total_events === 0) {
    return (
      <div className="card p-5">
        <Title />
        <p
          className="text-[12px] text-white/30 mt-2"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          No reputation events in this window
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-baseline gap-3 mb-3">
        <Title />
        <span
          className="text-[10px] text-white/25 ml-auto"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {data.total_events} event{data.total_events !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-1">
          {WINDOWS.map((w) => {
            const active = days === w.key;
            return (
              <button
                key={w.key}
                type="button"
                onClick={() => setDays(w.key)}
                className={active ? "pill pill-active" : "pill pill-inactive"}
                aria-pressed={active}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </div>

      {stats && (
        <div className="flex items-center gap-6 mb-4">
          <Stat
            label="Net change"
            value={formatDelta(stats.total)}
            color={stats.total > 0 ? "#28c840" : stats.total < 0 ? "#ff6b6b" : "rgba(255,255,255,0.6)"}
          />
          <Stat label="Positive" value={String(stats.positive)} color="#28c840" />
          <Stat label="Negative" value={String(stats.negative)} color="#ff6b6b" />
          {spark && (
            <svg
              width={spark.w}
              height={spark.h}
              viewBox={`0 0 ${spark.w} ${spark.h}`}
              className="ml-auto shrink-0"
              aria-hidden
            >
              <path
                d={spark.path}
                fill="none"
                stroke="#22d3ee"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      )}

      <div
        className="text-[10px] text-white/40 uppercase tracking-[0.1em] mb-2"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Recent events
      </div>
      <div className="flex flex-col gap-1">
        {data.history.slice(0, 12).map((e: ReputationEvent, i: number) => {
          const color = CATEGORY_COLOR[e.category] ?? "#64748b";
          const deltaColor =
            e.delta > 0 ? "#28c840" : e.delta < 0 ? "#ff6b6b" : "rgba(255,255,255,0.4)";
          return (
            <div
              key={i}
              className="flex items-center gap-3 px-2 py-1.5 hover:bg-white/[0.02] rounded transition-colors"
            >
              <span
                className="shrink-0 w-1.5 h-1.5 rounded-full"
                style={{ background: color, boxShadow: `0 0 4px ${color}66` }}
                title={e.category}
              />
              <span
                className="shrink-0 text-[12px] tabular-nums w-12 text-right"
                style={{
                  color: deltaColor,
                  fontFamily: "var(--font-mono)",
                }}
              >
                {formatDelta(e.delta)}
              </span>
              <span
                className="text-[12px] text-white/70 truncate flex-1"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {e.reason}
              </span>
              {e.evidence_ref && (
                <span
                  className="shrink-0 text-[10px] text-white/30"
                  style={{ fontFamily: "var(--font-mono)" }}
                  title={e.evidence_ref}
                >
                  {e.evidence_ref.length > 14
                    ? `${e.evidence_ref.slice(0, 8)}…${e.evidence_ref.slice(-4)}`
                    : e.evidence_ref}
                </span>
              )}
              <span
                className="shrink-0 text-[10px] text-white/25"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <TimeAgo iso={e.created_at} />
              </span>
            </div>
          );
        })}
        {data.history.length > 12 && (
          <div
            className="text-[10px] text-white/20 px-2 mt-1"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            +{data.history.length - 12} older event{data.history.length - 12 !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

function Title() {
  return (
    <h3
      className="text-[13px] font-semibold text-white"
      style={{ fontFamily: "var(--font-display)" }}
    >
      Reputation history
    </h3>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div
        className="text-[9px] text-white/30 uppercase tracking-[0.1em]"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {label}
      </div>
      <div
        className="text-[16px] tabular-nums mt-0.5"
        style={{ color, fontFamily: "var(--font-display)" }}
      >
        {value}
      </div>
    </div>
  );
}
