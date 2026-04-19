"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { fetchIssues, type Issue } from "@/lib/api";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ff6b6b",
  high: "#f7c948",
  medium: "#22d3ee",
  low: "#4a5568",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "#22d3ee" },
  in_progress: { label: "In Progress", color: "#f7c948" },
  resolved: { label: "Resolved", color: "#28c840" },
  wont_fix: { label: "Won't Fix", color: "#6b7280" },
};

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [severityFilter, setSeverityFilter] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    fetchIssues({
      status: statusFilter || undefined,
      severity: severityFilter || undefined,
      limit: 50,
    }).then((data) => {
      setIssues(data.issues);
      setTotal(data.total);
      setLoading(false);
    });
  }, [statusFilter, severityFilter]);

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
              Issues
            </h1>
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-md"
              style={{
                fontFamily: "var(--font-mono)",
                color: "#22d3ee",
                background: "rgba(34,211,238,0.06)",
                border: "1px solid rgba(34,211,238,0.1)",
              }}
            >
              {total}
            </span>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-[12px] text-secondary bg-surface border border-border outline-none"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="wont_fix">Won&apos;t Fix</option>
            </select>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-[12px] text-secondary bg-surface border border-border outline-none"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <option value="">All severity</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 border-2 border-[rgba(34,211,238,0.2)] border-t-cyan rounded-full animate-spin" />
          </div>
        ) : issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-[#2a3040]">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-[13px] text-muted" style={{ fontFamily: "var(--font-body)" }}>
              No issues found
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {issues.map((issue) => {
              const sevColor = SEVERITY_COLORS[issue.severity] ?? "#4a5568";
              const statusInfo = STATUS_LABELS[issue.status] ?? STATUS_LABELS.open;
              return (
                <Link
                  key={issue.id}
                  href={`/issues/${issue.id}`}
                  className="group flex items-start gap-3 px-5 py-4 rounded-xl transition-all duration-200 hover:bg-[rgba(255,255,255,0.02)]"
                  style={{
                    border: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  {/* Severity dot */}
                  <span
                    className="shrink-0 mt-1.5 w-[7px] h-[7px] rounded-full"
                    style={{
                      backgroundColor: sevColor,
                      boxShadow: `0 0 6px ${sevColor}50`,
                    }}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[14px] text-primary font-medium truncate group-hover:text-cyan transition-colors"
                        style={{ fontFamily: "var(--font-body)" }}
                      >
                        {issue.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted" style={{ fontFamily: "var(--font-mono)" }}>
                      {issue.repo_name && <span>{issue.repo_name}</span>}
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
                      <span className="uppercase tracking-wider" style={{ color: sevColor }}>
                        {issue.severity}
                      </span>
                      <span className="text-[#2a3040]">
                        {new Date(issue.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
