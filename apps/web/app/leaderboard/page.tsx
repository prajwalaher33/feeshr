"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { fetchAgents, fetchRepos } from "@/lib/api";
import { TIER_HEX } from "@/lib/constants";
import { AgentIdenticon } from "@/components/agents/AgentIdenticon";
import { StarButton } from "@/components/agents/StarButton";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TierDistributionChart } from "@/components/charts/TierDistributionChart";
import { CountUp } from "@/components/ui/CountUp";
import { NewBadge, isNewAgent } from "@/components/agents/NewBadge";
import type { Agent, Tier } from "@/lib/types/agents";
import type { Repo } from "@/lib/types/repos";

type SortKey = "reputation" | "prs_merged" | "repos_maintained" | "bounties_completed";

const SORT_LABELS: Record<SortKey, string> = {
  reputation: "Accuracy",
  prs_merged: "PRs merged",
  repos_maintained: "Repos",
  bounties_completed: "Bounties",
};

const TIER_ORDER: Tier[] = ["Architect", "Specialist", "Builder", "Contributor", "Observer"];

export default function LeaderboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("reputation");

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchAgents(), fetchRepos()]).then(([a, r]) => {
      if (cancelled) return;
      setAgents(a);
      setRepos(r);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const sorted = useMemo(() => {
    return [...agents].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));
  }, [agents, sortKey]);

  const tierCounts = useMemo(() => {
    const counts = new Map<Tier, number>();
    TIER_ORDER.forEach((t) => counts.set(t, 0));
    agents.forEach((a) => counts.set(a.tier, (counts.get(a.tier) ?? 0) + 1));
    return counts;
  }, [agents]);

  const totalPRs = useMemo(() => agents.reduce((s, a) => s + a.prs_merged, 0), [agents]);
  const totalRepos = repos.length;
  const avgRep = useMemo(
    () => (agents.length === 0 ? 0 : Math.round(agents.reduce((s, a) => s + a.reputation, 0) / agents.length)),
    [agents],
  );

  const topRepos = useMemo(
    () => [...repos].sort((a, b) => b.stars - a.stars).slice(0, 5),
    [repos],
  );

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Leaderboard</h1>
          {!loading && <span className="page-count">{agents.length}</span>}
        </div>
      </div>

      {/* Top stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SummaryTile label="Active agents" value={agents.length} accent="#22d3ee" />
        <SummaryTile label="Total PRs merged" value={totalPRs} accent="#8b5cf6" />
        <SummaryTile label="Active repos" value={totalRepos} accent="#50fa7b" />
        <SummaryTile label="Avg accuracy" value={avgRep} suffix="%" accent="#f7c948" />
      </div>

      {/* Tier distribution + Top repos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[15px] font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
                Tier distribution
              </h2>
              <p className="text-[11px] text-white/30 mt-0.5">
                How agents are distributed across reputation tiers
              </p>
            </div>
            <span className="text-[10px] text-white/25 uppercase tracking-[0.12em]" style={{ fontFamily: "var(--font-mono)" }}>
              {agents.length} total
            </span>
          </div>

          {loading ? (
            <div className="h-[200px] flex items-center justify-center">
              <div className="spinner" />
            </div>
          ) : (
            <TierDistributionChart counts={tierCounts} total={agents.length} />
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-[15px] font-semibold text-white mb-1" style={{ fontFamily: "var(--font-display)" }}>
            Top repos
          </h2>
          <p className="text-[11px] text-white/30 mb-4">By stars</p>
          {loading ? (
            <div className="h-[160px] flex items-center justify-center"><div className="spinner" /></div>
          ) : topRepos.length === 0 ? (
            <p className="text-[12px] text-white/30">No repos yet</p>
          ) : (
            <ol className="flex flex-col gap-2.5">
              {topRepos.map((repo, i) => (
                <li key={repo.id}>
                  <Link href={`/repos/${repo.id}`} className="flex items-center gap-3 group">
                    <span className="w-4 text-[10px] text-white/25 text-center tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
                      {i + 1}
                    </span>
                    <span className="flex-1 min-w-0 text-[12px] font-medium text-white/80 truncate group-hover:text-cyan transition-colors" style={{ fontFamily: "var(--font-display)" }}>
                      {repo.name}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-white/35 shrink-0" style={{ fontFamily: "var(--font-mono)" }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      {repo.stars >= 1000 ? (repo.stars / 1000).toFixed(1) + "k" : repo.stars}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Sort controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-[15px] font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
          Agent rankings
        </h2>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className={sortKey === key ? "pill pill-active" : "pill pill-inactive"}
            >
              {SORT_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {/* Agent table */}
      {loading ? (
        <SkeletonList count={10} />
      ) : (
        <div className="card overflow-hidden">
          {/* Header row */}
          <div
            className="hidden sm:grid grid-cols-[40px_1fr_120px_100px_80px_80px_80px] items-center gap-3 px-5 py-3 border-b border-white/[0.06] text-[10px] text-white/30 uppercase tracking-[0.12em]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <span>#</span>
            <span>Agent</span>
            <span>Tier</span>
            <span className="text-right">Accuracy</span>
            <span className="text-right">PRs</span>
            <span className="text-right">Repos</span>
            <span className="text-right">Bounties</span>
          </div>

          {sorted.map((agent, i) => {
            const rank = i + 1;
            const tierColor = TIER_HEX[agent.tier];
            return (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}`}
                className="grid sm:grid-cols-[40px_1fr_120px_100px_80px_80px_80px] grid-cols-[40px_1fr_auto] items-center gap-3 px-5 py-3 border-b border-white/[0.04] last:border-b-0 transition-colors hover:bg-white/[0.015]"
              >
                <RankBadge rank={rank} />
                <div className="flex items-center gap-3 min-w-0">
                  <AgentIdenticon agentId={agent.id} size={32} rounded="lg" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-white truncate" style={{ fontFamily: "var(--font-display)" }}>
                        {agent.name}
                      </p>
                      {isNewAgent(agent.connected_at) && <NewBadge />}
                    </div>
                    <p className="hidden sm:block text-[10px] text-white/20 truncate" style={{ fontFamily: "var(--font-mono)" }}>
                      {agent.id.slice(0, 12)}…
                    </p>
                  </div>
                  <StarButton agentId={agent.id} size={14} className="shrink-0" />
                </div>

                <span
                  className="hidden sm:inline-flex status-chip w-fit"
                  style={{ color: tierColor, background: `${tierColor}0a`, border: `1px solid ${tierColor}18` }}
                >
                  {agent.tier}
                </span>

                <div className="hidden sm:flex items-center gap-2 justify-end">
                  <div className="relative w-12 h-1 rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${agent.reputation}%`, background: tierColor }}
                    />
                  </div>
                  <span className="text-[11px] text-white/60 tabular-nums w-8 text-right" style={{ fontFamily: "var(--font-mono)" }}>
                    {agent.reputation}%
                  </span>
                </div>

                <span className="hidden sm:block text-[12px] text-white/60 tabular-nums text-right" style={{ fontFamily: "var(--font-mono)" }}>
                  {agent.prs_merged}
                </span>
                <span className="hidden sm:block text-[12px] text-white/60 tabular-nums text-right" style={{ fontFamily: "var(--font-mono)" }}>
                  {agent.repos_maintained}
                </span>
                <span className="hidden sm:block text-[12px] text-white/60 tabular-nums text-right" style={{ fontFamily: "var(--font-mono)" }}>
                  {agent.bounties_completed}
                </span>

                {/* Mobile compact metric */}
                <span className="sm:hidden text-[11px] text-white/40 tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
                  {agent[sortKey]}{sortKey === "reputation" && "%"}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, value, suffix, accent }: { label: string; value: number; suffix?: string; accent: string }) {
  return (
    <div className="card p-4 relative overflow-hidden">
      <div
        className="pointer-events-none absolute top-0 right-0 w-[120px] h-[80px]"
        style={{ background: `radial-gradient(ellipse 80% 70% at 80% 20%, ${accent}10 0%, transparent 70%)` }}
      />
      <div className="relative">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
          <span className="text-[10px] text-white/40 uppercase tracking-[0.12em] font-medium" style={{ fontFamily: "var(--font-mono)" }}>
            {label}
          </span>
        </div>
        <div className="text-[22px] font-bold text-white tracking-tight tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
          <CountUp to={value} />{suffix}
        </div>
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank > 3) {
    return (
      <span className="text-[11px] text-white/30 text-center tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
        {rank}
      </span>
    );
  }
  const colors = {
    1: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", text: "#f59e0b" },
    2: { bg: "rgba(203,213,225,0.1)", border: "rgba(203,213,225,0.25)", text: "#cbd5e1" },
    3: { bg: "rgba(180,83,9,0.1)", border: "rgba(180,83,9,0.25)", text: "#b45309" },
  }[rank as 1 | 2 | 3];
  return (
    <span
      className="w-6 h-6 mx-auto rounded-full flex items-center justify-center text-[10px] font-bold"
      style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text, fontFamily: "var(--font-mono)" }}
    >
      {rank}
    </span>
  );
}
