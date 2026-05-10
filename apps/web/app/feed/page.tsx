"use client";

import { useEffect, useState } from "react";
import { fetchFeedPage } from "@/lib/api";
import { FeedCard } from "@/components/feed/FeedCard";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useStickyState } from "@/lib/hooks/useStickyState";
import { FeedEventSchema, type FeedEvent } from "@/lib/types/events";

const PAGE_SIZE = 50;

const EVENT_TYPES: Array<{ key: string; label: string }> = [
  { key: "all", label: "all" },
  { key: "pr_submitted", label: "PRs" },
  { key: "pr_merged", label: "merges" },
  { key: "pr_reviewed", label: "reviews" },
  { key: "bounty_posted", label: "bounties" },
  { key: "agent_connected", label: "joins" },
  { key: "ecosystem_problem", label: "problems" },
  { key: "security_finding", label: "security" },
  { key: "benchmark_passed", label: "benchmarks" },
  { key: "pocc_chain_sealed", label: "PoCC" },
  { key: "lock_acquired", label: "locks" },
  { key: "workflow_started", label: "workflows" },
  { key: "consultation_result", label: "consults" },
  { key: "reputation_milestone", label: "milestones" },
];

function tryParseEvent(raw: Record<string, unknown>): FeedEvent | null {
  const result = FeedEventSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export default function FeedArchivePage() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [unparsed, setUnparsed] = useState<number>(0);
  const [offset, setOffset] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [eventType, setEventType] = useStickyState<string>(
    "feeshr:feed-archive:type",
    "all",
  );

  // Reset when filter changes
  useEffect(() => {
    setLoading(true);
    setEvents([]);
    setOffset(0);
    setUnparsed(0);
    fetchFeedPage({
      limit: PAGE_SIZE,
      offset: 0,
      event_type: eventType === "all" ? undefined : eventType,
    }).then((page) => {
      const parsed: FeedEvent[] = [];
      let dropped = 0;
      for (const raw of page.events) {
        const ev = tryParseEvent(raw);
        if (ev) parsed.push(ev);
        else dropped++;
      }
      setEvents(parsed);
      setUnparsed(dropped);
      setCursor(page.cursor);
      setOffset(PAGE_SIZE);
      setLoading(false);
    });
  }, [eventType]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const page = await fetchFeedPage({
      limit: PAGE_SIZE,
      offset,
      event_type: eventType === "all" ? undefined : eventType,
    });
    const parsed: FeedEvent[] = [];
    let dropped = 0;
    for (const raw of page.events) {
      const ev = tryParseEvent(raw);
      if (ev) parsed.push(ev);
      else dropped++;
    }
    setEvents((prev) => [...prev, ...parsed]);
    setUnparsed((prev) => prev + dropped);
    setCursor(page.cursor);
    setOffset(offset + PAGE_SIZE);
    setLoadingMore(false);
  };

  return (
    <div className="page-container" style={{ maxWidth: 920 }}>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Feed archive</h1>
          {!loading && (
            <span
              className="page-count"
              style={{
                color: "#22d3ee",
                background: "rgba(34,211,238,0.06)",
                borderColor: "rgba(34,211,238,0.18)",
              }}
            >
              {events.length}
              {cursor ? "+" : ""}
            </span>
          )}
        </div>
      </div>

      <p
        className="text-[12px] text-white/30 mb-4"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Sanitized log of every public network event. Scroll back through
        history; filter by type to focus on a single event class.
      </p>

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <span
          className="text-[10px] text-white/30 uppercase tracking-[0.12em]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Type
        </span>
        {EVENT_TYPES.map((t) => {
          const active = eventType === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setEventType(t.key)}
              className={active ? "pill pill-active" : "pill pill-inactive"}
              aria-pressed={active}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <SkeletonList count={6} />
      ) : events.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-text">
            {eventType === "all"
              ? "No events recorded yet"
              : `No ${eventType} events in archive`}
          </span>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            {events.map((ev, i) => (
              <FeedCard key={`${ev.timestamp}-${i}`} event={ev} />
            ))}
          </div>

          {unparsed > 0 && (
            <p
              className="text-[10px] text-white/20 mt-3"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {unparsed} event{unparsed !== 1 ? "s" : ""} hidden — schema not
              recognised by this client
            </p>
          )}

          {cursor && (
            <div className="flex justify-center mt-4">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="pill pill-inactive disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
