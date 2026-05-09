"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchAgentPoccStats, type AgentPoccStats } from "@/lib/api";

interface AgentPoccStatsProps {
  agentId: string;
}

const WORK_TYPE_COLOR: Record<string, string> = {
  refactor: "#22d3ee",
  feature: "#28c840",
  bugfix: "#f7c948",
  docs: "#8b5cf6",
  test: "#6366f1",
  review: "#f59e0b",
  security: "#ff6b6b",
};

function colorForWorkType(name: string): string {
  if (WORK_TYPE_COLOR[name]) return WORK_TYPE_COLOR[name];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

export function AgentPoccStats({ agentId }: AgentPoccStatsProps) {
  const [data, setData] = useState<AgentPoccStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchAgentPoccStats(agentId).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [agentId]);

  const sortedWorkTypes = useMemo(() => {
    if (!data?.work_types) return [];
    return Object.entries(data.work_types)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [data]);

  const workTypeTotal = useMemo(
    () => sortedWorkTypes.reduce((sum, [, c]) => sum + c, 0),
    [sortedWorkTypes],
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

  if (!data || data.total_chains === 0) {
    return (
      <div className="card p-5">
        <Title />
        <p
          className="text-[12px] text-white/30 mt-2"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          No PoCC chains yet
        </p>
      </div>
    );
  }

  const consistencyPct = Math.round(data.consistency_rate * 100);
  const consistencyColor =
    consistencyPct >= 90 ? "#28c840" : consistencyPct >= 70 ? "#f7c948" : "#ff6b6b";

  return (
    <div className="card p-5">
      <div className="flex items-baseline gap-3 mb-4">
        <Title />
        <Link
          href={`/pocc?agent=${agentId}`}
          className="ml-auto text-[10px] text-cyan/60 hover:text-cyan transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          view chains →
        </Link>
      </div>

      <div className="flex items-center gap-6 mb-4">
        <Stat
          label="Consistency"
          value={`${consistencyPct}%`}
          color={consistencyColor}
        />
        <Stat label="Total" value={String(data.total_chains)} color="rgba(255,255,255,0.85)" />
        <Stat label="Verified" value={String(data.verified_chains)} color="#28c840" />
        <Stat label="Invalid" value={String(data.invalid_chains)} color="#ff6b6b" />
        <Stat
          label="Avg steps"
          value={data.avg_steps_per_chain.toFixed(1)}
          color="rgba(255,255,255,0.85)"
        />
      </div>

      <div className="relative w-full h-1 rounded-full bg-white/[0.04] overflow-hidden mb-4">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
          style={{ width: `${consistencyPct}%`, background: consistencyColor }}
        />
      </div>

      {sortedWorkTypes.length > 0 && (
        <>
          <div
            className="text-[10px] text-white/40 uppercase tracking-[0.1em] mb-2"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Work mix
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sortedWorkTypes.map(([name, count]) => {
              const color = colorForWorkType(name);
              const pct = workTypeTotal > 0 ? Math.round((count / workTypeTotal) * 100) : 0;
              return (
                <span
                  key={name}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px]"
                  style={{
                    background: `${color}10`,
                    border: `1px solid ${color}24`,
                    color: "rgba(255,255,255,0.7)",
                    fontFamily: "var(--font-mono)",
                  }}
                  title={`${count} chain${count !== 1 ? "s" : ""} (${pct}%)`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: color }}
                  />
                  {name}
                  <span className="text-white/40 tabular-nums">{count}</span>
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Title() {
  return (
    <h3
      className="text-[13px] font-semibold text-white"
      style={{ fontFamily: "var(--font-display)" }}
    >
      PoCC chain consistency
    </h3>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div
        className="text-[9px] text-white/30 uppercase tracking-[0.1em]"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {label}
      </div>
      <div
        className="text-[16px] tabular-nums mt-0.5"
        style={{ color, fontFamily: "var(--font-display)" }}
      >
        {value}
      </div>
    </div>
  );
}
