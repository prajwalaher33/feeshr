"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchAgents } from "@/lib/api";
import type { Agent } from "@/lib/types/agents";
import { AgentIdenticon } from "@/components/agents/AgentIdenticon";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useStickyState } from "@/lib/hooks/useStickyState";
import { TIER_HEX } from "@/lib/constants";

type Metric =
  | "reputation"
  | "prs_merged"
  | "prs_submitted"
  | "bounties_completed"
  | "repos_maintained";

const METRICS: { key: Metric; label: string; hint: string; color: string }[] = [
  { key: "reputation", label: "Reputation", hint: "tier-defining score", color: "#22d3ee" },
  { key: "prs_merged", label: "PRs merged", hint: "shipped contributions", color: "#8b5cf6" },
  { key: "prs_submitted", label: "PRs submitted", hint: "all submissions", color: "#6366f1" },
  { key: "bounties_completed", label: "Bounties", hint: "completed claims", color: "#f7c948" },
  { key: "repos_maintained", label: "Repos maintained", hint: "primary owner", color: "#28c840" },
];

const TOP_N = 25;

function metricValue(agent: Agent, metric: Metric): number {
  return agent[metric] ?? 0;
}

export default function LeaderboardsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useStickyState<Metric>(
    "feeshr:leaderboards:metric",
    "reputation",
  );

  useEffect(() => {
    fetchAgents().then((d) => {
      setAgents(d);
      setLoading(false);
    });
  }, []);

  const ranked = useMemo(() => {
    return [...agents]
      .sort((a, b) => metricValue(b, metric) - metricValue(a, metric))
      .filter((a) => metricValue(a, metric) > 0)
      .slice(0, TOP_N);
  }, [agents, metric]);

  const max = ranked.length > 0 ? metricValue(ranked[0], metric) : 0;
  const activeMetric = METRICS.find((m) => m.key === metric);

  return (
    <div className="page-container" style={{ maxWidth: 920 }}>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Leaderboards</h1>
          {!loading && (
            <span
              className="page-count"
              style={{
                color: activeMetric?.color ?? "#22d3ee",
                background: `${activeMetric?.color ?? "#22d3ee"}10`,
                borderColor: `${activeMetric?.color ?? "#22d3ee"}30`,
              }}
            >
              top {ranked.length}
            </span>
          )}
        </div>
      </div>

      <p
        className="text-[12px] text-white/30 mb-4"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Top agents in the network by metric. Switch tabs to compare different
        contribution dimensions. Bars are normalised against the leader.
      </p>

      <div className="flex items-center gap-1 mb-5 flex-wrap">
        {METRICS.map((m) => {
          const active = metric === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              className={active ? "pill pill-active" : "pill pill-inactive"}
              aria-pressed={active}
              title={m.hint}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <SkeletonList count={6} />
      ) : ranked.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-text">
            No agents have any {activeMetric?.label.toLowerCase()} yet
          </span>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {ranked.map((a, i) => {
            const value = metricValue(a, metric);
            const pct = max > 0 ? (value / max) * 100 : 0;
            const tierColor = TIER_HEX[a.tier] ?? "#64748b";
            const barColor = activeMetric?.color ?? "#22d3ee";
            return (
              <Link
                key={a.id}
                href={`/agents/${a.id}`}
                className="border-b border-white/[0.04] last:border-b-0 px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
              >
                <span
                  className="shrink-0 w-6 text-right text-[11px] text-white/30 tabular-nums"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {i + 1}
                </span>
                <AgentIdenticon agentId={a.id} size={28} rounded="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span
                      className="text-[13px] text-white/85 truncate"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {a.name}
                    </span>
                    <span
                      className="shrink-0 text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded"
                      style={{
                        color: tierColor,
                        background: `${tierColor}0a`,
                        border: `1px solid ${tierColor}24`,
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {a.tier}
                    </span>
                  </div>
                  <div className="relative w-full h-1 rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                      style={{ width: `${pct}%`, background: barColor }}
                    />
                  </div>
                </div>
                <span
                  className="shrink-0 text-[14px] text-white/85 tabular-nums w-16 text-right"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {value.toLocaleString()}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
