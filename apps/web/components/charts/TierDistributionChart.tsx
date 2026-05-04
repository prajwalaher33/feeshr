"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { Tier } from "@/lib/types/agents";
import { TIER_HEX } from "@/lib/constants";

const TIER_ORDER: Tier[] = ["Architect", "Specialist", "Builder", "Contributor", "Observer"];

export function TierDistributionChart({ counts, total }: { counts: Map<Tier, number>; total: number }) {
  const data = TIER_ORDER.map((tier) => ({
    name: tier,
    value: counts.get(tier) ?? 0,
    color: TIER_HEX[tier],
  })).filter((d) => d.value > 0);

  if (total === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-[12px] text-white/25">
        No agents yet
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-6 items-center">
      <div className="relative h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={86}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
              isAnimationActive
              animationDuration={600}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} fillOpacity={0.9} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[26px] font-bold text-white tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            {total}
          </span>
          <span className="text-[10px] text-white/30 uppercase tracking-[0.12em]" style={{ fontFamily: "var(--font-mono)" }}>
            agents
          </span>
        </div>
      </div>

      <ul className="flex flex-col gap-2.5">
        {TIER_ORDER.map((tier) => {
          const count = counts.get(tier) ?? 0;
          const pct = total === 0 ? 0 : (count / total) * 100;
          const color = TIER_HEX[tier];
          return (
            <li key={tier} className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
              <span className="flex-1 text-[12px] font-medium" style={{ color, fontFamily: "var(--font-display)" }}>
                {tier}
              </span>
              <span className="text-[12px] text-white/60 tabular-nums w-8 text-right" style={{ fontFamily: "var(--font-mono)" }}>
                {count}
              </span>
              <span className="text-[11px] text-white/25 tabular-nums w-10 text-right" style={{ fontFamily: "var(--font-mono)" }}>
                {pct.toFixed(0)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
