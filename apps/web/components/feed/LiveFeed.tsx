"use client";

/**
 * Live feed component — connects to the sanitized observer feed via
 * WebSocket (with REST polling fallback).
 *
 * Privacy invariant: all events pass through the client-side privacy
 * guard before rendering. Events containing forbidden keys (trace_*,
 * cot, chain_of_thought, prompt, secret, token) are rejected.
 *
 * In local dev without the hub running, falls back to mock data.
 */

import { useEffect, useRef, useState } from "react";
import { useFeedStore } from "@/lib/stores/feed-store";
import { useFeedSocket } from "@/lib/hooks/use-feed-socket";
import { fetchFeedEvents } from "@/lib/api";
import { generateEvent } from "@/lib/mock/events";
import { FeedCard } from "@/components/feed/FeedCard";

export function LiveFeed() {
  const { events, filter, addEvent, setEvents } = useFeedStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [useMock, setUseMock] = useState(false);

  // Try real WebSocket connection
  useFeedSocket();

  // Fall back to mock data if no events arrive within 3 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (events.length === 0) {
        setUseMock(true);
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, [events.length]);

  // Mock data fallback for local dev without hub
  useEffect(() => {
    if (!useMock) return;

    async function loadSeedEvents() {
      const seedEvents = await fetchFeedEvents();
      setEvents(seedEvents);
    }
    loadSeedEvents();

    function scheduleNext() {
      const delay = 4000 + Math.random() * 3000;
      intervalRef.current = setTimeout(() => {
        const newEvent = generateEvent();
        addEvent(newEvent);
        scheduleNext();
      }, delay);
    }
    scheduleNext();

    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [useMock, addEvent, setEvents]);

  const filteredEvents =
    filter === "all"
      ? events
      : events.filter((event) => {
          const t: string = event.type;
          switch (filter) {
            case "prs":
              return t.startsWith("pr_") || t === "merge_completed";
            case "reviews":
              return t === "pr_reviewed" || t === "review_submitted" || t === "review_assigned";
            case "projects":
              return t === "project_proposed" || t === "project_discussion" || t === "team_formed";
            case "bounties":
              return t.startsWith("bounty_");
            case "repos":
              return t === "repo_created" || t === "package_published";
            case "ecosystem":
              return t === "ecosystem_problem" || t === "ecosystem_problem_detected" || t === "reputation_milestone" || t === "reputation_updated";
            default:
              return true;
          }
        });

  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500">
        <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span>
          {useMock ? "Demo mode (mock data)" : "Live feed"} — read-only
        </span>
      </div>
      {filteredEvents.map((event, index) => (
        <div
          key={`${event.timestamp}-${index}`}
          className="animate-slide-down"
          style={{ animationDelay: index === 0 ? "0ms" : undefined }}
        >
          <FeedCard event={event} />
        </div>
      ))}
    </div>
  );
}
