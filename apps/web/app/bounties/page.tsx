"use client";

import { useState, useEffect, useMemo, useCallback, memo } from "react";
import Link from "next/link";
import { fetchBounties } from "@/lib/api";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { StarToggle } from "@/components/ui/StarToggle";
import { useStarred } from "@/lib/hooks/useStarred";
import { useStickyState } from "@/lib/hooks/useStickyState";
import { TimeAgo } from "@/components/ui/TimeAgo";
import type { Bounty } from "@/lib/types/projects";

type SortKey = "recent" | "reward" | "title";
type StatusFilter = "all" | "open" | "claimed" | "completed";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Most recent" },
  { key: "reward", label: "Highest reward" },
  { key: "title", label: "Title (A-Z)" },
];

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "claimed", label: "Claimed" },
  { key: "completed", label: "Completed" },
];

const STATUS_CONFIG: Record<Bounty["status"], { label: string; color: string }> = {
  open: { label: "Open", color: "#22d3ee" },
  claimed: { label: "Claimed", color: "#f7c948" },
  completed: { label: "Completed", color: "#50fa7b" },
};

export default function BountiesPage() {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [statusFilter, setStatusFilter] = useStickyState<StatusFilter>("feeshr:bounties:status", "all");
  const [sort, setSort] = useStickyState<SortKey>("feeshr:bounties:sort", "recent");
  const [search, setSearch] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);
  const { isStarred, count: starredCount } = useStarred("bounties");

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    fetchBounties()
      .then((data) => { setBounties(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const result = bounties.filter((b) => {
      const matchesStatus = statusFilter === "all" || b.status === statusFilter;
      const matchesSearch = !q || b.title.toLowerCase().includes(q) || b.description.toLowerCase().includes(q);
      const matchesStarred = !starredOnly || isStarred(b.id);
      return matchesStatus && matchesSearch && matchesStarred;
    });
    return result.sort((a, b) => {
      switch (sort) {
        case "title": return a.title.localeCompare(b.title);
        case "reward": return b.reward - a.reward;
        case "recent": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [bounties, statusFilter, search, sort, starredOnly, isStarred]);

  const stats = useMemo(() => {
    const open = bounties.filter((b) => b.status === "open");
    const claimed = bounties.filter((b) => b.status === "claimed");
    const completed = bounties.filter((b) => b.status === "completed");
    const totalReward = bounties.reduce((s, b) => s + b.reward, 0);
    const openReward = open.reduce((s, b) => s + b.reward, 0);
    return { open: open.length, claimed: claimed.length, completed: completed.length, totalReward, openReward };
  }, [bounties]);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Bounties</h1>
          {!loading && !error && (
            <span className="page-count">{bounties.length}</span>
          )}
        </div>
      </div>

      {/* Stats summary */}
      {!loading && !error && bounties.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Open" value={stats.open} accent="#22d3ee" />
          <StatCard label="Claimed" value={stats.claimed} accent="#f7c948" />
          <StatCard label="Completed" value={stats.completed} accent="#50fa7b" />
          <StatCard label="Open reward" value={stats.openReward} suffix=" rep" accent="#8b5cf6" />
        </div>
      )}

      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">
            <path d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bounties..."
            aria-label="Search bounties"
            className="search-input"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-white/30 uppercase tracking-[0.1em] shrink-0" style={{ fontFamily: "var(--font-mono)" }}>
            Sort
          </label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort bounties"
            className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] text-white/80 hover:border-white/[0.12] focus:border-cyan/40 focus:outline-none transition-colors cursor-pointer"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {SORT_OPTIONS.map((opt) => <option key={opt.key} value={opt.key} className="bg-[#0B1216]">{opt.label}</option>)}
          </select>
        </div>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(s.key)}
            className={statusFilter === s.key ? "pill pill-active" : "pill pill-inactive"}
          >
            {s.label}
            {s.key !== "all" && bounties.length > 0 && (
              <span className="ml-1.5 opacity-60 text-[10px]">
                {bounties.filter((b) => b.status === s.key).length}
              </span>
            )}
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

      {/* Bounty grid */}
      {loading ? (
        <SkeletonGrid count={6} height={200} />
      ) : error ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/15">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <span className="empty-state-text">Failed to load bounties</span>
          <button onClick={load} className="mt-3 px-4 py-2 rounded-lg bg-cyan/[0.08] border border-cyan/[0.15] text-[12px] text-cyan font-medium hover:bg-cyan/[0.12] transition-colors" style={{ fontFamily: "var(--font-display)" }}>
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/15">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <span className="empty-state-text">
            {search ? `No bounties match "${search}"` : "No bounties found"}
          </span>
          {(search || statusFilter !== "all") && (
            <button
              onClick={() => { setSearch(""); setStatusFilter("all"); }}
              className="mt-3 text-[11px] text-cyan/60 hover:text-cyan transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((bounty) => (
            <BountyCard key={bounty.id} bounty={bounty} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, suffix, accent }: { label: string; value: number; suffix?: string; accent: string }) {
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
        <div className="text-[22px] font-bold text-white tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          {value.toLocaleString()}{suffix}
        </div>
      </div>
    </div>
  );
}

const BountyCard = memo(function BountyCard({ bounty }: { bounty: Bounty }) {
  const status = STATUS_CONFIG[bounty.status];

  return (
    <Link href={`/bounties/${bounty.id}`} className="card-hover p-5 flex flex-col h-[200px] relative overflow-hidden">
      <div
        className="pointer-events-none absolute top-0 right-0 w-[200px] h-[120px]"
        style={{ background: `radial-gradient(ellipse 80% 70% at 80% 20%, ${status.color}06 0%, transparent 70%)` }}
      />

      <div className="relative flex items-start justify-between gap-3 mb-2">
        <h3 className="text-[14px] font-semibold text-white leading-snug line-clamp-2" style={{ fontFamily: "var(--font-display)" }}>
          {bounty.title}
        </h3>
        <div
          className="shrink-0 flex items-baseline gap-0.5 px-2.5 py-1 rounded-lg"
          style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.18)" }}
        >
          <span className="text-[14px] font-bold text-violet-400" style={{ fontFamily: "var(--font-mono)" }}>
            {bounty.reward}
          </span>
          <span className="text-[9px] text-violet-400/60 uppercase tracking-wider">rep</span>
        </div>
      </div>

      <p className="relative text-[12px] text-white/35 line-clamp-2 leading-[1.6]">
        {bounty.description}
      </p>

      <div className="flex-1" />

      <div className="relative border-t border-white/[0.05] pt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="status-chip" style={{ color: status.color, background: `${status.color}0a`, border: `1px solid ${status.color}18` }}>
            {status.label}
          </span>
          {bounty.solver && (
            <span className="text-[10px] text-white/30 truncate max-w-[120px]" style={{ fontFamily: "var(--font-mono)" }}>
              by {bounty.solver}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <TimeAgo iso={bounty.created_at} className="text-[10px] text-white/20" />
          <StarToggle id={bounty.id} kind="bounties" size={13} />
        </div>
      </div>
    </Link>
  );
});
