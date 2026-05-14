"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fetchAgentStakeSummary,
  fetchStakes,
  type AgentStakeSummary,
  type ReputationStake,
  type StakeStatus,
  type StakeClaim,
} from "@/lib/api";
import { TimeAgo } from "@/components/ui/TimeAgo";

interface StakeSummaryProps {
  agentId: string;
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

export function StakeSummary({ agentId }: StakeSummaryProps) {
  const [summary, setSummary] = useState<AgentStakeSummary | null>(null);
  const [stakes, setStakes] = useState<ReputationStake[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      fetchAgentStakeSummary(agentId),
      fetchStakes({ agent_id: agentId, limit: 8 }),
    ]).then(([sumRes, stakesRes]) => {
      if (sumRes.status === "fulfilled") setSummary(sumRes.value);
      if (stakesRes.status === "fulfilled") setStakes(stakesRes.value.stakes);
      setLoading(false);
    });
  }, [agentId]);

  // Win rate over settled (won + lost). Cancelled doesn't count either way.
  const winRate = useMemo(() => {
    if (!summary) return null;
    const settled = summary.wins + summary.losses;
    if (settled === 0) return null;
    return Math.round((summary.wins / settled) * 100);
  }, [summary]);

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

  if (!summary || (summary.open_stakes === 0 && summary.wins === 0 && summary.losses === 0)) {
    return (
      <div className="card p-5">
        <Title />
        <p
          className="text-[12px] text-white/30 mt-2"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          No stakes yet
        </p>
      </div>
    );
  }

  const winRateColor =
    winRate === null
      ? "rgba(255,255,255,0.5)"
      : winRate >= 70
        ? "#28c840"
        : winRate >= 40
          ? "#f7c948"
          : "#ff6b6b";

  return (
    <div className="card p-5">
      <div className="flex items-baseline gap-3 mb-4">
        <Title />
        <Link
          href={`/stakes?agent=${agentId}`}
          className="ml-auto text-[10px] text-cyan/60 hover:text-cyan transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          all stakes →
        </Link>
      </div>

      <div className="flex items-center gap-6 mb-4 flex-wrap">
        <Stat
          label="At risk"
          value={summary.at_risk.toLocaleString()}
          color="#f7c948"
        />
        <Stat
          label="Open"
          value={String(summary.open_stakes)}
          color="rgba(255,255,255,0.85)"
        />
        <Stat
          label="Wins"
          value={`${summary.wins} · +${summary.won_total.toLocaleString()}`}
          color="#28c840"
        />
        <Stat
          label="Losses"
          value={`${summary.losses} · -${summary.lost_total.toLocaleString()}`}
          color="#ff6b6b"
        />
        {winRate !== null && (
          <Stat
            label="Win rate"
            value={`${winRate}%`}
            color={winRateColor}
          />
        )}
      </div>

      {stakes.length > 0 && (
        <>
          <div
            className="text-[10px] text-white/40 uppercase tracking-[0.1em] mb-2"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Recent stakes
          </div>
          <div className="flex flex-col gap-1">
            {stakes.slice(0, 6).map((s) => {
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
                  <span
                    className="shrink-0 text-[12px] tabular-nums w-12 text-right"
                    style={{
                      color:
                        s.status === "won"
                          ? "#28c840"
                          : s.status === "lost"
                            ? "#ff6b6b"
                            : "rgba(255,255,255,0.55)",
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
            {stakes.length > 6 && (
              <div
                className="text-[10px] text-white/20 px-2 mt-1"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                +{stakes.length - 6} more
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Title() {
  return (
    <h3
      className="text-[13px] font-semibold text-white"
      style={{ fontFamily: "var(--font-display)" }}
    >
      Stakes
    </h3>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div
        className="text-[9px] text-white/30 uppercase tracking-[0.1em]"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {label}
      </div>
      <div
        className="text-[16px] tabular-nums mt-0.5"
        style={{ color, fontFamily: "var(--font-display)" }}
      >
        {value}
      </div>
    </div>
  );
}
