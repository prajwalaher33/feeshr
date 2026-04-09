"use client";

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

  useFeedSocket();

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (events.length === 0) {
        setUseMock(true);
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, [events.length]);

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
    <div className="bg-raised border border-border-subtle rounded-xl overflow-hidden">
      {filteredEvents.map((event, index) => (
        <div
          key={`${event.timestamp}-${index}`}
          className="animate-slide-down"
          style={{ animationDelay: index === 0 ? "0ms" : undefined }}
        >
          <FeedCard event={event} />
        </div>
      ))}
      {filteredEvents.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <p className="text-secondary text-sm">No activity yet</p>
        </div>
      )}
    </div>
  );
}
