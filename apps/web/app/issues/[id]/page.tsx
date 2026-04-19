"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchIssue, type Issue } from "@/lib/api";

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

export default function IssueDetailPage() {
  const params = useParams();
  const id = params?.id as string;
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-5 h-5 border-2 border-[rgba(34,211,238,0.2)] border-t-cyan rounded-full animate-spin" />
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <span className="text-[14px] text-muted" style={{ fontFamily: "var(--font-body)" }}>
          Issue not found
        </span>
        <Link href="/issues" className="text-[13px] text-cyan hover:underline">
          Back to issues
        </Link>
      </div>
    );
  }

  const sevColor = SEVERITY_COLORS[issue.severity] ?? "#4a5568";
  const statusInfo = STATUS_LABELS[issue.status] ?? STATUS_LABELS.open;

  return (
    <div className="px-[118px] pt-10 pb-20 max-[1024px]:px-6 max-[768px]:px-4">
      <div className="max-w-[860px] mx-auto flex flex-col gap-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[12px] text-muted" style={{ fontFamily: "var(--font-mono)" }}>
          <Link href="/issues" className="hover:text-cyan transition-colors">Issues</Link>
          <span className="text-[#2a3040]">/</span>
          <span className="text-secondary truncate">{issue.title}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <span
              className="shrink-0 mt-2 w-[9px] h-[9px] rounded-full"
              style={{
                backgroundColor: sevColor,
                boxShadow: `0 0 8px ${sevColor}60, 0 0 16px ${sevColor}20`,
              }}
            />
            <h1
              className="text-[24px] font-bold text-primary leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {issue.title}
            </h1>
          </div>

          <div className="flex items-center gap-3 pl-6">
            <span
              className="px-2.5 py-1 rounded-md text-[11px] font-semibold"
              style={{
                fontFamily: "var(--font-mono)",
                color: statusInfo.color,
                background: `${statusInfo.color}10`,
                border: `1px solid ${statusInfo.color}25`,
                boxShadow: `0 0 8px ${statusInfo.color}10`,
              }}
            >
              {statusInfo.label}
            </span>
            <span
              className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold"
              style={{
                fontFamily: "var(--font-mono)",
                color: sevColor,
                background: `${sevColor}10`,
                border: `1px solid ${sevColor}20`,
              }}
            >
              {issue.severity}
            </span>
            {issue.repo_name && (
              <Link
                href={`/repos/${issue.repo_id}`}
                className="text-[11px] text-muted hover:text-cyan transition-colors"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {issue.repo_name}
              </Link>
            )}
            <span className="text-[11px] text-[#2a3040]" style={{ fontFamily: "var(--font-mono)" }}>
              opened {new Date(issue.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Body */}
        <div
          className="rounded-xl p-6"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.008))",
            border: "1px solid rgba(255,255,255,0.05)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.02)",
          }}
        >
          <p
            className="text-[14px] text-secondary leading-relaxed whitespace-pre-wrap"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {issue.body}
          </p>
        </div>

        {/* Meta */}
        <div
          className="flex items-center gap-6 px-4 py-3 rounded-lg text-[11px] text-muted"
          style={{
            fontFamily: "var(--font-mono)",
            background: "rgba(255,255,255,0.015)",
            border: "1px solid rgba(255,255,255,0.03)",
          }}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[#3a4250]">Author:</span>
            <span className="text-secondary">{issue.author_id.slice(0, 12)}</span>
          </div>
          {issue.resolved_by_pr && (
            <div className="flex items-center gap-1.5">
              <span className="text-[#3a4250]">Resolved by:</span>
              <span className="text-[#28c840]">PR {issue.resolved_by_pr.slice(0, 8)}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[#3a4250]">Updated:</span>
            <span>{new Date(issue.updated_at).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
