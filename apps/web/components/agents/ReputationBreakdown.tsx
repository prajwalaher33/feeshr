"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAgentQuality,
  type AgentQuality,
} from "@/lib/api";

interface ReputationBreakdownProps {
  agentId: string;
}

const CATEGORY_COLOR: Record<string, string> = {
  python: "#22d3ee",
  typescript: "#6366f1",
  rust: "#f59e0b",
  go: "#06b6d4",
  java: "#f97316",
  javascript: "#facc15",
  security: "#ff6b6b",
  performance: "#ec4899",
  testing: "#28c840",
  docs: "#8b5cf6",
  review: "#a78bfa",
  general: "#6b7280",
};

function colorForCategory(name: string): string {
  if (CATEGORY_COLOR[name]) return CATEGORY_COLOR[name];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 55%)`;
}

export function ReputationBreakdown({ agentId }: ReputationBreakdownProps) {
  const [data, setData] = useState<AgentQuality | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchAgentQuality(agentId).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [agentId]);

  const sorted = useMemo(() => {
    if (!data?.reputation_breakdown) return [];
    return Object.entries(data.reputation_breakdown)
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [data]);

  const total = useMemo(
    () => sorted.reduce((sum, [, score]) => sum + score, 0),
    [sorted],
  );

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

  if (!data || sorted.length === 0) {
    return (
      <div className="card p-5">
        <Title />
        <p
          className="text-[12px] text-white/30 mt-2"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          No category breakdown yet
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-baseline gap-3 mb-4">
        <Title />
        <span
          className="ml-auto text-[10px] text-white/25"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {sorted.length} categor{sorted.length !== 1 ? "ies" : "y"} · {total.toLocaleString()} total
        </span>
      </div>

      {/* Stacked horizontal bar */}
      <div className="flex w-full h-2 rounded-full overflow-hidden bg-white/[0.04] mb-4">
        {sorted.map(([name, score]) => {
          const pct = total > 0 ? (score / total) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <div
              key={name}
              style={{
                width: `${pct}%`,
                background: colorForCategory(name),
              }}
              title={`${name}: ${score} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Category list with score + share */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {sorted.map(([name, score]) => {
          const pct = total > 0 ? (score / total) * 100 : 0;
          const color = colorForCategory(name);
          return (
            <div key={name} className="flex items-center gap-2.5">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: color, boxShadow: `0 0 4px ${color}66` }}
              />
              <span
                className="text-[12px] text-white/65 capitalize flex-1 truncate"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {name}
              </span>
              <span
                className="text-[11px] text-white/40 tabular-nums"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {pct.toFixed(0)}%
              </span>
              <span
                className="text-[12px] text-white/85 tabular-nums w-12 text-right"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {score.toLocaleString()}
              </span>
            </div>
          );
        })}
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
      Reputation by category
    </h3>
  );
}
