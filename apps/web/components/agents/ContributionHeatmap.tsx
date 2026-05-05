"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchAgentActivity, type AgentActivity } from "@/lib/api";

const WEEKS = 14;
const DAYS_PER_WEEK = 7;
const TOTAL_DAYS = WEEKS * DAYS_PER_WEEK;

interface DayCell {
  iso: string;          // YYYY-MM-DD
  date: Date;
  count: number;
}

function startOfDayMs(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildGrid(activities: AgentActivity[]): DayCell[] {
  // Anchor on today; align so today is in the rightmost column
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDow = today.getDay(); // 0 = Sun

  // Pad to end the grid on Saturday (so today is somewhere in the last week)
  const padEnd = (DAYS_PER_WEEK - 1) - todayDow;

  const cells: DayCell[] = [];
  // Start: today - (TOTAL_DAYS - 1 - padEnd) days
  const startMs = today.getTime() - (TOTAL_DAYS - 1 - padEnd) * 86_400_000;
  for (let i = 0; i < TOTAL_DAYS; i++) {
    const d = new Date(startMs + i * 86_400_000);
    cells.push({ iso: isoDay(d), date: d, count: 0 });
  }

  const counts = new Map<string, number>();
  activities.forEach((a) => {
    const ms = startOfDayMs(new Date(a.created_at));
    const key = isoDay(new Date(ms));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  cells.forEach((c) => { c.count = counts.get(c.iso) ?? 0; });
  return cells;
}

function intensityClass(count: number): { bg: string; alpha: number } {
  if (count === 0) return { bg: "rgba(255,255,255,0.04)", alpha: 0 };
  if (count === 1) return { bg: "rgba(34,211,238,0.18)", alpha: 0.18 };
  if (count <= 3) return { bg: "rgba(34,211,238,0.32)", alpha: 0.32 };
  if (count <= 6) return { bg: "rgba(34,211,238,0.55)", alpha: 0.55 };
  return { bg: "rgba(34,211,238,0.85)", alpha: 0.85 };
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function ContributionHeatmap({ agentId }: { agentId: string }) {
  const [activities, setActivities] = useState<AgentActivity[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAgentActivity(agentId, 200).then((data) => {
      if (!cancelled) setActivities(data);
    });
    return () => { cancelled = true; };
  }, [agentId]);

  const cells = useMemo(() => buildGrid(activities ?? []), [activities]);
  const totalActivity = cells.reduce((s, c) => s + c.count, 0);
  const activeDays = cells.filter((c) => c.count > 0).length;

  // Build columns of 7 days for grid layout
  const columns: DayCell[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    columns.push(cells.slice(w * DAYS_PER_WEEK, (w + 1) * DAYS_PER_WEEK));
  }

  // Month labels: only show when month changes between weeks
  const monthLabels: { idx: number; label: string }[] = [];
  let lastMonth = -1;
  columns.forEach((col, idx) => {
    const m = col[0]?.date.getMonth();
    if (m !== undefined && m !== lastMonth) {
      monthLabels.push({ idx, label: MONTH_LABELS[m] });
      lastMonth = m;
    }
  });

  return (
    <div className="card p-5 relative overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[14px] font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
            Activity · last {WEEKS} weeks
          </h2>
          {activities !== null && (
            <p className="text-[11px] text-white/30 mt-0.5">
              {totalActivity.toLocaleString()} actions across {activeDays} active day{activeDays === 1 ? "" : "s"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-white/30" style={{ fontFamily: "var(--font-mono)" }}>
          <span>less</span>
          {[0, 1, 2, 4, 8].map((n) => {
            const i = intensityClass(n);
            return (
              <span
                key={n}
                className="w-2.5 h-2.5 rounded-[2px]"
                style={{ background: i.bg, border: i.alpha === 0 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
              />
            );
          })}
          <span>more</span>
        </div>
      </div>

      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <div className="inline-block min-w-full">
          {/* Month label row */}
          <div className="flex gap-[3px] mb-1.5 ml-[18px] text-[9px] text-white/30" style={{ fontFamily: "var(--font-mono)" }}>
            {columns.map((_, i) => {
              const label = monthLabels.find((m) => m.idx === i)?.label;
              return (
                <span
                  key={i}
                  className="w-[12px] text-left"
                >
                  {label ?? ""}
                </span>
              );
            })}
          </div>
          {/* Grid + day-of-week labels */}
          <div className="flex gap-[3px]">
            {/* Day-of-week labels (Mon, Wed, Fri) */}
            <div className="flex flex-col gap-[3px] text-[9px] text-white/25 mr-1 w-[14px]" style={{ fontFamily: "var(--font-mono)" }}>
              <span className="h-[12px]"></span>
              <span className="h-[12px]">M</span>
              <span className="h-[12px]"></span>
              <span className="h-[12px]">W</span>
              <span className="h-[12px]"></span>
              <span className="h-[12px]">F</span>
              <span className="h-[12px]"></span>
            </div>
            {columns.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-[3px]">
                {col.map((cell) => {
                  const intensity = intensityClass(cell.count);
                  const isFuture = cell.date.getTime() > Date.now();
                  return (
                    <div
                      key={cell.iso}
                      className="w-[12px] h-[12px] rounded-[2px] transition-transform hover:scale-125"
                      style={{
                        background: isFuture ? "transparent" : intensity.bg,
                        border: intensity.alpha === 0 && !isFuture ? "1px solid rgba(255,255,255,0.04)" : "none",
                        opacity: isFuture ? 0.15 : 1,
                      }}
                      title={`${cell.iso} · ${cell.count} action${cell.count === 1 ? "" : "s"}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
