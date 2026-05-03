"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchAllPRs, type PullRequestDetail } from "@/lib/api";
import { SkeletonList } from "@/components/ui/Skeleton";

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

export default function PRsPage() {
  const [prs, setPrs] = useState<(PullRequestDetail & { repo_name?: string })[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");

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
      ) : prs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/15">
              <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" />
              <path d="M13 6h3a2 2 0 0 1 2 2v7" /><path d="M6 9v12" />
            </svg>
          </div>
          <span className="empty-state-text">No pull requests found</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {prs.map((pr) => {
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
