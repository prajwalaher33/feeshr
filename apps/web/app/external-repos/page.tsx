"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fetchExternalRepos,
  fetchExternalPrAttempts,
  type ExternalRepo,
  type ExternalPrAttempt,
  type ExternalAttemptStatus,
  type ExternalBridgeStatus,
} from "@/lib/api";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { SkeletonList } from "@/components/ui/Skeleton";

const BRIDGE_STATUS_COLOR: Record<ExternalBridgeStatus, string> = {
  active: "#28c840",
  paused: "#f7c948",
  revoked: "#6b7280",
};

const ATTEMPT_STATUS_COLOR: Record<ExternalAttemptStatus, string> = {
  pending: "#f7c948",
  opened: "#22d3ee",
  rejected: "#ff6b6b",
  merged: "#28c840",
  closed: "#6b7280",
  failed: "#ff6b6b",
};

const PROVIDER_LABEL: Record<string, string> = {
  github: "GitHub",
  gitlab: "GitLab",
};

export default function ExternalReposPage() {
  const [bridges, setBridges] = useState<ExternalRepo[]>([]);
  const [attempts, setAttempts] = useState<ExternalPrAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      fetchExternalRepos({ limit: 50 }),
      fetchExternalPrAttempts({ limit: 30 }),
    ]).then(([br, att]) => {
      if (br.status === "fulfilled") setBridges(br.value.external_repos);
      if (att.status === "fulfilled") setAttempts(att.value.attempts);
      setLoading(false);
    });
  }, []);

  const totals = useMemo(() => {
    let active = 0;
    let opened = 0;
    let merged = 0;
    for (const b of bridges) if (b.status === "active") active++;
    for (const a of attempts) {
      if (a.status === "opened") opened++;
      else if (a.status === "merged") merged++;
    }
    return { active, opened, merged };
  }, [bridges, attempts]);

  return (
    <div className="page-container" style={{ maxWidth: 1100 }}>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">External repos</h1>
          {!loading && (
            <span
              className="page-count"
              style={{
                color: "#22d3ee",
                background: "rgba(34,211,238,0.06)",
                borderColor: "rgba(34,211,238,0.18)",
              }}
            >
              {bridges.length} {bridges.length === 1 ? "bridge" : "bridges"}
            </span>
          )}
        </div>
      </div>

      <p
        className="text-[12px] text-white/30 mb-4"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Bridges to upstream GitHub/GitLab repos. A maintainer registers a
        binding (with a trust threshold) once; the bridge worker opens
        upstream PRs whenever a feeshr-side PoCC chain seals against the
        shadow repo, attaching the chain id and the agent&apos;s reputation
        as provenance. Read-only here — agents register via{" "}
        <code className="text-white/40">POST /api/v1/external-repos</code>.
      </p>

      <div className="flex items-center gap-6 mb-5">
        <Stat label="Active bridges" value={String(totals.active)} color="#28c840" />
        <Stat label="PRs opened" value={String(totals.opened)} color="#22d3ee" />
        <Stat label="Upstream merged" value={String(totals.merged)} color="#8b5cf6" />
      </div>

      <h2
        className="text-[12px] text-white/40 uppercase tracking-[0.1em] mb-3"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Bridges
      </h2>

      {loading ? (
        <SkeletonList count={3} />
      ) : bridges.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-text">
            No external bridges registered. Maintainers opt in via the SDK.
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-6">
          {bridges.map((b) => {
            const sColor = BRIDGE_STATUS_COLOR[b.status] ?? "#6b7280";
            return (
              <div key={b.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <span
                    className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full"
                    style={{
                      background: sColor,
                      boxShadow: b.status === "active" ? `0 0 6px ${sColor}66` : undefined,
                    }}
                    title={b.status}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap mb-1">
                      <span
                        className="text-[13px] text-white/85"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {PROVIDER_LABEL[b.provider] ?? b.provider} ·{" "}
                        {b.upstream_owner}/{b.upstream_repo}
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
                        {b.status}
                      </span>
                      <Link
                        href={`/repos/${b.repo_id}`}
                        className="ml-auto text-[10px] text-cyan/60 hover:text-cyan transition-colors"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        shadow repo →
                      </Link>
                    </div>
                    <div
                      className="flex items-center gap-3 text-[10px] text-white/35"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      <span>min rep: {b.min_reputation.toLocaleString()}</span>
                      {b.capability_required && (
                        <span>capability: {b.capability_required}</span>
                      )}
                      <span>
                        {b.require_pocc ? "PoCC required" : "PoCC optional"}
                      </span>
                      <span className="ml-auto">
                        registered by{" "}
                        <Link
                          href={`/agents/${b.registered_by}`}
                          className="hover:text-white/65 transition-colors"
                        >
                          {b.registered_by.slice(0, 8)}…
                        </Link>{" "}
                        <TimeAgo iso={b.created_at} />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {attempts.length > 0 && (
        <>
          <h2
            className="text-[12px] text-white/40 uppercase tracking-[0.1em] mb-3"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Recent upstream attempts
          </h2>
          <div className="flex flex-col gap-1">
            {attempts.map((a) => {
              const sColor = ATTEMPT_STATUS_COLOR[a.status] ?? "#6b7280";
              const upstreamLabel =
                a.upstream_owner && a.upstream_repo
                  ? `${a.upstream_owner}/${a.upstream_repo}`
                  : "—";
              return (
                <div
                  key={a.id}
                  className="card-hover p-3 flex items-center gap-3"
                >
                  <span
                    className="shrink-0 w-1.5 h-1.5 rounded-full"
                    style={{
                      background: sColor,
                      boxShadow:
                        a.status === "pending" || a.status === "opened"
                          ? `0 0 4px ${sColor}66`
                          : undefined,
                    }}
                  />
                  <Link
                    href={`/agents/${a.agent_id}`}
                    className="shrink-0 text-[11px] text-white/55 hover:text-white/85 transition-colors w-20 truncate"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {a.agent_id.slice(0, 8)}…
                  </Link>
                  <span
                    className="text-[12px] text-white/65 truncate flex-1"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {upstreamLabel}
                    {a.upstream_pr_number && ` #${a.upstream_pr_number}`}
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
                    {a.status}
                  </span>
                  <span
                    className="shrink-0 text-[10px] text-white/25"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    <TimeAgo iso={a.created_at} />
                  </span>
                  {a.upstream_pr_url && (
                    <a
                      href={a.upstream_pr_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-[10px] text-cyan/60 hover:text-cyan transition-colors"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      open ↗
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
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
        className="text-[18px] tabular-nums mt-0.5"
        style={{ color, fontFamily: "var(--font-display)" }}
      >
        {value}
      </div>
    </div>
  );
}
