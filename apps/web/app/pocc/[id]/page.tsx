"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  fetchPoccChain,
  type PoccChainDetail,
  type PoccStep,
} from "@/lib/api";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { TargetStakes } from "@/components/stakes/TargetStakes";

const STATUS_META: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "#22d3ee" },
  sealed: { label: "Sealed", color: "#28c840" },
  verified: { label: "Verified", color: "#8b5cf6" },
  invalidated: { label: "Invalidated", color: "#ff6b6b" },
};

function shortHash(h: string | null | undefined): string {
  if (!h) return "—";
  return h.length > 12 ? `${h.slice(0, 8)}…${h.slice(-4)}` : h;
}

export default function PoccChainDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [chain, setChain] = useState<PoccChainDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPoccChain(id).then((c) => {
      setChain(c);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="page-container">
        <SkeletonList count={5} />
      </div>
    );
  }

  if (!chain) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <span className="empty-state-text">Chain not found</span>
          <Link
            href="/pocc"
            className="mt-3 text-[12px] text-cyan/70 hover:text-cyan transition-colors"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            ← All chains
          </Link>
        </div>
      </div>
    );
  }

  const meta = STATUS_META[chain.status] ?? STATUS_META.open;

  return (
    <div className="page-container" style={{ maxWidth: 920 }}>
      <div className="mb-4">
        <Link
          href="/pocc"
          className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          ← All chains
        </Link>
      </div>

      <div className="card p-5 mb-5">
        <div className="flex items-start gap-3 mb-3">
          <span
            className="shrink-0 mt-2 w-2 h-2 rounded-full"
            style={{
              backgroundColor: meta.color,
              boxShadow: `0 0 6px ${meta.color}40`,
            }}
          />
          <div className="flex-1 min-w-0">
            <h1
              className="text-[16px] text-white/90 font-medium leading-tight"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {chain.work_type} → {chain.work_ref_type}
            </h1>
            <div
              className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/50"
              style={{ fontFamily: "var(--font-mono)" }}
            >
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
              <span>by {chain.agent_id.slice(0, 12)}</span>
              <span>{chain.step_count} step{chain.step_count !== 1 ? "s" : ""}</span>
              <span className="text-white/30">created <TimeAgo iso={chain.created_at} /></span>
              {chain.sealed_at && (
                <span className="text-white/30">sealed <TimeAgo iso={chain.sealed_at} /></span>
              )}
              {chain.verified_at && (
                <span className="text-[#8b5cf6]/80">
                  verified by {(chain.verified_by ?? "").slice(0, 12)} <TimeAgo iso={chain.verified_at} />
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 text-[11px]" style={{ fontFamily: "var(--font-mono)" }}>
          <HashCell label="root" value={chain.root_hash} />
          <HashCell label="final" value={chain.final_hash} />
          <HashCell label="signature" value={chain.chain_signature} />
        </div>
      </div>

      <div className="mb-4">
        <TargetStakes targetType="pocc_chain" targetId={chain.id} />
      </div>

      <h2
        className="text-[12px] text-white/40 uppercase tracking-[0.1em] mb-3"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Steps ({chain.steps.length})
      </h2>

      {chain.steps.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-text">No steps recorded yet</span>
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {chain.steps.map((s, i) => (
            <StepCard key={s.step_index} step={s} isLast={i === chain.steps.length - 1} />
          ))}
        </ol>
      )}
    </div>
  );
}

function HashCell({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="card px-3 py-2 flex items-center gap-2">
      <span className="text-white/30 uppercase tracking-[0.1em] text-[10px]">{label}</span>
      <span
        className="text-white/70 truncate"
        title={value ?? undefined}
      >
        {shortHash(value)}
      </span>
    </div>
  );
}

function StepCard({ step, isLast }: { step: PoccStep; isLast: boolean }) {
  const intent = step.intent ?? {};
  const action = (intent as Record<string, unknown>).action as string | undefined;
  const description = (intent as Record<string, unknown>).description as string | undefined;
  const target = (intent as Record<string, unknown>).target as string | undefined;
  const consistent = step.is_consistent;
  const phaseColor =
    consistent === false ? "#ff6b6b" : consistent === true ? "#28c840" : "#f7c948";

  return (
    <li className="relative flex gap-3">
      <div className="flex flex-col items-center shrink-0">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px]"
          style={{
            background: `${phaseColor}10`,
            color: phaseColor,
            border: `1px solid ${phaseColor}40`,
            fontFamily: "var(--font-mono)",
          }}
          title={
            consistent === true
              ? "consistent"
              : consistent === false
                ? "inconsistent"
                : "pending"
          }
        >
          {step.step_index}
        </span>
        {!isLast && (
          <span
            className="flex-1 w-px my-1"
            style={{ background: "rgba(203,213,225,0.10)" }}
          />
        )}
      </div>

      <div className="flex-1 min-w-0 card p-3">
        <div className="flex items-baseline gap-2 flex-wrap mb-2">
          {action && (
            <span
              className="text-[12px] text-white/85"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {action}
            </span>
          )}
          {target && (
            <span
              className="text-[11px] text-white/45 truncate"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              → {target}
            </span>
          )}
          <span
            className="ml-auto text-[10px]"
            style={{
              color: phaseColor,
              fontFamily: "var(--font-mono)",
            }}
          >
            {consistent === true
              ? "consistent ✓"
              : consistent === false
                ? "inconsistent ✗"
                : "pending"}
          </span>
        </div>
        {description && (
          <p className="text-[12px] text-white/65 leading-relaxed mb-2">
            {description}
          </p>
        )}

        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] mt-2"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <Phase
            label="commit"
            color="#22d3ee"
            timestamp={step.committed_at}
            hash={step.commitment_hash}
          />
          <Phase
            label="execute"
            color="#f7c948"
            timestamp={step.executed_at ?? null}
            hash={null}
          />
          <Phase
            label="verify"
            color="#8b5cf6"
            timestamp={step.verified_at ?? null}
            hash={step.step_hash}
          />
        </div>

        {step.previous_step_hash && (
          <div
            className="mt-2 text-[10px] text-white/25"
            style={{ fontFamily: "var(--font-mono)" }}
            title={step.previous_step_hash}
          >
            prev: {shortHash(step.previous_step_hash)}
          </div>
        )}
      </div>
    </li>
  );
}

function Phase({
  label,
  color,
  timestamp,
  hash,
}: {
  label: string;
  color: string;
  timestamp: string | null;
  hash: string | null;
}) {
  return (
    <div className="card px-2 py-1.5">
      <div className="flex items-center gap-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: timestamp ? color : "rgba(203,213,225,0.20)" }}
        />
        <span style={{ color: timestamp ? color : "rgba(255,255,255,0.30)" }}>
          {label}
        </span>
      </div>
      {timestamp ? (
        <div className="text-white/50 mt-0.5 text-[9px]">
          {new Date(timestamp).toLocaleTimeString()}
        </div>
      ) : (
        <div className="text-white/20 mt-0.5 text-[9px]">—</div>
      )}
      {hash && (
        <div className="text-white/30 mt-0.5 truncate" title={hash}>
          {shortHash(hash)}
        </div>
      )}
    </div>
  );
}
