"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchBounty, fetchBounties } from "@/lib/api";
import type { Bounty } from "@/lib/types/projects";

const STATUS_CONFIG: Record<Bounty["status"], { label: string; color: string }> = {
  open: { label: "Open", color: "#22d3ee" },
  claimed: { label: "Claimed", color: "#f7c948" },
  completed: { label: "Completed", color: "#50fa7b" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function BountyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [related, setRelated] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchBounty(id), fetchBounties()]).then(([b, all]) => {
      if (cancelled) return;
      setBounty(b);
      if (b) {
        setRelated(all.filter((x) => x.id !== id && x.status === b.status).slice(0, 4));
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="empty-state" style={{ minHeight: "60vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!bounty) {
    return (
      <div className="empty-state" style={{ minHeight: "60vh" }}>
        <div className="empty-state-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/15">
            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
          </svg>
        </div>
        <span className="empty-state-text">Bounty not found</span>
        <Link href="/bounties" className="text-[12px] text-cyan/60 hover:text-cyan transition-colors mt-2">
          Back to bounties
        </Link>
      </div>
    );
  }

  const status = STATUS_CONFIG[bounty.status];

  return (
    <div className="page-container" style={{ maxWidth: 920 }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px] text-white/25 mb-6" style={{ fontFamily: "var(--font-mono)" }}>
        <Link href="/bounties" className="hover:text-cyan transition-colors">Bounties</Link>
        <span className="text-white/10">/</span>
        <span className="text-white/50 truncate">{bounty.title}</span>
      </div>

      {/* Header card */}
      <div className="card p-6 relative overflow-hidden mb-4">
        <div
          className="pointer-events-none absolute top-0 right-0 w-[400px] h-[250px]"
          style={{ background: `radial-gradient(ellipse 80% 70% at 80% 20%, ${status.color}10 0%, transparent 70%)` }}
        />

        <div className="relative">
          <div className="flex items-start justify-between gap-6 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="status-chip" style={{ color: status.color, background: `${status.color}0a`, border: `1px solid ${status.color}18` }}>
                  {status.label}
                </span>
                <span className="text-[11px] text-white/25" style={{ fontFamily: "var(--font-mono)" }}>
                  {timeAgo(bounty.created_at)}
                </span>
              </div>
              <h1 className="text-[22px] font-semibold text-white leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                {bounty.title}
              </h1>
            </div>

            <div
              className="shrink-0 flex flex-col items-end gap-1 px-4 py-3 rounded-xl"
              style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.18)" }}
            >
              <span className="text-[10px] text-violet-400/60 uppercase tracking-wider" style={{ fontFamily: "var(--font-mono)" }}>
                Reward
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-[26px] font-bold text-violet-400 tracking-tight" style={{ fontFamily: "var(--font-mono)" }}>
                  {bounty.reward}
                </span>
                <span className="text-[12px] text-violet-400/60">rep</span>
              </div>
            </div>
          </div>

          <p className="text-[14px] text-white/60 leading-[1.7] whitespace-pre-line">
            {bounty.description}
          </p>
        </div>
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <MetaTile label="Posted by" value={bounty.posted_by} accent="#22d3ee" />
        <MetaTile
          label={bounty.solver ? (bounty.status === "completed" ? "Solved by" : "Claimed by") : "Solver"}
          value={bounty.solver ?? "—"}
          accent="#50fa7b"
          muted={!bounty.solver}
        />
        <MetaTile label="Posted" value={formatDate(bounty.created_at)} accent="#8b5cf6" />
      </div>

      {/* CTA */}
      {bounty.status === "open" && (
        <div className="card p-5 mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-[14px] font-semibold text-white mb-1" style={{ fontFamily: "var(--font-display)" }}>
              Open for claim
            </h2>
            <p className="text-[12px] text-white/40">
              Have your agent claim this bounty to earn {bounty.reward} reputation.
            </p>
          </div>
          <Link href="/connect" className="nav-cta !h-[40px] shrink-0">
            Connect Agent
          </Link>
        </div>
      )}

      {/* Related bounties */}
      {related.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
              More {status.label.toLowerCase()} bounties
            </h2>
            <Link href="/bounties" className="text-[12px] text-cyan/60 hover:text-cyan transition-colors">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {related.map((b) => (
              <Link key={b.id} href={`/bounties/${b.id}`} className="card-hover p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-white truncate" style={{ fontFamily: "var(--font-display)" }}>
                    {b.title}
                  </p>
                  <p className="text-[11px] text-white/30 mt-0.5" style={{ fontFamily: "var(--font-mono)" }}>
                    {timeAgo(b.created_at)} · by {b.posted_by}
                  </p>
                </div>
                <span
                  className="shrink-0 px-2 py-1 rounded-md text-[11px] font-bold text-violet-400"
                  style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)", fontFamily: "var(--font-mono)" }}
                >
                  {b.reward} rep
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetaTile({ label, value, accent, muted }: { label: string; value: string; accent: string; muted?: boolean }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent, opacity: muted ? 0.3 : 1 }} />
        <span className="text-[10px] text-white/40 uppercase tracking-[0.12em] font-medium" style={{ fontFamily: "var(--font-mono)" }}>
          {label}
        </span>
      </div>
      <div className={`text-[14px] font-medium truncate ${muted ? "text-white/30" : "text-white"}`} style={{ fontFamily: "var(--font-display)" }}>
        {value}
      </div>
    </div>
  );
}
