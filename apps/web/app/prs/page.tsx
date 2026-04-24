"use client";

import { useState, useEffect } from "react";
import { fetchAllPRs, type PullRequestDetail } from "@/lib/api";

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
  const [statusFilter, setStatusFilter] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    fetchAllPRs({
      status: statusFilter || undefined,
      limit: 50,
    }).then((data) => {
      setPrs(data.pull_requests);
      setTotal(data.total);
      setLoading(false);
    });
  }, [statusFilter]);

  return (
    <div className="px-[118px] pt-10 pb-20 max-[1024px]:px-6 max-[768px]:px-4">
      <div className="max-w-[1203px] mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between max-[768px]:flex-col max-[768px]:items-start max-[768px]:gap-4">
          <div className="flex items-center gap-3">
            <h1
              className="text-[22px] font-bold text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Pull Requests
            </h1>
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-md"
              style={{
                fontFamily: "var(--font-mono)",
                color: "#8b5cf6",
                background: "rgba(139,92,246,0.06)",
                border: "1px solid rgba(139,92,246,0.1)",
              }}
            >
              {total}
            </span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-[12px] text-secondary bg-surface border border-border outline-none"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="reviewing">Reviewing</option>
            <option value="approved">Approved</option>
            <option value="merged">Merged</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 border-2 border-[rgba(139,92,246,0.2)] border-t-[#8b5cf6] rounded-full animate-spin" />
          </div>
        ) : prs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-[#2a3040]">
              <circle cx="12" cy="12" r="4" />
              <line x1="1.05" y1="12" x2="7" y2="12" />
              <line x1="17.01" y1="12" x2="22.96" y2="12" />
            </svg>
            <span className="text-[13px] text-muted" style={{ fontFamily: "var(--font-body)" }}>
              No pull requests found
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {prs.map((pr) => {
              const statusInfo = STATUS_CONFIG[pr.status] ?? STATUS_CONFIG.open;
              const ciInfo = CI_CONFIG[pr.ci_status] ?? CI_CONFIG.pending;
              return (
                <div
                  key={pr.id}
                  className="group flex items-start gap-3 px-5 py-4 rounded-xl transition-all duration-200 hover:bg-[rgba(255,255,255,0.02)]"
                  style={{ border: "1px solid rgba(255,255,255,0.04)" }}
                >
                  {/* Status icon */}
                  <span
                    className="shrink-0 mt-1 w-[8px] h-[8px] rounded-full"
                    style={{
                      backgroundColor: statusInfo.color,
                      boxShadow: `0 0 6px ${statusInfo.color}50`,
                    }}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[14px] text-primary font-medium truncate"
                        style={{ fontFamily: "var(--font-body)" }}
                      >
                        {pr.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted" style={{ fontFamily: "var(--font-mono)" }}>
                      {pr.repo_name && <span>{pr.repo_name}</span>}
                      <span
                        className="px-1.5 py-0.5 rounded"
                        style={{
                          color: statusInfo.color,
                          background: `${statusInfo.color}10`,
                          border: `1px solid ${statusInfo.color}20`,
                        }}
                      >
                        {statusInfo.label}
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded"
                        style={{
                          color: ciInfo.color,
                          background: `${ciInfo.color}10`,
                          border: `1px solid ${ciInfo.color}20`,
                        }}
                      >
                        CI: {ciInfo.label}
                      </span>
                      <span className="text-[#28c840]">+{pr.additions}</span>
                      <span className="text-[#ff6b6b]">-{pr.deletions}</span>
                      <span>{pr.files_changed} files</span>
                      {pr.review_count > 0 && (
                        <span>{pr.review_count} review{pr.review_count !== 1 ? "s" : ""}</span>
                      )}
                      {pr.merged_by === "governance/auto-merge" && (
                        <span
                          className="px-1.5 py-0.5 rounded"
                          style={{
                            color: "#8b5cf6",
                            background: "rgba(139,92,246,0.08)",
                            border: "1px solid rgba(139,92,246,0.15)",
                          }}
                        >
                          Auto-merged
                        </span>
                      )}
                      <span className="text-[#2a3040] ml-auto">
                        {pr.source_branch} {">"} {pr.target_branch}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
