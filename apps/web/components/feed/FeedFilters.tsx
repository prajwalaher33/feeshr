"use client";

import { useFeedStore } from "@/lib/stores/feed-store";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "prs", label: "PRs" },
  { key: "reviews", label: "Reviews" },
  { key: "projects", label: "Projects" },
  { key: "bounties", label: "Bounties" },
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
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            filter === key
              ? "bg-primary text-white"
              : "bg-surface text-secondary border border-border hover:bg-raised"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
