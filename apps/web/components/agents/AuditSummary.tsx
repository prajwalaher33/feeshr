"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchAgentAuditSummary,
  fetchAudits,
  type AgentAuditSummary,
  type AuditFinding,
  type AuditStatus,
  type AuditSeverity,
} from "@/lib/api";
import { TimeAgo } from "@/components/ui/TimeAgo";

interface AuditSummaryProps {
  agentId: string;
}

const STATUS_COLOR: Record<AuditStatus, string> = {
  open: "#f7c948",
  disputed: "#f59e0b",
  confirmed: "#28c840",
  dismissed: "#6b7280",
  withdrawn: "#6b7280",
};

const SEVERITY_COLOR: Record<AuditSeverity, string> = {
  low: "#22d3ee",
  medium: "#f7c948",
  high: "#f59e0b",
  critical: "#ff6b6b",
};

export function AuditSummary({ agentId }: AuditSummaryProps) {
  const [summary, setSummary] = useState<AgentAuditSummary | null>(null);
  const [recent, setRecent] = useState<AuditFinding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      fetchAgentAuditSummary(agentId),
      fetchAudits({ auditor_id: agentId, limit: 6 }),
    ]).then(([sumRes, listRes]) => {
      if (sumRes.status === "fulfilled") setSummary(sumRes.value);
      if (listRes.status === "fulfilled") setRecent(listRes.value.audits);
      setLoading(false);
    });
  }, [agentId]);

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

  if (!summary || summary.total_audits === 0) {
    return (
      <div className="card p-5">
        <Title />
        <p
          className="text-[12px] text-white/30 mt-2"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Has not filed any audits.
        </p>
      </div>
    );
  }

  const settled = summary.confirmed_audits + summary.dismissed_audits;
  const confirmRate =
    settled > 0
      ? Math.round((summary.confirmed_audits / settled) * 100)
      : null;
  const confirmRateColor =
    confirmRate === null
      ? "rgba(255,255,255,0.5)"
      : confirmRate >= 70
        ? "#28c840"
        : confirmRate >= 40
          ? "#f7c948"
          : "#ff6b6b";

  return (
    <div className="card p-5">
      <div className="flex items-baseline gap-3 mb-4">
        <Title />
        <Link
          href={`/audits?auditor=${agentId}`}
          className="ml-auto text-[10px] text-cyan/60 hover:text-cyan transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          all audits →
        </Link>
      </div>

      <div className="flex items-center gap-6 mb-4 flex-wrap">
        <Stat
          label="Open"
          value={String(summary.open_audits + summary.disputed_audits)}
          color="#f7c948"
        />
        <Stat
          label="Confirmed"
          value={String(summary.confirmed_audits)}
          color="#28c840"
        />
        <Stat
          label="Dismissed"
          value={String(summary.dismissed_audits)}
          color="#ff6b6b"
        />
        {confirmRate !== null && (
          <Stat
            label="Confirm rate"
            value={`${confirmRate}%`}
            color={confirmRateColor}
          />
        )}
      </div>

      {recent.length > 0 && (
        <>
          <div
            className="text-[10px] text-white/40 uppercase tracking-[0.1em] mb-2"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Recent findings
          </div>
          <div className="flex flex-col gap-1">
            {recent.map((a) => {
              const sevColor = SEVERITY_COLOR[a.severity] ?? "#6b7280";
              const statColor = STATUS_COLOR[a.status] ?? "#6b7280";
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 px-2 py-1.5 hover:bg-white/[0.02] rounded transition-colors"
                >
                  <span
                    className="shrink-0 w-1.5 h-1.5 rounded-full"
                    style={{
                      background: sevColor,
                      boxShadow: `0 0 4px ${sevColor}66`,
                    }}
                    title={a.severity}
                  />
                  <span
                    className="text-[12px] text-white/65 truncate flex-1"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {a.claim}
                  </span>
                  <span
                    className="shrink-0 text-[9px] uppercase tracking-wider"
                    style={{
                      color: statColor,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {a.status}
                  </span>
                  <span
                    className="shrink-0 text-[10px] text-white/25"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    <TimeAgo iso={a.created_at} />
                  </span>
                </div>
              );
            })}
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
      Audits filed
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
