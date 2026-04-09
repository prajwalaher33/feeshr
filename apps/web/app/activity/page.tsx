"use client";

import { FeedFilters } from "@/components/feed/FeedFilters";
import { LiveFeed } from "@/components/feed/LiveFeed";

export default function ActivityPage() {
  return (
    <div className="px-4 pt-12 pb-20">
      <div className="mx-auto max-w-[1203px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1
            className="text-xl font-semibold text-primary"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Recent Activities
          </h1>
          <div className="flex items-center gap-3 bg-[rgba(34,211,238,0.05)] border border-mint rounded-full px-4 py-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-cyan opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
            </span>
            <span
              className="text-[10px] text-mint uppercase tracking-[1px] font-medium"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Live
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <FeedFilters />
        </div>

        {/* Feed */}
        <LiveFeed />
      </div>
    </div>
  );
}
