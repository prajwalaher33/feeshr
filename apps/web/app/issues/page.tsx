"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { fetchIssues, type Issue } from "@/lib/api";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { useStickyState } from "@/lib/hooks/useStickyState";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ff6b6b",
  high: "#f7c948",
  medium: "#22d3ee",
  low: "#64748b",
};

const SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "#22d3ee" },
  in_progress: { label: "In Progress", color: "#f7c948" },
  resolved: { label: "Resolved", color: "#28c840" },
  wont_fix: { label: "Won't Fix", color: "#6b7280" },
};

type SortKey = "newest" | "oldest" | "severity" | "title";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "severity", label: "Severity (high → low)" },
  { key: "title", label: "Title (A-Z)" },
];

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [statusFilter, setStatusFilter] = useStickyState<string>("feeshr:issues:status", "open");
  const [severityFilter, setSeverityFilter] = useStickyState<string>("feeshr:issues:severity", "");
  const [sort, setSort] = useStickyState<SortKey>("feeshr:issues:sort", "newest");
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    fetchIssues({
      status: statusFilter || undefined,
      severity: severityFilter || undefined,
      limit: 50,
    })
      .then((data) => { setIssues(data.issues); setTotal(data.total); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [statusFilter, severityFilter]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = q ? issues.filter((i) => i.title.toLowerCase().includes(q) || (i.repo_name ?? "").toLowerCase().includes(q)) : issues;
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "title": return a.title.localeCompare(b.title);
        case "severity": return (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0);
        case "oldest": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "newest": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [issues, search, sort]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Issues</h1>
          <span className="page-count">{total}</span>
        </div>
        <div className="flex items-center gap-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select" aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="wont_fix">Won&apos;t Fix</option>
          </select>
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="select" aria-label="Filter by severity">
            <option value="">All severity</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
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
            placeholder="Search issues..."
            aria-label="Search issues"
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
            aria-label="Sort issues"
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
          <span className="empty-state-text">Failed to load issues</span>
          <button onClick={load} className="mt-3 px-4 py-2 rounded-lg bg-cyan/[0.08] border border-cyan/[0.15] text-[12px] text-cyan font-medium hover:bg-cyan/[0.12] transition-colors" style={{ fontFamily: "var(--font-display)" }}>
            Try again
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/15">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <span className="empty-state-text">
            {search ? `No issues match "${search}"` : "No issues found"}
          </span>
          {(search || severityFilter || statusFilter !== "open") && (
            <button
              onClick={() => { setSearch(""); setSeverityFilter(""); setStatusFilter("open"); }}
              className="mt-3 text-[11px] text-cyan/60 hover:text-cyan transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {visible.map((issue) => {
            const sevColor = SEVERITY_COLORS[issue.severity] ?? "#64748b";
            const statusInfo = STATUS_LABELS[issue.status] ?? STATUS_LABELS.open;
            return (
              <Link key={issue.id} href={`/issues/${issue.id}`} className="list-row group">
                <span
                  className="shrink-0 mt-1.5 w-[7px] h-[7px] rounded-full"
                  style={{ backgroundColor: sevColor, boxShadow: `0 0 6px ${sevColor}40` }}
                />
                <div className="flex-1 min-w-0">
                  <span className="list-row-title truncate block">{issue.title}</span>
                  <div className="list-row-meta">
                    {issue.repo_name && <span>{issue.repo_name}</span>}
                    <span className="status-chip" style={{ color: statusInfo.color, background: `${statusInfo.color}0a`, border: `1px solid ${statusInfo.color}18` }}>
                      {statusInfo.label}
                    </span>
                    <span className="uppercase tracking-wider text-[10px]" style={{ color: sevColor }}>
                      {issue.severity}
                    </span>
                    <TimeAgo iso={issue.created_at} className="text-white/15" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
