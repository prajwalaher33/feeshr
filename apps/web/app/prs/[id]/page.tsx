"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import {
  fetchPullRequest,
  fetchRepoDiff,
  type PullRequestPage,
  type RepoDiff,
} from "@/lib/api";
import { DiffView } from "@/components/prs/DiffView";
import { SkeletonList } from "@/components/ui/Skeleton";

const STATUS_COLOR: Record<string, string> = {
  open: "#22d3ee",
  reviewing: "#6366f1",
  approved: "#28c840",
  changes_requested: "#f7c948",
  merged: "#8b5cf6",
  rejected: "#ff6b6b",
  closed: "#6b7280",
};

const VERDICT_COLOR: Record<string, string> = {
  approve: "#28c840",
  request_changes: "#f7c948",
  reject: "#ff6b6b",
};

export default function PullRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [pr, setPr] = useState<PullRequestPage | null>(null);
  const [diff, setDiff] = useState<RepoDiff | null>(null);
  const [loading, setLoading] = useState(true);
  const [diffLoading, setDiffLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await fetchPullRequest(id);
    if (!data) {
      setError("Pull request not found");
      setLoading(false);
      return;
    }
    setPr(data);
    setLoading(false);

    // Diff is best-effort: if the bare repo doesn't have the branches
    // (common in mock/seeded data) we just show the metadata view.
    const { repo_id, source_branch, target_branch } = data.pull_request;
    if (repo_id && source_branch && target_branch) {
      setDiffLoading(true);
      const d = await fetchRepoDiff(repo_id, target_branch, source_branch);
      setDiff(d);
      setDiffLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="page-container">
        <SkeletonList count={6} />
      </div>
    );
  }

  if (error || !pr) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <span className="empty-state-text">{error ?? "Failed to load"}</span>
          <Link
            href="/prs"
            className="mt-3 text-[12px] text-cyan/70 hover:text-cyan transition-colors"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            ← Back to all PRs
          </Link>
        </div>
      </div>
    );
  }

  const p = pr.pull_request;
  const statusColor = STATUS_COLOR[p.status] ?? STATUS_COLOR.open;

  return (
    <div className="page-container">
      <div className="mb-4">
        <Link
          href="/prs"
          className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          ← All pull requests
        </Link>
      </div>

      <div className="card p-5 mb-5">
        <div className="flex items-start gap-3 mb-3">
          <span
            className="shrink-0 mt-2 w-2 h-2 rounded-full"
            style={{ backgroundColor: statusColor, boxShadow: `0 0 6px ${statusColor}40` }}
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-[20px] text-white/90 font-medium leading-tight">
              {p.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/50" style={{ fontFamily: "var(--font-mono)" }}>
              <span
                className="status-chip"
                style={{
                  color: statusColor,
                  background: `${statusColor}0a`,
                  border: `1px solid ${statusColor}18`,
                }}
              >
                {p.status}
              </span>
              <span>by {p.author_id.slice(0, 12)}</span>
              {p.repo_name && <span>in {p.repo_name}</span>}
              <span className="text-white/30">
                {p.source_branch} → {p.target_branch}
              </span>
              <span className="text-[#28c840]">+{p.additions}</span>
              <span className="text-[#ff6b6b]">-{p.deletions}</span>
              <span>{p.files_changed} files</span>
            </div>
          </div>
        </div>
        {p.description && (
          <p className="text-[13px] text-white/70 leading-relaxed whitespace-pre-wrap">
            {p.description}
          </p>
        )}
      </div>

      {pr.assigned_reviewers.length > 0 && (
        <div className="card p-4 mb-5">
          <div className="text-[11px] text-white/40 uppercase tracking-[0.1em] mb-2" style={{ fontFamily: "var(--font-mono)" }}>
            Assigned reviewers
          </div>
          <div className="flex flex-wrap gap-2">
            {pr.assigned_reviewers.map((r) => (
              <span
                key={r.reviewer_id}
                className="status-chip text-[12px]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {r.display_name ?? r.reviewer_id.slice(0, 12)}
              </span>
            ))}
          </div>
        </div>
      )}

      {pr.reviews.length > 0 && (
        <div className="mb-5">
          <h2 className="text-[12px] text-white/40 uppercase tracking-[0.1em] mb-3" style={{ fontFamily: "var(--font-mono)" }}>
            Reviews ({pr.reviews.length})
          </h2>
          <div className="flex flex-col gap-3">
            {pr.reviews.map((r) => {
              const c = VERDICT_COLOR[r.verdict] ?? "#6b7280";
              return (
                <div key={r.id} className="card p-4">
                  <div className="flex items-center gap-2 mb-2 text-[11px]" style={{ fontFamily: "var(--font-mono)" }}>
                    <span
                      className="status-chip"
                      style={{
                        color: c,
                        background: `${c}0a`,
                        border: `1px solid ${c}18`,
                      }}
                    >
                      {r.verdict}
                    </span>
                    <span className="text-white/50">{r.reviewer_id.slice(0, 12)}</span>
                    <span className="text-white/30 ml-auto">
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[13px] text-white/80 leading-relaxed whitespace-pre-wrap">
                    {r.comment}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-[12px] text-white/40 uppercase tracking-[0.1em] mb-3" style={{ fontFamily: "var(--font-mono)" }}>
          Diff
        </h2>
        {diffLoading ? (
          <SkeletonList count={3} />
        ) : diff ? (
          <DiffView diff={diff} />
        ) : (
          <div className="empty-state">
            <span className="empty-state-text">
              Diff unavailable — branches not found on git-server
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
