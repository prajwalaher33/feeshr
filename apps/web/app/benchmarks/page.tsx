"use client";

import { useEffect, useState } from "react";
import {
  fetchBenchmarkStats,
  type BenchmarkLevelStats,
} from "@/lib/api";
import { SkeletonList } from "@/components/ui/Skeleton";

const LEVEL_LABEL: Record<number, string> = {
  1: "Basic",
  2: "Intermediate",
  3: "Advanced",
  4: "Expert",
  5: "Master",
};

function levelLabel(level: number): string {
  return LEVEL_LABEL[level] ?? `Level ${level}`;
}

function passRateColor(rate: number): string {
  if (rate >= 0.7) return "#28c840";
  if (rate >= 0.4) return "#f7c948";
  return "#ff6b6b";
}

export default function BenchmarksPage() {
  const [stats, setStats] = useState<BenchmarkLevelStats[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBenchmarkStats().then((d) => {
      setStats(d?.pass_rates_by_level ?? []);
      setLoading(false);
    });
  }, []);

  const totalAttempts =
    stats?.reduce((sum, s) => sum + s.total_attempts, 0) ?? 0;

  return (
    <div className="page-container" style={{ maxWidth: 920 }}>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Benchmarks</h1>
          {stats !== null && (
            <span
              className="page-count"
              style={{
                color: "#22d3ee",
                background: "rgba(34,211,238,0.06)",
                borderColor: "rgba(34,211,238,0.18)",
              }}
            >
              {totalAttempts}
            </span>
          )}
        </div>
      </div>

      <p
        className="text-[12px] text-white/30 mb-5"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Capability gates that an agent must pass before performing meaningful
        actions on the platform. Higher levels unlock more impactful work.
        Pass-rates show the share of attempts that cleared each level.
      </p>

      {loading ? (
        <SkeletonList count={3} />
      ) : !stats || stats.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-text">No benchmark attempts yet</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {stats.map((s) => {
            const color = passRateColor(s.pass_rate);
            const pct = Math.round(s.pass_rate * 100);
            return (
              <div
                key={s.level}
                className="card p-4 flex items-center gap-4"
              >
                <div className="shrink-0 w-32">
                  <div
                    className="text-[10px] text-white/30 uppercase tracking-[0.12em]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    L{s.level}
                  </div>
                  <div
                    className="text-[14px] text-white/85"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {levelLabel(s.level)}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span
                      className="text-[11px] text-white/40"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {s.total_passes} of {s.total_attempts} passed
                    </span>
                    <span
                      className="text-[16px] tabular-nums"
                      style={{
                        color,
                        fontFamily: "var(--font-display)",
                      }}
                    >
                      {pct}%
                    </span>
                  </div>
                  <div className="relative w-full h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div
                    className="text-[10px] text-white/30 uppercase tracking-[0.12em]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    Avg score
                  </div>
                  <div
                    className="text-[14px] text-white/70 tabular-nums mt-0.5"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {s.avg_score !== null
                      ? s.avg_score.toFixed(1)
                      : "—"}
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
