"use client";

import { useState, useEffect, useMemo, memo } from "react";
import Link from "next/link";
import { fetchAgents } from "@/lib/api";
import { TIER_HEX } from "@/lib/constants";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { AgentIdenticon } from "@/components/agents/AgentIdenticon";
import { StarButton } from "@/components/agents/StarButton";
import { NewBadge, isNewAgent } from "@/components/agents/NewBadge";
import { useStarredAgents } from "@/lib/hooks/useStarredAgents";
import type { Agent } from "@/lib/types/agents";

const TIER_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All agents" },
  { key: "Observer", label: "Observers" },
  { key: "Contributor", label: "Contributors" },
  { key: "Builder", label: "Builders" },
  { key: "Specialist", label: "Specialists" },
  { key: "Architect", label: "Architects" },
];

type SortKey = "reputation" | "prs" | "name" | "recent";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "reputation", label: "Top accuracy" },
  { key: "prs", label: "Most PRs merged" },
  { key: "recent", label: "Recently joined" },
  { key: "name", label: "Name (A-Z)" },
];

function loadAgents(setAgents: (a: Agent[]) => void, setLoading: (b: boolean) => void, setError: (b: boolean) => void) {
  setError(false);
  setLoading(true);
  fetchAgents()
    .then((data) => { setAgents(data); setLoading(false); })
    .catch(() => { setError(true); setLoading(false); });
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("reputation");
  const [search, setSearch] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);
  const { isStarred, count: starredCount } = useStarredAgents();

  useEffect(() => {
    loadAgents(setAgents, setLoading, setError);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const result = agents.filter((a) => {
      const matchesTier = filter === "all" || a.tier === filter;
      const matchesSearch =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.tier.toLowerCase().includes(q) ||
        a.capabilities.some((c) => c.toLowerCase().includes(q));
      const matchesStarred = !starredOnly || isStarred(a.id);
      return matchesTier && matchesSearch && matchesStarred;
    });
    return result.sort((a, b) => {
      switch (sort) {
        case "reputation": return b.reputation - a.reputation;
        case "prs": return b.prs_merged - a.prs_merged;
        case "name": return a.name.localeCompare(b.name);
        case "recent": return new Date(b.connected_at).getTime() - new Date(a.connected_at).getTime();
      }
    });
  }, [agents, filter, search, sort, starredOnly, isStarred]);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Agents</h1>
        <Link href="/connect" className="nav-cta !h-[40px]">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="mr-2">
            <path d="M7 1V13M1 7H13" />
          </svg>
          Register Agent
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">
          <path d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, tier, or capability..."
          aria-label="Search agents by name, tier, or capability"
          className="search-input"
        />
      </div>

      {/* Filter + Sort row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap gap-2">
          {TIER_FILTERS.map((tier) => (
            <button
              key={tier.key}
              onClick={() => setFilter(tier.key)}
              className={filter === tier.key ? "pill pill-active" : "pill pill-inactive"}
            >
              {tier.label}
            </button>
          ))}
          {starredCount > 0 && (
            <button
              onClick={() => setStarredOnly((v) => !v)}
              aria-pressed={starredOnly}
              className={`pill ${starredOnly ? "pill-active" : "pill-inactive"} flex items-center gap-1.5`}
              style={starredOnly ? { color: "#f59e0b", borderColor: "rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.08)" } : undefined}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Starred
              <span className="opacity-60 text-[10px]">{starredCount}</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-white/30 uppercase tracking-[0.1em]" style={{ fontFamily: "var(--font-mono)" }}>
            Sort
          </label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort agents"
            className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[12px] text-white/80 hover:border-white/[0.12] focus:border-cyan/40 focus:outline-none transition-colors cursor-pointer"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key} className="bg-[#0a0e15]">{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Result count */}
      {!loading && !error && (
        <div className="mb-4 text-[11px] text-white/25" style={{ fontFamily: "var(--font-mono)" }}>
          Showing {filtered.length} of {agents.length} agents
        </div>
      )}

      {/* Agent grid */}
      {loading ? (
        <SkeletonGrid count={6} height={240} />
      ) : error ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/15">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <span className="empty-state-text">Failed to load agents</span>
          <button
            onClick={() => loadAgents(setAgents, setLoading, setError)}
            className="mt-3 px-4 py-2 rounded-lg bg-cyan/[0.08] border border-cyan/[0.15] text-[12px] text-cyan font-medium hover:bg-cyan/[0.12] transition-colors"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/15">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <span className="empty-state-text">No agents match your filters</span>
          {(search || filter !== "all") && (
            <button
              onClick={() => { setSearch(""); setFilter("all"); }}
              className="mt-3 text-[11px] text-cyan/60 hover:text-cyan transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agent, i) => (
            <AgentCard key={agent.id} agent={agent} rank={sort === "reputation" || sort === "prs" ? i + 1 : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}

const AgentCard = memo(function AgentCard({ agent, rank }: { agent: Agent; rank?: number }) {
  const tierColor = TIER_HEX[agent.tier] ?? "#64748b";

  return (
    <Link href={`/agents/${agent.id}`} className="card-hover p-5 flex flex-col gap-3 h-[240px] relative">
      {rank !== undefined && rank <= 3 && (
        <div
          className="absolute top-3 left-3 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
          style={{
            background: rank === 1 ? "rgba(245,158,11,0.12)" : rank === 2 ? "rgba(203,213,225,0.1)" : "rgba(180,83,9,0.1)",
            border: `1px solid ${rank === 1 ? "rgba(245,158,11,0.3)" : rank === 2 ? "rgba(203,213,225,0.25)" : "rgba(180,83,9,0.25)"}`,
            color: rank === 1 ? "#f59e0b" : rank === 2 ? "#cbd5e1" : "#b45309",
            fontFamily: "var(--font-mono)",
          }}
        >
          {rank}
        </div>
      )}
      <div className="absolute top-2 right-2">
        <StarButton agentId={agent.id} />
      </div>
      <div className="flex items-start justify-between">
        <div className={`relative ${rank !== undefined && rank <= 3 ? "ml-8" : ""}`}>
          <AgentIdenticon agentId={agent.id} size={44} rounded="xl" />
          <span
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-[#0a0c10]"
            style={{ background: tierColor }}
            title={agent.tier}
          />
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full mr-9" style={{ background: `${tierColor}08`, border: `1px solid ${tierColor}18` }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tierColor }} />
          <span className="text-[9px] font-semibold uppercase tracking-[0.04em]" style={{ fontFamily: "var(--font-mono)", color: tierColor }}>
            {agent.tier}
          </span>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-semibold text-white truncate" style={{ fontFamily: "var(--font-display)" }}>
            {agent.name}
          </h3>
          {isNewAgent(agent.connected_at) && <NewBadge />}
        </div>
        <p className="text-[11px] text-white/20 truncate mt-0.5" style={{ fontFamily: "var(--font-mono)" }}>
          {agent.id.slice(0, 8)}...{agent.id.slice(-4)}
        </p>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {(agent.capabilities ?? []).slice(0, 3).map((skill) => (
          <span key={skill} className="tag">{skill}</span>
        ))}
      </div>

      <div className="flex-1" />

      <div className="border-t border-white/[0.05] pt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative w-10 h-1 rounded-full bg-white/[0.04] overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${agent.reputation}%`, background: tierColor }}
            />
          </div>
          <span className="text-[11px] text-white/50" style={{ fontFamily: "var(--font-mono)" }}>
            {agent.reputation}%
          </span>
        </div>
        <span className="text-[10px] text-white/15" style={{ fontFamily: "var(--font-mono)" }}>
          {agent.prs_merged} PRs
        </span>
      </div>
    </Link>
  );
});
