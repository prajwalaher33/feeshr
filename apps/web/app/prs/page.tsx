"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchAllPRs, type PullRequestDetail } from "@/lib/api";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useStickyState } from "@/lib/hooks/useStickyState";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "#22d3ee" },
  reviewing: { label: "Reviewing", color: "#6366f1" },
  approved: { label: "Approved", color: "#28c840" },
  changes_requested: { label: "Changes Requested", color: "#f7c948" },
  merged: { label: "Merged", color: "#8b5cf6" },
  rejected: { label: "Rejected", color: "#ff6b6b" },
  closed: { label: "Closed", color: "#6b7280" },
};

const CI_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "#6b7280" },
  running: { label: "Running", color: "#f7c948" },
  passed: { label: "Passed", color: "#28c840" },
  failed: { label: "Failed", color: "#ff6b6b" },
};

type SortKey = "newest" | "oldest" | "biggest" | "reviews" | "title";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "biggest", label: "Biggest diff" },
  { key: "reviews", label: "Most reviews" },
  { key: "title", label: "Title (A-Z)" },
];

export default function PRsPage() {
  const [prs, setPrs] = useState<(PullRequestDetail & { repo_name?: string })[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [statusFilter, setStatusFilter] = useStickyState<string>("feeshr:prs:status", "");
  const [sort, setSort] = useStickyState<SortKey>("feeshr:prs:sort", "newest");
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    fetchAllPRs({
      status: statusFilter || undefined,
      limit: 50,
    })
      .then((data) => { setPrs(data.pull_requests); setTotal(data.total); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = q
      ? prs.filter((p) => p.title.toLowerCase().includes(q) || (p.repo_name ?? "").toLowerCase().includes(q))
      : prs;
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "title": return a.title.localeCompare(b.title);
        case "biggest": return (b.additions + b.deletions) - (a.additions + a.deletions);
        case "reviews": return b.review_count - a.review_count;
        case "oldest": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "newest": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [prs, search, sort]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Pull Requests</h1>
          <span className="page-count" style={{ color: "#8b5cf6", background: "rgba(139,92,246,0.06)", borderColor: "rgba(139,92,246,0.12)" }}>
            {total}
          </span>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="reviewing">Reviewing</option>
          <option value="approved">Approved</option>
          <option value="merged">Merged</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

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
            placeholder="Search pull requests..."
            aria-label="Search pull requests"
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
            aria-label="Sort pull requests"
            className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] text-white/80 hover:border-white/[0.12] focus:border-cyan/40 focus:outline-none transition-colors cursor-pointer"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {SORT_OPTIONS.map((opt) => <option key={opt.key} value={opt.key} className="bg-[#000]">{opt.label}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <SkeletonList count={8} />
      ) : error ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/15">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <span className="empty-state-text">Failed to load pull requests</span>
          <button onClick={load} className="mt-3 px-4 py-2 rounded-lg bg-cyan/[0.08] border border-cyan/[0.15] text-[12px] text-cyan font-medium hover:bg-cyan/[0.12] transition-colors" style={{ fontFamily: "var(--font-display)" }}>
            Try again
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/15">
              <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" />
              <path d="M13 6h3a2 2 0 0 1 2 2v7" /><path d="M6 9v12" />
            </svg>
          </div>
          <span className="empty-state-text">
            {search ? `No PRs match "${search}"` : "No pull requests found"}
          </span>
          {(search || statusFilter) && (
            <button
              onClick={() => { setSearch(""); setStatusFilter(""); }}
              className="mt-3 text-[11px] text-cyan/60 hover:text-cyan transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {visible.map((pr) => {
            const statusInfo = STATUS_CONFIG[pr.status] ?? STATUS_CONFIG.open;
            const ciInfo = CI_CONFIG[pr.ci_status] ?? CI_CONFIG.pending;
            return (
              <div key={pr.id} className="list-row">
                <span
                  className="shrink-0 mt-1.5 w-2 h-2 rounded-full"
                  style={{ backgroundColor: statusInfo.color, boxShadow: `0 0 6px ${statusInfo.color}40` }}
                />
                <div className="flex-1 min-w-0">
                  <span className="list-row-title truncate block">{pr.title}</span>
                  <div className="list-row-meta">
                    {pr.repo_name && <span>{pr.repo_name}</span>}
                    <span className="status-chip" style={{ color: statusInfo.color, background: `${statusInfo.color}0a`, border: `1px solid ${statusInfo.color}18` }}>
                      {statusInfo.label}
                    </span>
                    <span className="status-chip" style={{ color: ciInfo.color, background: `${ciInfo.color}0a`, border: `1px solid ${ciInfo.color}18` }}>
                      CI: {ciInfo.label}
                    </span>
                    <span className="text-[#28c840]">+{pr.additions}</span>
                    <span className="text-[#ff6b6b]">-{pr.deletions}</span>
                    <span>{pr.files_changed} files</span>
                    {pr.review_count > 0 && (
                      <span>{pr.review_count} review{pr.review_count !== 1 ? "s" : ""}</span>
                    )}
                    {pr.merged_by === "governance/auto-merge" && (
                      <span className="status-chip" style={{ color: "#8b5cf6", background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.12)" }}>
                        Auto-merged
                      </span>
                    )}
                    <span className="text-white/12 ml-auto">
                      {pr.source_branch} → {pr.target_branch}
                    </span>
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
