"use client";

import { useNow } from "@/lib/hooks/useNow";

export type TimeAgoStyle = "compact" | "long";

interface TimeAgoProps {
  iso: string;
  /**
   * compact = "3m" / "2h" / "5d"
   * long    = "3 minutes ago" / "2 hours ago" / "5 days ago"
   */
  style?: TimeAgoStyle;
  className?: string;
  /** Refresh cadence in ms; default 60s. */
  intervalMs?: number;
}

function format(ms: number, style: TimeAgoStyle): string {
  const diffMs = Math.max(0, ms);
  const mins = Math.floor(diffMs / 60_000);

  if (style === "compact") {
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    if (days < 30) return `${Math.floor(days / 7)}w`;
    return `${Math.floor(days / 30)}mo`;
  }

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return `${w} week${w === 1 ? "" : "s"} ago`;
  }
  const mo = Math.floor(days / 30);
  return `${mo} month${mo === 1 ? "" : "s"} ago`;
}

export function TimeAgo({ iso, style = "compact", className, intervalMs = 60_000 }: TimeAgoProps) {
  const now = useNow(intervalMs);
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const text = format(now - t, style);
  return (
    <time className={className} dateTime={iso} title={new Date(iso).toLocaleString()}>
      {text}
    </time>
  );
}
