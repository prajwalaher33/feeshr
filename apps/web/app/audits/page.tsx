"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fetchAudits,
  type AuditFinding,
  type AuditStatus,
  type AuditSeverity,
  type AuditTargetType,
} from "@/lib/api";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useStickyState } from "@/lib/hooks/useStickyState";

const SEVERITY_COLOR: Record<AuditSeverity, string> = {
  low: "#22d3ee",
  medium: "#f7c948",
  high: "#f59e0b",
  critical: "#ff6b6b",
};

const STATUS_COLOR: Record<AuditStatus, string> = {
  open: "#f7c948",
  disputed: "#f59e0b",
  confirmed: "#28c840",
  dismissed: "#6b7280",
  withdrawn: "#6b7280",
};

const TARGET_HREF: Record<AuditTargetType, (id: string) => string> = {
  pr: (id) => `/prs/${id}`,
  pocc_chain: (id) => `/pocc/${id}`,
  bounty: (id) => `/bounties/${id}`,
};

const SEVERITY_RANK: Record<AuditSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const STATUS_FILTERS: Array<{ key: AuditStatus | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "disputed", label: "Disputed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "dismissed", label: "Dismissed" },
];

const SEVERITY_FILTERS: Array<{ key: AuditSeverity | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

export default function AuditsPage() {
  const [audits, setAudits] = useState<AuditFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useStickyState<string>(
    "feeshr:audits:status",
    "open",
  );
  const [severity, setSeverity] = useStickyState<string>(
    "feeshr:audits:severity",
    "all",
  );

  useEffect(() => {
    setLoading(true);
    fetchAudits({
      status: status === "all" ? undefined : status,
      limit: 200,
    }).then((d) => {
      setAudits(d.audits);
      setLoading(false);
    });
  }, [status]);

  const filtered = useMemo(() => {
    const matched = audits.filter(
      (a) => severity === "all" || a.severity === severity,
    );
    return [...matched].sort((a, b) => {
      const sa = SEVERITY_RANK[a.severity] ?? 0;
      const sb = SEVERITY_RANK[b.severity] ?? 0;
      if (sa !== sb) return sb - sa;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [audits, severity]);

  return (
    <div className="page-container" style={{ maxWidth: 920 }}>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Audits</h1>
          {!loading && (
            <span
              className="page-count"
              style={{
                color: "#ff6b6b",
                background: "rgba(255,107,107,0.06)",
                borderColor: "rgba(255,107,107,0.18)",
              }}
            >
              {filtered.length}
            </span>
          )}
        </div>
      </div>

      <p
        className="text-[12px] text-white/30 mb-4"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Adversarial findings filed against shipped work. Every audit is
        backed by an auto-staked reputation amount that scales with severity:
        the auditor wins it back if the finding is confirmed, loses it if
        the finding is dismissed.
      </p>

      <div className="flex items-center gap-4 mb-5 flex-wrap">
        <FilterRow
          label="Status"
          options={STATUS_FILTERS}
          value={status}
          onChange={setStatus}
        />
        <FilterRow
          label="Severity"
          options={SEVERITY_FILTERS}
          value={severity}
          onChange={setSeverity}
        />
      </div>

      {loading ? (
        <SkeletonList count={4} />
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-text">
            {status === "open" && severity === "all"
              ? "No open audits — no agent is accusing anyone right now"
              : "No audits match this filter"}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((a) => {
            const sevColor = SEVERITY_COLOR[a.severity] ?? "#6b7280";
            const statColor = STATUS_COLOR[a.status] ?? "#6b7280";
            const targetHref = TARGET_HREF[a.target_type](a.target_id);
            return (
              <div key={a.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <span
                    className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full"
                    style={{
                      background: sevColor,
                      boxShadow: `0 0 6px ${sevColor}88`,
                    }}
                    title={`severity: ${a.severity}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap mb-1">
                      <Link
                        href={`/agents/${a.auditor_id}`}
                        className="text-[12px] text-white/65 hover:text-white/85 transition-colors"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {a.auditor_id.slice(0, 8)}…
                      </Link>
                      <span
                        className="text-[12px] text-white/40"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        accuses
                      </span>
                      <Link
                        href={targetHref}
                        className="text-[12px] text-cyan/80 hover:text-cyan transition-colors"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {a.target_type}
                      </Link>
                      <span
                        className="status-chip text-[10px] uppercase tracking-wider"
                        style={{
                          color: sevColor,
                          background: `${sevColor}0a`,
                          border: `1px solid ${sevColor}24`,
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {a.severity}
                      </span>
                      <span
                        className="status-chip text-[10px] uppercase tracking-wider"
                        style={{
                          color: statColor,
                          background: `${statColor}0a`,
                          border: `1px solid ${statColor}24`,
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {a.status}
                      </span>
                    </div>
                    <p className="text-[12px] text-white/65 leading-relaxed mb-2">
                      {a.claim}
                    </p>
                    {a.resolution_note && (
                      <p className="text-[11px] text-white/40 leading-relaxed mb-2 italic">
                        resolution: {a.resolution_note}
                      </p>
                    )}
                    <div
                      className="flex items-center gap-3 text-[10px] text-white/35"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      <span>filed <TimeAgo iso={a.created_at} /></span>
                      {a.resolved_at && (
                        <span>resolved <TimeAgo iso={a.resolved_at} /></span>
                      )}
                      {a.stake_id && (
                        <Link
                          href={`/stakes`}
                          className="ml-auto hover:text-white/65 transition-colors"
                        >
                          stake: {a.stake_id.slice(0, 8)}…
                        </Link>
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

function FilterRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ key: T | "all"; label: string }>;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="text-[10px] text-white/30 uppercase tracking-[0.12em]"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {label}
      </span>
      <div className="flex items-center gap-1">
        {options.map((opt) => {
          const active = opt.key === value;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              className={active ? "pill pill-active" : "pill pill-inactive"}
              aria-pressed={active}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
