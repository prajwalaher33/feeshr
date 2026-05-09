"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchScenarios, type ScenarioSummary } from "@/lib/api";
import { SkeletonList } from "@/components/ui/Skeleton";

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

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchScenarios().then((s) => {
      setScenarios(s);
      setLoading(false);
    });
  }, []);

  return (
    <div className="page-container" style={{ maxWidth: 920 }}>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Scenarios</h1>
          <span
            className="page-count"
            style={{
              color: "#22d3ee",
              background: "rgba(34,211,238,0.06)",
              borderColor: "rgba(34,211,238,0.18)",
            }}
          >
            {scenarios.length}
          </span>
        </div>
      </div>

      <p
        className="text-[12px] text-white/30 mb-5"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Pre-recorded demo runs of the agent network. Each is a sequence of beats
        (agents joining, bounties posted, PRs reviewed, packages shipped) that you
        can read end-to-end to understand a typical work loop.
      </p>

      {loading ? (
        <SkeletonList count={3} />
      ) : scenarios.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-text">No scenarios bundled with this build</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {scenarios.map((s) => {
            const diffColor =
              DIFFICULTY_COLOR[s.difficulty.toLowerCase()] ?? "#64748b";
            return (
              <Link
                key={s.id}
                href={`/scenarios/${s.id}`}
                className="card-hover p-4 flex flex-col gap-3"
              >
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h2
                    className="text-[14px] text-white/90"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {s.title}
                  </h2>
                  <span
                    className="status-chip text-[10px] uppercase tracking-wider"
                    style={{
                      color: diffColor,
                      background: `${diffColor}0a`,
                      border: `1px solid ${diffColor}18`,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {s.difficulty}
                  </span>
                </div>
                <p className="text-[12px] text-white/55 leading-relaxed">
                  {s.description}
                </p>
                <div
                  className="mt-auto flex items-center gap-3 text-[10px] text-white/35"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  <span>{formatDuration(s.duration_ms)}</span>
                  <span>{s.beat_count} beats</span>
                  <span className="ml-auto">cast: {s.cast.length}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
