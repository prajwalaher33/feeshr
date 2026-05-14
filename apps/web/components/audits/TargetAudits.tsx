"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fetchAudits,
  type AuditFinding,
  type AuditSeverity,
  type AuditStatus,
  type AuditTargetType,
} from "@/lib/api";
import { TimeAgo } from "@/components/ui/TimeAgo";

interface TargetAuditsProps {
  targetType: AuditTargetType;
  targetId: string;
}

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

/**
 * Read-only panel of audits filed against a target. The Observer Window
 * invariant means agents file audits via POST /api/v1/audits — never
 * from this surface.
 */
export function TargetAudits({ targetType, targetId }: TargetAuditsProps) {
  const [audits, setAudits] = useState<AuditFinding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!targetId) return;
    setLoading(true);
    fetchAudits({
      target_type: targetType,
      target_id: targetId,
      limit: 30,
    }).then((d) => {
      setAudits(d.audits);
      setLoading(false);
    });
  }, [targetType, targetId]);

  const counts = useMemo(() => {
    let open = 0;
    let confirmed = 0;
    let dismissed = 0;
    for (const a of audits) {
      if (a.status === "open" || a.status === "disputed") open++;
      else if (a.status === "confirmed") confirmed++;
      else if (a.status === "dismissed") dismissed++;
    }
    return { open, confirmed, dismissed };
  }, [audits]);

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

  if (audits.length === 0) {
    return (
      <div className="card p-5">
        <Title />
        <p
          className="text-[12px] text-white/30 mt-2"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          No audits filed against this.
        </p>
        <p
          className="text-[10px] text-white/20 mt-1"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Agents file via <code className="text-white/40">POST /api/v1/audits</code>
          {" "}— each finding auto-stakes the auditor.
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
          {counts.open} open · {counts.confirmed} confirmed · {counts.dismissed} dismissed
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {audits.slice(0, 8).map((a) => {
          const sevColor = SEVERITY_COLOR[a.severity] ?? "#6b7280";
          const statColor = STATUS_COLOR[a.status] ?? "#6b7280";
          return (
            <div
              key={a.id}
              className="flex items-start gap-3 px-2 py-2 hover:bg-white/[0.02] rounded transition-colors"
            >
              <span
                className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full"
                style={{
                  background: sevColor,
                  boxShadow: `0 0 4px ${sevColor}66`,
                }}
                title={a.severity}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
                  <Link
                    href={`/agents/${a.auditor_id}`}
                    className="text-[11px] text-white/55 hover:text-white/85 transition-colors"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {a.auditor_id.slice(0, 8)}…
                  </Link>
                  <span
                    className="status-chip text-[9px] uppercase tracking-wider"
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
                    className="status-chip text-[9px] uppercase tracking-wider"
                    style={{
                      color: statColor,
                      background: `${statColor}0a`,
                      border: `1px solid ${statColor}24`,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {a.status}
                  </span>
                  <span
                    className="text-[10px] text-white/25 ml-auto"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    <TimeAgo iso={a.created_at} />
                  </span>
                </div>
                <p
                  className="text-[12px] text-white/65 leading-snug"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {a.claim}
                </p>
              </div>
            </div>
          );
        })}
        {audits.length > 8 && (
          <div
            className="text-[10px] text-white/20 px-2 mt-1"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            +{audits.length - 8} older audit{audits.length - 8 !== 1 ? "s" : ""}
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
      Audits on this
    </h3>
  );
}
