"use client";

import { useEffect, useState, useMemo } from "react";
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from "recharts";
import { fetchFeedEvents } from "@/lib/api";
import type { FeedEvent } from "@/lib/types/events";

const HOURS = 24;
const REFRESH_MS = 60_000;

interface Bucket {
  hour: string;
  hourMs: number;
  count: number;
}

function bucketHourLabel(date: Date): string {
  const h = date.getHours();
  return `${h.toString().padStart(2, "0")}:00`;
}

function eventTimestampMs(e: FeedEvent): number {
  if ("timestamp" in e && typeof e.timestamp === "string") {
    const t = new Date(e.timestamp).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

function buildBuckets(events: FeedEvent[]): Bucket[] {
  const now = new Date();
  // Round to current hour
  now.setMinutes(0, 0, 0);
  const buckets: Bucket[] = [];
  for (let i = HOURS - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 60 * 60 * 1000);
    buckets.push({ hour: bucketHourLabel(d), hourMs: d.getTime(), count: 0 });
  }
  events.forEach((e) => {
    const ms = eventTimestampMs(e);
    if (ms === 0) return;
    // Find bucket where hourMs <= ms < hourMs + 1h
    for (const b of buckets) {
      if (ms >= b.hourMs && ms < b.hourMs + 60 * 60 * 1000) {
        b.count++;
        return;
      }
    }
  });
  return buckets;
}

interface TooltipPayload {
  payload: Bucket;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const b = payload[0].payload;
  return (
    <div
      className="rounded-md px-2.5 py-1.5 text-[11px]"
      style={{
        background: "rgba(13, 18, 25, 0.96)",
        border: "1px solid rgba(255,255,255,0.08)",
        fontFamily: "var(--font-mono)",
      }}
    >
      <div className="text-white/80">{b.hour}</div>
      <div className="text-cyan/80">{b.count} event{b.count === 1 ? "" : "s"}</div>
    </div>
  );
}

export function ActivitySparkline() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const fresh = await fetchFeedEvents(200);
      if (!cancelled) {
        setEvents(fresh);
        setLoading(false);
      }
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const buckets = useMemo(() => buildBuckets(events), [events]);
  const total = buckets.reduce((s, b) => s + b.count, 0);
  const peak = buckets.reduce((m, b) => (b.count > m ? b.count : m), 0);

  return (
    <div className="card p-5 relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 70% 50% at 50% 100%, rgba(34,211,238,0.04) 0%, transparent 60%)" }}
      />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-[14px] font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
              Activity · last 24h
            </h2>
            <p className="text-[11px] text-white/30 mt-0.5">
              Events per hour across the network
            </p>
          </div>
          <div className="text-right">
            <div className="text-[18px] font-bold text-white tracking-tight tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
              {total.toLocaleString()}
            </div>
            <div className="text-[9px] text-white/30 uppercase tracking-[0.12em]" style={{ fontFamily: "var(--font-mono)" }}>
              total · peak {peak}/hr
            </div>
          </div>
        </div>

        <div style={{ height: 120 }}>
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="spinner" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={buckets} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="hour"
                  tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                  axisLine={false}
                  tickLine={false}
                  interval={5}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(34,211,238,0.2)", strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#22d3ee"
                  strokeWidth={1.5}
                  fill="url(#activityGradient)"
                  isAnimationActive
                  animationDuration={500}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
