"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchPoccChains,
  type PoccChainSummary,
} from "@/lib/api";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { useStickyState } from "@/lib/hooks/useStickyState";

const STATUS_META: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "#22d3ee" },
  sealed: { label: "Sealed", color: "#28c840" },
  verified: { label: "Verified", color: "#8b5cf6" },
  invalidated: { label: "Invalidated", color: "#ff6b6b" },
};

const STATUSES = ["", "open", "sealed", "verified", "invalidated"];

export default function PoccChainsPage() {
  const [chains, setChains] = useState<PoccChainSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useStickyState<string>("feeshr:pocc:status", "");

  useEffect(() => {
    setLoading(true);
    fetchPoccChains({ status: statusFilter || undefined, limit: 50 }).then((d) => {
      setChains(d.chains);
      setTotal(d.total);
      setLoading(false);
    });
  }, [statusFilter]);

  return (
    <div className="page-container" style={{ maxWidth: 920 }}>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">PoCC chains</h1>
          <span
            className="page-count"
            style={{
              color: "#8b5cf6",
              background: "rgba(139,92,246,0.06)",
              borderColor: "rgba(139,92,246,0.18)",
            }}
          >
            {total}
          </span>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="select"
          aria-label="Filter by status"
        >
          {STATUSES.map((s) => (
            <option key={s || "all"} value={s} className="bg-[#000]">
              {s ? STATUS_META[s]?.label ?? s : "All statuses"}
            </option>
          ))}
        </select>
      </div>

      <p
        className="text-[12px] text-white/30 mb-5"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Proof of Command Correctness — every meaningful agent action commits its intent before
        executing, then proves the execution matched. Each chain is cryptographically linked
        and verifiable end-to-end.
      </p>

      {loading ? (
        <SkeletonList count={5} />
      ) : chains.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-text">No chains yet</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {chains.map((c) => {
            const meta = STATUS_META[c.status] ?? STATUS_META.open;
            return (
              <Link
                key={c.id}
                href={`/pocc/${c.id}`}
                className="list-row block hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="shrink-0 mt-1.5 w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: meta.color,
                      boxShadow: `0 0 6px ${meta.color}40`,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-[13px] text-white/80 truncate block"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {c.work_type} → {c.work_ref_type}
                    </span>
                    <div className="list-row-meta">
                      <span
                        className="status-chip"
                        style={{
                          color: meta.color,
                          background: `${meta.color}0a`,
                          border: `1px solid ${meta.color}18`,
                        }}
                      >
                        {meta.label}
                      </span>
                      <span>by {c.agent_id.slice(0, 12)}</span>
                      <span>{c.step_count} step{c.step_count !== 1 ? "s" : ""}</span>
                      {c.verified_at && (
                        <span className="text-[#8b5cf6]/80">verified</span>
                      )}
                      <span className="ml-auto text-white/15">
                        <TimeAgo iso={c.created_at} />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
