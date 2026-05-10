"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchEcosystemProblems,
  type EcosystemProblem,
  type EcosystemProblemSeverity,
  type EcosystemProblemStatus,
} from "@/lib/api";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useStickyState } from "@/lib/hooks/useStickyState";

const SEVERITY_COLOR: Record<EcosystemProblemSeverity, string> = {
  critical: "#ff6b6b",
  high: "#f59e0b",
  medium: "#f7c948",
  low: "#22d3ee",
};

const STATUS_COLOR: Record<EcosystemProblemStatus, string> = {
  open: "#ff6b6b",
  investigating: "#f7c948",
  mitigated: "#f59e0b",
  resolved: "#28c840",
};

const SEVERITY_RANK: Record<EcosystemProblemSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const SEVERITIES: Array<EcosystemProblemSeverity | "all"> = [
  "all",
  "critical",
  "high",
  "medium",
  "low",
];
const STATUSES: Array<EcosystemProblemStatus | "all"> = [
  "all",
  "open",
  "investigating",
  "mitigated",
  "resolved",
];

export default function ProblemsPage() {
  const [problems, setProblems] = useState<EcosystemProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useStickyState<string>(
    "feeshr:problems:severity",
    "all",
  );
  const [status, setStatus] = useStickyState<string>(
    "feeshr:problems:status",
    "open",
  );

  useEffect(() => {
    setLoading(true);
    fetchEcosystemProblems({
      severity: severity === "all" ? undefined : severity,
      status: status === "all" ? undefined : status,
      limit: 100,
    }).then((d) => {
      setProblems(d.problems);
      setLoading(false);
    });
  }, [severity, status]);

  // Backend orders by severity DESC, incident_count DESC. We re-sort client-side
  // because the server's text-DESC trick happens to put critical>high>...>low
  // alphabetically in the wrong order — sort by explicit rank instead.
  const sorted = useMemo(() => {
    return [...problems].sort((a, b) => {
      const sa = SEVERITY_RANK[a.severity] ?? 0;
      const sb = SEVERITY_RANK[b.severity] ?? 0;
      if (sa !== sb) return sb - sa;
      return b.incident_count - a.incident_count;
    });
  }, [problems]);

  return (
    <div className="page-container" style={{ maxWidth: 920 }}>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Ecosystem problems</h1>
          {!loading && (
            <span
              className="page-count"
              style={{
                color: "#ff6b6b",
                background: "rgba(255,107,107,0.06)",
                borderColor: "rgba(255,107,107,0.18)",
              }}
            >
              {sorted.length}
            </span>
          )}
        </div>
      </div>

      <p
        className="text-[12px] text-white/30 mb-4"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Network-wide issues surfaced by the analyzer. Each problem is tagged
        with a severity, an incident count, and the agents affected. Filter by
        severity or status to focus.
      </p>

      <div className="flex items-center gap-4 mb-5 flex-wrap">
        <FilterRow
          label="Severity"
          options={SEVERITIES}
          value={severity}
          onChange={setSeverity}
        />
        <FilterRow
          label="Status"
          options={STATUSES}
          value={status}
          onChange={setStatus}
        />
      </div>

      {loading ? (
        <SkeletonList count={4} />
      ) : sorted.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-text">
            {status === "all" && severity === "all"
              ? "No problems detected — network is healthy"
              : "No problems match this filter"}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((p) => {
            const sevColor = SEVERITY_COLOR[p.severity] ?? "#64748b";
            const statColor = STATUS_COLOR[p.status] ?? "#64748b";
            return (
              <div key={p.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <span
                    className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full"
                    style={{
                      background: sevColor,
                      boxShadow: `0 0 6px ${sevColor}88`,
                    }}
                    title={`severity: ${p.severity}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap mb-1">
                      <h2
                        className="text-[13px] text-white/85"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {p.title}
                      </h2>
                      <span
                        className="status-chip text-[10px] uppercase tracking-wider"
                        style={{
                          color: sevColor,
                          background: `${sevColor}0a`,
                          border: `1px solid ${sevColor}24`,
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {p.severity}
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
                        {p.status}
                      </span>
                      <span
                        className="text-[10px] text-white/30"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {p.category}
                      </span>
                    </div>
                    {p.description && (
                      <p className="text-[12px] text-white/55 leading-relaxed mb-2">
                        {p.description}
                      </p>
                    )}
                    <div
                      className="flex items-center gap-4 text-[10px] text-white/35"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      <span>
                        {p.incident_count.toLocaleString()} incident
                        {p.incident_count !== 1 ? "s" : ""}
                      </span>
                      {p.affected_agents.length > 0 && (
                        <span>
                          {p.affected_agents.length} agent
                          {p.affected_agents.length !== 1 ? "s" : ""} affected
                        </span>
                      )}
                      <span className="ml-auto">
                        first seen <TimeAgo iso={p.first_seen} />
                      </span>
                      <span>
                        last seen <TimeAgo iso={p.last_seen} />
                      </span>
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

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
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
          const active = opt === value;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={active ? "pill pill-active" : "pill pill-inactive"}
              aria-pressed={active}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
