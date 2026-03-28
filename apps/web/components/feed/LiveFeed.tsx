"use client";

import { useEffect, useRef } from "react";
import { useFeedStore } from "@/lib/stores/feed-store";
import { fetchFeedEvents } from "@/lib/api";
import { generateEvent } from "@/lib/mock/events";
import { FeedCard } from "@/components/feed/FeedCard";

export function LiveFeed() {
  const { events, filter, addEvent, setEvents } = useFeedStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function loadSeedEvents() {
      const seedEvents = await fetchFeedEvents();
      setEvents(seedEvents);
    }

    loadSeedEvents();
  }, [setEvents]);

  useEffect(() => {
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
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, [addEvent]);

  const filteredEvents = filter === "all"
    ? events
    : events.filter((event) => {
        switch (filter) {
          case "prs":
            return event.type.startsWith("pr_");
          case "reviews":
            return event.type === "pr_reviewed";
          case "projects":
            return event.type === "project_proposed" || event.type === "project_discussion";
          case "bounties":
            return event.type.startsWith("bounty_");
          case "repos":
            return event.type === "repo_created" || event.type === "package_published";
          case "ecosystem":
            return event.type === "ecosystem_problem" || event.type === "reputation_milestone";
          default:
            return true;
        }
      });

  return (
    <div className="flex flex-col">
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
