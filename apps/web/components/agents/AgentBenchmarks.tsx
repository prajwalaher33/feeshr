"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAgentBenchmarks,
  type AgentBenchmarkLevel,
} from "@/lib/api";

interface AgentBenchmarksProps {
  agentId: string;
}

const LEVEL_LABEL: Record<number, string> = {
  1: "L1 · basic",
  2: "L2 · intermediate",
  3: "L3 · advanced",
  4: "L4 · expert",
  5: "L5 · master",
};

function levelLabel(level: number): string {
  return LEVEL_LABEL[level] ?? `L${level}`;
}

function isExpired(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

export function AgentBenchmarks({ agentId }: AgentBenchmarksProps) {
  const [levels, setLevels] = useState<AgentBenchmarkLevel[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchAgentBenchmarks(agentId).then((data) => {
      setLevels(data);
      setLoading(false);
    });
  }, [agentId]);

  const passed = useMemo(
    () => (levels ?? []).filter((l) => l.passed && !isExpired(l.expires_at)),
    [levels],
  );

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

  if (!levels || levels.length === 0) {
    return (
      <div className="card p-5">
        <Title />
        <p
          className="text-[12px] text-white/30 mt-2"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          No benchmark attempts yet
        </p>
      </div>
    );
  }

  // Sort: passed-and-active first (high level first), then attempted/expired,
  // then untouched. Caps at level 5.
  const sorted = [...levels].sort((a, b) => {
    const aActive = a.passed && !isExpired(a.expires_at);
    const bActive = b.passed && !isExpired(b.expires_at);
    if (aActive !== bActive) return aActive ? -1 : 1;
    return b.level - a.level;
  });

  return (
    <div className="card p-5">
      <div className="flex items-baseline gap-3 mb-3">
        <Title />
        <span
          className="ml-auto text-[10px] text-white/25"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {passed.length} passed
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {sorted.map((l) => {
          const expired = isExpired(l.expires_at);
          const active = l.passed && !expired;
          const color = active ? "#28c840" : expired ? "#f7c948" : "#6b7280";
          const passRate =
            l.total_attempts > 0
              ? Math.round((l.total_passes / l.total_attempts) * 100)
              : 0;
          const tooltip = active
            ? `Passed · best ${l.best_score ?? "—"} · ${passRate}% (${l.total_passes}/${l.total_attempts})`
            : expired
              ? `Expired — needs re-attempt · best ${l.best_score ?? "—"}`
              : `Not passed · ${l.total_attempts} attempt${l.total_attempts !== 1 ? "s" : ""}`;
          return (
            <span
              key={l.level}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px]"
              style={{
                background: `${color}10`,
                border: `1px solid ${color}24`,
                color: "rgba(255,255,255,0.7)",
                fontFamily: "var(--font-mono)",
              }}
              title={tooltip}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: color,
                  boxShadow: active ? `0 0 4px ${color}66` : undefined,
                }}
              />
              {levelLabel(l.level)}
              {l.best_score !== null && (
                <span className="text-white/40 tabular-nums">
                  {l.best_score}
                </span>
              )}
            </span>
          );
        })}
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
      Benchmarks
    </h3>
  );
}
