"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchIssue, type Issue } from "@/lib/api";

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

export default function IssueDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchIssue(id).then((data) => {
      setIssue(data);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="empty-state" style={{ minHeight: "60vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="empty-state" style={{ minHeight: "60vh" }}>
        <div className="empty-state-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/15">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <span className="empty-state-text">Issue not found</span>
        <Link href="/issues" className="text-[12px] text-cyan/60 hover:text-cyan transition-colors mt-2">Back to issues</Link>
      </div>
    );
  }

  const sevColor = SEVERITY_COLORS[issue.severity] ?? "#64748b";
  const statusInfo = STATUS_LABELS[issue.status] ?? STATUS_LABELS.open;

  return (
    <div className="page-container" style={{ maxWidth: 920 }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px] text-white/25 mb-6" style={{ fontFamily: "var(--font-mono)" }}>
        <Link href="/issues" className="hover:text-cyan transition-colors">Issues</Link>
        <span className="text-white/10">/</span>
        <span className="text-white/50 truncate">{issue.title}</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start gap-3 mb-3">
          <span
            className="shrink-0 mt-2.5 w-2 h-2 rounded-full"
            style={{
              backgroundColor: sevColor,
              boxShadow: `0 0 8px ${sevColor}50`,
            }}
          />
          <h1
            className="text-[22px] font-bold text-white leading-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {issue.title}
          </h1>
        </div>

        <div className="flex items-center gap-2.5 ml-5">
          <span className="status-chip" style={{ color: statusInfo.color, background: `${statusInfo.color}0a`, border: `1px solid ${statusInfo.color}18` }}>
            {statusInfo.label}
          </span>
          <span
            className="text-[10px] uppercase tracking-wider font-semibold"
            style={{ fontFamily: "var(--font-mono)", color: sevColor }}
          >
            {issue.severity}
          </span>
          {issue.repo_name && (
            <Link
              href={`/repos/${issue.repo_id}`}
              className="text-[11px] text-white/25 hover:text-cyan transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {issue.repo_name}
            </Link>
          )}
          <span className="text-[11px] text-white/15" style={{ fontFamily: "var(--font-mono)" }}>
            opened {new Date(issue.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="card p-6 mb-4">
        <p className="text-[13px] text-white/45 leading-[1.9] whitespace-pre-wrap">
          {issue.body}
        </p>
      </div>

      {/* Meta */}
      <div className="card px-5 py-3.5 flex items-center gap-6 text-[11px] text-white/20" style={{ fontFamily: "var(--font-mono)" }}>
        <div className="flex items-center gap-1.5">
          <span className="text-white/12">Author</span>
          <span className="text-white/40">{issue.author_id.slice(0, 12)}</span>
        </div>
        {issue.resolved_by_pr && (
          <div className="flex items-center gap-1.5">
            <span className="text-white/12">Resolved by</span>
            <span className="text-[#28c840]/70">PR {issue.resolved_by_pr.slice(0, 8)}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-white/12">Updated</span>
          <span>{new Date(issue.updated_at).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
