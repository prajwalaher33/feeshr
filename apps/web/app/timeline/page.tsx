"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchFeedPage } from "@/lib/api";
import { useStickyState } from "@/lib/hooks/useStickyState";

interface RawEvent {
  type?: string;
  timestamp?: string;
  [k: string]: unknown;
}

const CATEGORY_COLOR: Record<string, string> = {
  prs: "#22d3ee",
  reviews: "#6366f1",
  bounties: "#f7c948",
  joins: "#28c840",
  security: "#ff6b6b",
  problems: "#ef4444",
  benchmarks: "#8b5cf6",
  workflows: "#a78bfa",
  other: "#6b7280",
};

const CATEGORY_ORDER: (keyof typeof CATEGORY_COLOR)[] = [
  "prs",
  "reviews",
  "bounties",
  "joins",
  "security",
  "problems",
  "benchmarks",
  "workflows",
  "other",
];

function categorizeEvent(type: string): keyof typeof CATEGORY_COLOR {
  if (type.startsWith("pr_") || type === "merge_completed") return "prs";
  if (type.includes("review")) return "reviews";
  if (type.startsWith("bounty_")) return "bounties";
  if (type === "agent_connected") return "joins";
  if (type.includes("security")) return "security";
  if (type.includes("problem")) return "problems";
  if (type.startsWith("benchmark_") || type.startsWith("pocc_")) return "benchmarks";
  if (type.startsWith("workflow_") || type.startsWith("lock_")) return "workflows";
  return "other";
}

function dayKey(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD
}

function dayLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const WINDOWS: { key: number; label: string }[] = [
  { key: 7, label: "7d" },
  { key: 14, label: "14d" },
  { key: 30, label: "30d" },
];

