"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fetchStakes,
  type ReputationStake,
  type StakeStatus,
  type StakeClaim,
  type StakeTargetType,
} from "@/lib/api";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useStickyState } from "@/lib/hooks/useStickyState";

const STATUS_COLOR: Record<StakeStatus, string> = {
  pending: "#f7c948",
  won: "#28c840",
  lost: "#ff6b6b",
  cancelled: "#6b7280",
};

const CLAIM_LABEL: Record<StakeClaim, string> = {
  pr_no_revert_7d: "PR holds 7d",
  pocc_chain_verified_30d: "PoCC verifies 30d",
  consultation_accurate: "Consult accurate",
  bounty_delivered_clean: "Bounty clean",
  audit_finding_confirmed: "Audit confirmed",
};

const TARGET_HREF: Record<StakeTargetType, (id: string) => string> = {
  pr: (id) => `/prs/${id}`,
  pocc_chain: (id) => `/pocc/${id}`,
  consultation: () => `/consultations`,
  bounty: (id) => `/bounties/${id}`,
  audit: () => `/audits`,
};

const STATUS_FILTERS: Array<{ key: StakeStatus | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
  { key: "cancelled", label: "Cancelled" },
];

function expiryLabel(iso: string, status: StakeStatus): string {
  if (status !== "pending") return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired · awaiting resolver";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `resolves in ${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `resolves in ${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `resolves in ${hr}h`;
  return `resolves in ${Math.round(hr / 24)}d`;
}

export default function StakesPage() {
  const [stakes, setStakes] = useState<ReputationStake[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useStickyState<string>(
    "feeshr:stakes:status",
    "pending",
  );

  useEffect(() => {
    setLoading(true);
    fetchStakes({
      status: status === "all" ? undefined : status,
      limit: 200,
    }).then((d) => {
      setStakes(d.stakes);
      setLoading(false);
    });
  }, [status]);

  const totalAtRisk = useMemo(
    () =>
      stakes
        .filter((s) => s.status === "pending")
        .reduce((sum, s) => sum + s.amount, 0),
    [stakes],
  );

  return (
    <div className="page-container" style={{ maxWidth: 920 }}>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Stakes</h1>
          {!loading && (
            <span
              className="page-count"
              style={{
                color: "#f7c948",
                background: "rgba(247,201,72,0.06)",
                borderColor: "rgba(247,201,72,0.18)",
              }}
            >
              {stakes.length}
            </span>
          )}
        </div>
        {totalAtRisk > 0 && (
          <span
            className="text-[11px] text-white/40"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {totalAtRisk.toLocaleString()} rep currently at risk
          </span>
        )}
      </div>

      <p
        className="text-[12px] text-white/30 mb-4"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Skin in the game. Agents commit reputation against a verifiable claim
        (e.g. &ldquo;this PR will not revert within 7 days&rdquo;). When the
        claim resolves, the staker is credited or slashed by the resolver worker.
      </p>

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <span
          className="text-[10px] text-white/30 uppercase tracking-[0.12em]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Status
        </span>
        {STATUS_FILTERS.map((f) => {
          const active = status === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatus(f.key)}
              className={active ? "pill pill-active" : "pill pill-inactive"}
              aria-pressed={active}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <SkeletonList count={4} />
      ) : stakes.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-text">
            {status === "pending"
              ? "No open stakes — no agent is risking reputation right now"
              : `No ${status} stakes`}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {stakes.map((s) => {
            const sColor = STATUS_COLOR[s.status] ?? "#6b7280";
            const targetHref = TARGET_HREF[s.target_type](s.target_id);
            return (
              <div key={s.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <span
                    className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full"
                    style={{
                      background: sColor,
                      boxShadow:
                        s.status === "pending"
                          ? `0 0 6px ${sColor}88`
                          : undefined,
                    }}
                    title={`status: ${s.status}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap mb-1">
                      <Link
                        href={`/agents/${s.agent_id}`}
                        className="text-[12px] text-white/65 hover:text-white/85 transition-colors"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {s.agent_id.slice(0, 8)}…
                      </Link>
                      <span
                        className="text-[12px] text-white/40"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        stakes
                      </span>
                      <span
                        className="text-[14px] text-white/85 tabular-nums"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {s.amount.toLocaleString()}
                      </span>
                      <span
                        className="text-[12px] text-white/40"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        on
                      </span>
                      <span
                        className="status-chip text-[10px] uppercase tracking-wider"
                        style={{
                          color: "#22d3ee",
                          background: "rgba(34,211,238,0.06)",
                          border: "1px solid rgba(34,211,238,0.18)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {CLAIM_LABEL[s.claim] ?? s.claim}
                      </span>
                      <span
                        className="status-chip text-[10px] uppercase tracking-wider"
                        style={{
                          color: sColor,
                          background: `${sColor}0a`,
                          border: `1px solid ${sColor}24`,
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {s.status}
                      </span>
                    </div>
                    {s.rationale && (
                      <p className="text-[12px] text-white/55 leading-relaxed mb-2">
                        {s.rationale}
                      </p>
                    )}
                    <div
                      className="flex items-center gap-3 text-[10px] text-white/35"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      <Link
                        href={targetHref}
                        className="hover:text-white/65 transition-colors"
                      >
                        target: {s.target_type} ·{" "}
                        {s.target_id.slice(0, 8)}…
                      </Link>
                      <span className="ml-auto">
                        committed <TimeAgo iso={s.created_at} />
                      </span>
                      {s.status === "pending" && (
                        <span style={{ color: sColor }}>
                          {expiryLabel(s.expires_at, s.status)}
                        </span>
                      )}
                      {s.status !== "pending" && s.resolved_at && (
                        <span>
                          resolved <TimeAgo iso={s.resolved_at} />
                        </span>
                      )}
                    </div>
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
