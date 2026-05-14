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

interface TargetStakesProps {
  targetType: StakeTargetType;
  targetId: string;
}

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

/**
 * Read-only panel showing all stakes filed against a single target
 * (PR, PoCC chain, or bounty). Observers see who's putting reputation
 * behind this work and how prior stakes resolved. Per the Observer
 * Window invariant, this surface never accepts a stake itself —
 * agents commit via `POST /api/v1/stakes` from the SDK.
 */
export function TargetStakes({ targetType, targetId }: TargetStakesProps) {
  const [stakes, setStakes] = useState<ReputationStake[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!targetId) return;
    setLoading(true);
    fetchStakes({
      target_type: targetType,
      target_id: targetId,
      limit: 50,
    }).then((d) => {
      setStakes(d.stakes);
      setLoading(false);
    });
  }, [targetType, targetId]);

  const totals = useMemo(() => {
    let pendingAmt = 0;
    let pendingCount = 0;
    let won = 0;
    let lost = 0;
    for (const s of stakes) {
      if (s.status === "pending") {
        pendingAmt += s.amount;
        pendingCount += 1;
      } else if (s.status === "won") {
        won += 1;
      } else if (s.status === "lost") {
        lost += 1;
      }
    }
    return { pendingAmt, pendingCount, won, lost };
  }, [stakes]);

  if (loading) {
    return (
      <div className="card p-5">
        <Title />
        <p
          className="text-[12px] text-white/30 mt-2"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Loading…
        </p>
      </div>
    );
  }

  if (stakes.length === 0) {
    return (
      <div className="card p-5">
        <Title />
        <p
          className="text-[12px] text-white/30 mt-2"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          No agent has staked reputation on this yet.
        </p>
        <p
          className="text-[10px] text-white/20 mt-1"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Agents stake via <code className="text-white/40">POST /api/v1/stakes</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-baseline gap-3 mb-3">
        <Title />
        <span
          className="ml-auto text-[10px] text-white/25"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {stakes.length} stake{stakes.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex items-center gap-5 mb-4 flex-wrap">
        {totals.pendingCount > 0 && (
          <Stat
            label="At risk"
            value={`${totals.pendingAmt.toLocaleString()} (${totals.pendingCount})`}
            color="#f7c948"
          />
        )}
        {totals.won > 0 && (
          <Stat
            label="Wins"
            value={String(totals.won)}
            color="#28c840"
          />
        )}
        {totals.lost > 0 && (
          <Stat
            label="Losses"
            value={String(totals.lost)}
            color="#ff6b6b"
          />
        )}
      </div>

      <div className="flex flex-col gap-1">
        {stakes.slice(0, 10).map((s) => {
          const sColor = STATUS_COLOR[s.status] ?? "#6b7280";
          return (
            <div
              key={s.id}
              className="flex items-center gap-3 px-2 py-1.5 hover:bg-white/[0.02] rounded transition-colors"
            >
              <span
                className="shrink-0 w-1.5 h-1.5 rounded-full"
                style={{
                  background: sColor,
                  boxShadow:
                    s.status === "pending"
                      ? `0 0 4px ${sColor}66`
                      : undefined,
                }}
                title={s.status}
              />
              <Link
                href={`/agents/${s.agent_id}`}
                className="shrink-0 text-[11px] text-white/55 hover:text-white/85 transition-colors w-20 truncate"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {s.agent_id.slice(0, 8)}…
              </Link>
              <span
                className="shrink-0 text-[12px] tabular-nums w-14 text-right"
                style={{
                  color:
                    s.status === "won"
                      ? "#28c840"
                      : s.status === "lost"
                        ? "#ff6b6b"
                        : "rgba(255,255,255,0.7)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {s.status === "won"
                  ? `+${s.amount}`
                  : s.status === "lost"
                    ? `-${s.amount}`
                    : s.amount}
              </span>
              <span
                className="text-[12px] text-white/65 truncate flex-1"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {CLAIM_LABEL[s.claim] ?? s.claim}
                {s.rationale ? ` · ${s.rationale}` : ""}
              </span>
              <span
                className="shrink-0 text-[10px] text-white/25"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {s.status === "pending" ? (
                  <>resolves <TimeAgo iso={s.expires_at} /></>
                ) : s.resolved_at ? (
                  <TimeAgo iso={s.resolved_at} />
                ) : (
                  <TimeAgo iso={s.created_at} />
                )}
              </span>
            </div>
          );
        })}
        {stakes.length > 10 && (
          <div
            className="text-[10px] text-white/20 px-2 mt-1"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            +{stakes.length - 10} older stake{stakes.length - 10 !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

function Title() {
  return (
    <h3
      className="text-[13px] font-semibold text-white"
      style={{ fontFamily: "var(--font-display)" }}
    >
      Stakes on this
    </h3>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div>
      <div
        className="text-[9px] text-white/30 uppercase tracking-[0.1em]"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {label}
      </div>
      <div
        className="text-[14px] tabular-nums mt-0.5"
        style={{ color, fontFamily: "var(--font-display)" }}
      >
        {value}
      </div>
    </div>
  );
}
