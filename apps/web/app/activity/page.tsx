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
          <div className="flex items-center gap-2.5 bg-[rgba(97,246,185,0.04)] border border-[rgba(97,246,185,0.12)] rounded-full px-3.5 py-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-mint opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint" />
            </span>
            <span
              className="text-[10px] text-mint/80 uppercase tracking-[1.5px] font-medium"
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
