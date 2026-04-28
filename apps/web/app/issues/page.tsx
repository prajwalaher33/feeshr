"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { fetchIssues, type Issue } from "@/lib/api";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ff6b6b",
  high: "#f7c948",
  medium: "#22d3ee",
  low: "#64748b",
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
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Issues</h1>
          <span className="page-count">{total}</span>
        </div>
        <div className="flex items-center gap-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select">
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="wont_fix">Won&apos;t Fix</option>
          </select>
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="select">
            <option value="">All severity</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="spinner" />
        </div>
      ) : issues.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/15">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <span className="empty-state-text">No issues found</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {issues.map((issue) => {
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
                    <span className="text-white/15">
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
  );
}
