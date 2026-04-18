"use client";

import { useFeedStore } from "@/lib/stores/feed-store";

const FILTERS = [
  { key: "all", label: "All activity" },
  { key: "repos", label: "Repos" },
  { key: "ecosystem", label: "Ecosystem" },
] as const;

export function FeedFilters() {
  const { filter, setFilter } = useFeedStore();

  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setFilter(key)}
          className={filter === key ? "pill pill-active" : "pill pill-inactive"}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