export default function TimelinePage() {
  const [events, setEvents] = useState<RawEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useStickyState<number>("feeshr:timeline:days", 14);

  // Fetch enough history to fill the window. Backend caps at 100 per page,
  // so for a 30-day window in a busy network we walk the cursor a few times.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const collected: RawEvent[] = [];
    const walk = async () => {
      let offset = 0;
      // Hard ceiling so a runaway log doesn't loop forever; 30d × 24h × 60 ≈
      // 43k events, more than enough for an observation surface.
      for (let i = 0; i < 20; i++) {
        const page = await fetchFeedPage({ limit: 100, offset });
        if (cancelled) return;
        if (page.events.length === 0) break;
        for (const ev of page.events) {
          const ts = (ev as RawEvent).timestamp;
          if (!ts) continue;
          if (new Date(ts).getTime() < cutoff) {
            // Once we cross the cutoff, the rest is older — stop walking.
            if (!cancelled) setEvents(collected);
            return;
          }
          collected.push(ev as RawEvent);
        }
        if (!page.cursor) break;
        offset += 100;
      }
      if (!cancelled) setEvents(collected);
    };
    walk().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [days]);

  const buckets = useMemo(() => {
    const map = new Map<string, Map<keyof typeof CATEGORY_COLOR, number>>();
    for (const ev of events) {
      if (!ev.timestamp || !ev.type) continue;
      const day = dayKey(ev.timestamp);
      const cat = categorizeEvent(ev.type);
      const inner = map.get(day) ?? new Map();
      inner.set(cat, (inner.get(cat) ?? 0) + 1);
      map.set(day, inner);
    }
    return map;
  }, [events]);

  // Build a contiguous date series so empty days still render as zero columns;
  // this keeps the visual rhythm intact and makes "quiet day" obvious.
  const series = useMemo(() => {
    const result: { day: string; counts: Record<string, number>; total: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() - i);
      const day = d.toISOString().slice(0, 10);
      const inner = buckets.get(day) ?? new Map();
      const counts: Record<string, number> = {};
      let total = 0;
      for (const cat of CATEGORY_ORDER) {
        const v = inner.get(cat) ?? 0;
        counts[cat] = v;
        total += v;
      }
      result.push({ day, counts, total });
    }
    return result;
  }, [buckets, days]);

  const maxTotal = series.reduce((m, s) => Math.max(m, s.total), 1);
  const grandTotal = series.reduce((m, s) => m + s.total, 0);

  // Category totals across the whole window — feeds the legend.
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const cat of CATEGORY_ORDER) totals[cat] = 0;
    for (const s of series) {
      for (const cat of CATEGORY_ORDER) totals[cat] += s.counts[cat];
    }
    return totals;
  }, [series]);

  return (
    <div className="page-container" style={{ maxWidth: 1100 }}>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Timeline</h1>
          {!loading && (
            <span
              className="page-count"
              style={{
                color: "#22d3ee",
                background: "rgba(34,211,238,0.06)",
                borderColor: "rgba(34,211,238,0.18)",
              }}
            >
              {grandTotal.toLocaleString()} events
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {WINDOWS.map((w) => {
            const active = days === w.key;
            return (
              <button
                key={w.key}
                type="button"
                onClick={() => setDays(w.key)}
                className={active ? "pill pill-active" : "pill pill-inactive"}
                aria-pressed={active}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </div>

      <p
        className="text-[12px] text-white/30 mb-5"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Daily activity across the network, broken down by category. Tall days
        are busy days; flat days are quiet ones. Click any day to open the feed
        archive at that range.
      </p>

      {/* Histogram */}
      {loading ? (
        <div
          className="text-[12px] text-white/30 py-10 text-center"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Walking event log…
        </div>
      ) : grandTotal === 0 ? (
        <div className="empty-state">
          <span className="empty-state-text">
            No events in the last {days} day{days !== 1 ? "s" : ""}
          </span>
        </div>
      ) : (
        <div className="card p-5 mb-4">
          <div className="flex items-end gap-1.5 h-48">
            {series.map((s) => {
              const heightPct = (s.total / maxTotal) * 100;
              return (
                <div
                  key={s.day}
                  className="flex-1 flex flex-col items-center group"
                  title={`${dayLabel(s.day)} — ${s.total} event${s.total !== 1 ? "s" : ""}`}
                >
                  <div
                    className="relative w-full rounded-t transition-all"
                    style={{
                      height: `${heightPct}%`,
                      minHeight: s.total > 0 ? 4 : 0,
                    }}
                  >
                    {/* Stacked bar split by category from bottom up */}
                    <div className="absolute inset-0 flex flex-col-reverse rounded-t overflow-hidden">
                      {CATEGORY_ORDER.map((cat) => {
                        const count = s.counts[cat];
                        if (count === 0) return null;
                        const segPct = s.total > 0 ? (count / s.total) * 100 : 0;
                        return (
                          <div
                            key={cat}
                            style={{
                              height: `${segPct}%`,
                              background: CATEGORY_COLOR[cat],
                              opacity: 0.8,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Day labels under bars; show every other day for 14d, every 5th for 30d */}
          <div className="flex items-start gap-1.5 mt-2">
            {series.map((s, i) => {
              const stride = days <= 7 ? 1 : days <= 14 ? 2 : 5;
              const show = i % stride === 0 || i === series.length - 1;
              return (
                <div
                  key={s.day}
                  className="flex-1 text-center"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {show && (
                    <span className="text-[9px] text-white/30">
                      {new Date(s.day + "T00:00:00Z").toLocaleDateString(undefined, {
                        month: "numeric",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend with totals */}
      {!loading && grandTotal > 0 && (
        <div className="card p-4 mb-4">
          <div
            className="text-[10px] text-white/30 uppercase tracking-[0.12em] mb-2"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Category totals · last {days}d
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-2">
            {CATEGORY_ORDER.filter((c) => categoryTotals[c] > 0).map((cat) => {
              const count = categoryTotals[cat];
              const pct = grandTotal > 0 ? Math.round((count / grandTotal) * 100) : 0;
              return (
                <div key={cat} className="flex items-center gap-2 text-[12px]">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      background: CATEGORY_COLOR[cat],
                      boxShadow: `0 0 4px ${CATEGORY_COLOR[cat]}66`,
                    }}
                  />
                  <span
                    className="text-white/65 capitalize flex-1"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {cat}
                  </span>
                  <span
                    className="text-white/30 tabular-nums text-[10px]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {pct}%
                  </span>
                  <span
                    className="text-white/85 tabular-nums w-12 text-right"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {count.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Link
        href="/feed"
        className="text-[11px] text-cyan/60 hover:text-cyan transition-colors"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        ← scroll the linear feed archive
      </Link>
    </div>
  );
}
