"use client";

import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import {
  fetchScenario,
  type ScenarioDefinition,
  type ScenarioBeat,
} from "@/lib/api";
import { SkeletonList } from "@/components/ui/Skeleton";

const KIND_COLOR: Record<string, string> = {
  "scene.start": "#64748b",
  "scene.end": "#64748b",
  "agent.join": "#22d3ee",
  "agent.leave": "#6b7280",
  "bounty.post": "#8b5cf6",
  "bounty.claim": "#f7c948",
  "bounty.deliver": "#6366f1",
  "bounty.accept": "#28c840",
  "pr.open": "#22d3ee",
  "pr.review": "#f7c948",
  "pr.merge": "#8b5cf6",
  "issue.open": "#f7c948",
  "package.publish": "#28c840",
  "decision.propose": "#6366f1",
  "decision.vote": "#f7c948",
  "decision.resolve": "#28c840",
};

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "#28c840",
  medium: "#f7c948",
  hard: "#ff6b6b",
  intense: "#ef4444",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}

function formatTimestamp(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
  const m = Math.floor(s / 60);
  const r = (s % 60).toFixed(0);
  return `${m}m${r === "0" ? "" : ` ${r}s`}`;
}

export default function ScenarioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [scenario, setScenario] = useState<ScenarioDefinition | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchScenario(id).then((s) => {
      setScenario(s);
      setLoading(false);
    });
  }, [id]);

  // Derive distinct kind counts for the small "what happens" summary.
  const kindCounts = useMemo(() => {
    if (!scenario) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const b of scenario.beat) {
      m.set(b.kind, (m.get(b.kind) ?? 0) + 1);
    }
    return m;
  }, [scenario]);

  if (loading) {
    return (
      <div className="page-container">
        <SkeletonList count={5} />
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <span className="empty-state-text">Scenario not found</span>
          <Link
            href="/scenarios"
            className="mt-3 text-[12px] text-cyan/70 hover:text-cyan transition-colors"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            ← All scenarios
          </Link>
        </div>
      </div>
    );
  }

  const diffColor =
    DIFFICULTY_COLOR[scenario.difficulty.toLowerCase()] ?? "#64748b";

  return (
    <div className="page-container" style={{ maxWidth: 920 }}>
      <div className="mb-4">
        <Link
          href="/scenarios"
          className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          ← All scenarios
        </Link>
      </div>

      <div className="card p-5 mb-5">
        <div className="flex items-baseline gap-2 flex-wrap mb-2">
          <h1
            className="text-[20px] text-white/90 font-medium leading-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {scenario.title}
          </h1>
          <span
            className="status-chip text-[10px] uppercase tracking-wider"
            style={{
              color: diffColor,
              background: `${diffColor}0a`,
              border: `1px solid ${diffColor}18`,
              fontFamily: "var(--font-mono)",
            }}
          >
            {scenario.difficulty}
          </span>
        </div>
        <p className="text-[13px] text-white/70 leading-relaxed mb-3">
          {scenario.description}
        </p>
        <div
          className="flex items-center gap-3 text-[11px] text-white/40"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span>{formatDuration(scenario.duration_ms)}</span>
          <span>{scenario.beat.length} beats</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {scenario.cast.map((c) => (
            <Link
              key={c}
              href={`/agents/${c}`}
              className="status-chip text-[11px] hover:opacity-80 transition-opacity"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {c}
            </Link>
          ))}
        </div>
      </div>

      {kindCounts.size > 0 && (
        <div className="card p-4 mb-5">
          <div
            className="text-[10px] uppercase tracking-[0.1em] text-white/40 mb-2"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Beat breakdown
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from(kindCounts.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([kind, count]) => {
                const c = KIND_COLOR[kind] ?? "#64748b";
                return (
                  <span
                    key={kind}
                    className="status-chip text-[11px]"
                    style={{
                      color: c,
                      background: `${c}0a`,
                      border: `1px solid ${c}18`,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {kind} · {count}
                  </span>
                );
              })}
          </div>
        </div>
      )}

      <h2
        className="text-[12px] text-white/40 uppercase tracking-[0.1em] mb-3"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Timeline
      </h2>

      <ol className="flex flex-col">
        {scenario.beat.map((b: ScenarioBeat, i: number) => (
          <BeatRow
            key={i}
            beat={b}
            isLast={i === scenario.beat.length - 1}
            totalMs={scenario.duration_ms}
          />
        ))}
      </ol>
    </div>
  );
}

function BeatRow({
  beat,
  isLast,
  totalMs,
}: {
  beat: ScenarioBeat;
  isLast: boolean;
  totalMs: number;
}) {
  const color = KIND_COLOR[beat.kind] ?? "#64748b";
  const pct = totalMs > 0 ? Math.min(100, (beat.t / totalMs) * 100) : 0;
  const actor = beat.actor ?? beat.agent;

  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center w-12 shrink-0">
        <span
          className="text-[10px] text-white/40 mb-1 mt-0.5 tabular-nums"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {formatTimestamp(beat.t)}
        </span>
        <span
          className="w-2 h-2 rounded-full"
          style={{
            background: color,
            boxShadow: `0 0 4px ${color}66`,
          }}
        />
        {!isLast && (
          <span
            className="flex-1 w-px my-1"
            style={{ background: "rgba(203,213,225,0.10)" }}
          />
        )}
      </div>

      <div className={isLast ? "flex-1 min-w-0 pb-0" : "flex-1 min-w-0 pb-4"}>
        <div
          className="flex items-baseline gap-2 flex-wrap mb-1"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span className="text-[11px]" style={{ color }}>
            {beat.kind}
          </span>
          {actor && (
            <span className="text-[11px] text-white/60">{actor}</span>
          )}
          {beat.target && (
            <span className="text-[10px] text-white/30">→ {beat.target}</span>
          )}
        </div>
        {beat.narration && (
          <p className="text-[12px] text-white/65 leading-relaxed">
            {beat.narration}
          </p>
        )}
        {/* Tiny progress bar showing where in the run this beat lands. */}
        <div
          className="mt-1.5 h-px w-full overflow-hidden"
          style={{ background: "rgba(203,213,225,0.06)" }}
        >
          <div
            className="h-full"
            style={{
              width: `${pct}%`,
              background: color,
              opacity: 0.4,
            }}
          />
        </div>
      </div>
    </li>
  );
}
