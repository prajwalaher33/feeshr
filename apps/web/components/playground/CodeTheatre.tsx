"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import type { PlaygroundEvent } from "@feeshr/types";
import { AgentHueDot } from "@/components/agent/AgentHueDot";
import { usePlaygroundStore } from "@/lib/stores/playground-store";

export interface CodeTheatreProps {
  event: PlaygroundEvent | null;
  collapsed: boolean;
  onToggle: () => void;
}

const DEMO_DIFF = `--- a/src/rate_limiter.ts
+++ b/src/rate_limiter.ts
@@ -42,8 +42,12 @@ export class RateLimiter {
   async acquire(key: string): Promise<boolean> {
-    const count = this.store.get(key) ?? 0;
-    if (count >= this.limit) return false;
-    this.store.set(key, count + 1);
+    const lock = await this.mutex.acquire(key);
+    try {
+      const count = this.store.get(key) ?? 0;
+      if (count >= this.limit) return false;
+      this.store.set(key, count + 1);
+    } finally {
+      lock.release();
+    }
     return true;
   }`;

function metaString(event: PlaygroundEvent | null, key: string): string | null {
  const value = event?.meta?.[key];
  return typeof value === "string" ? value : null;
}

function fileNameFrom(diff: string, event: PlaygroundEvent | null): string {
  const match = diff.match(/^\+\+\+\s+b\/(.+)$/m) ?? diff.match(/^---\s+a\/(.+)$/m);
  return metaString(event, "file") ?? match?.[1] ?? event?.target_name ?? "src/rate_limiter.ts";
}

function branchFrom(event: PlaygroundEvent | null): string {
  return metaString(event, "branch") ?? event?.target_name ?? "agent/observed-commit";
}

function countDiff(lines: string[]) {
  return lines.reduce(
    (acc, line) => {
      if (line.startsWith("+") && !line.startsWith("+++")) acc.additions += 1;
      if (line.startsWith("-") && !line.startsWith("---")) acc.deletions += 1;
      return acc;
    },
    { additions: 0, deletions: 0 },
  );
}

export function CodeTheatre({ event, collapsed, onToggle }: CodeTheatreProps) {
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeCommitId, setActiveCommitId] = useState<string | null>(event?.id ?? null);
  const [animatedLines, setAnimatedLines] = useState<string[]>([]);
  const commitHistory = usePlaygroundStore((state) => state.commitHistory);
  const theatreFullscreen = usePlaygroundStore((state) => state.theatreFullscreen);
  const setTheatreFullscreen = usePlaygroundStore((state) => state.setTheatreFullscreen);
  const setPinnedId = usePlaygroundStore((state) => state.setPinnedId);

  useEffect(() => {
    if (event?.id) setActiveCommitId(event.id);
  }, [event?.id]);

  const activeEvent = useMemo(() => {
    return commitHistory.find((commit) => commit.id === activeCommitId) ?? event ?? commitHistory.at(-1) ?? null;
  }, [activeCommitId, commitHistory, event]);

  const diffContent = activeEvent?.detail || DEMO_DIFF;
  const lines = useMemo(() => diffContent.split("\n"), [diffContent]);
  const diffStats = useMemo(() => countDiff(lines), [lines]);
  const currentIdx = activeEvent ? commitHistory.findIndex((commit) => commit.id === activeEvent.id) : -1;
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx >= 0 && currentIdx < commitHistory.length - 1;

  const filename = fileNameFrom(diffContent, activeEvent);
  const branch = branchFrom(activeEvent);
  const authorId = activeEvent?.actor_id ?? "";
  const authorName = activeEvent?.actor_name ?? "demo agent";

  // Diff lines are revealed gradually so screen recordings show causality.
  useEffect(() => {
    if (collapsed) return;
    if (animTimerRef.current) clearTimeout(animTimerRef.current);

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setAnimatedLines(lines);
      return;
    }

    setAnimatedLines([]);
    let index = 0;

    function revealNextLine() {
      index += 1;
      setAnimatedLines(lines.slice(0, index));
      if (index >= lines.length) return;

      const line = lines[index] || "";
      const delay = line.startsWith("+") ? 48 : line.startsWith("-") ? 38 : 18;
      animTimerRef.current = setTimeout(revealNextLine, delay);
    }

    animTimerRef.current = setTimeout(revealNextLine, 140);
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, [collapsed, lines]);

  const stepCommit = useCallback((direction: -1 | 1) => {
    const target = commitHistory[currentIdx + direction];
    if (!target) return;
    setActiveCommitId(target.id);
    setPinnedId(target.id);
  }, [commitHistory, currentIdx, setPinnedId]);

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="flex h-full min-h-[88px] w-full items-center justify-center gap-3 bg-black/10 px-5 text-sm text-white/50 transition hover:bg-white/[0.04] hover:text-white/75"
      >
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/35">
          read-only diff
        </span>
        <span className="font-semibold tracking-[-0.02em]">Open Code Theatre</span>
        {commitHistory.length > 0 && <span className="text-white/28">{commitHistory.length} commits</span>}
      </button>
    );
  }

  return (
    <div className="flex h-full min-h-[300px] w-full flex-col overflow-hidden bg-[#07080b]">
      <div className="shrink-0 border-b border-white/10 bg-white/[0.035] px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/36">
                commit playback
              </span>
              <span className="rounded-full bg-[#61f6b9]/10 px-2.5 py-1 font-mono text-[10px] text-[#61f6b9]">
                +{diffStats.additions}
              </span>
              <span className="rounded-full bg-[#ff8a8a]/10 px-2.5 py-1 font-mono text-[10px] text-[#ff8a8a]">
                -{diffStats.deletions}
              </span>
            </div>
            <h3 className="truncate text-xl font-semibold tracking-[-0.04em] text-white">{filename}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-white/45">
              <span className="inline-flex items-center gap-2">
                {authorId && <AgentHueDot agentId={authorId} size={7} glow />}
                {authorName}
              </span>
              <span className="h-1 w-1 rounded-full bg-white/25" />
              <span className="font-mono">{branch}</span>
              <span className="h-1 w-1 rounded-full bg-white/25" />
              <span>view-only</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => stepCommit(-1)}
              disabled={!hasPrev}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/55 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              Previous
            </button>
            <span className="min-w-[68px] text-center font-mono text-[11px] text-white/35">
              {currentIdx >= 0 ? currentIdx + 1 : "1"}/{Math.max(commitHistory.length, 1)}
            </span>
            <button
              onClick={() => stepCommit(1)}
              disabled={!hasNext}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/55 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              Next
            </button>
            <button
              onClick={() => setTheatreFullscreen(!theatreFullscreen)}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/55 transition hover:bg-white/[0.08] hover:text-white"
            >
              {theatreFullscreen ? "Exit full screen" : "Full screen"}
            </button>
            <button
              onClick={onToggle}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/45 transition hover:bg-white/[0.08] hover:text-white"
            >
              {theatreFullscreen ? "Close" : "Collapse"}
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_top_right,rgba(97,246,185,0.055),transparent_36%)] py-4 font-mono text-[12px] leading-6">
        {animatedLines.map((line, index) => {
          const isAdd = line.startsWith("+") && !line.startsWith("+++");
          const isDel = line.startsWith("-") && !line.startsWith("---");
          const isHunk = line.startsWith("@@");
          const isHeader = line.startsWith("---") || line.startsWith("+++");

          return (
            <div
              key={`${index}-${line}`}
              className="grid grid-cols-[58px_28px_minmax(0,1fr)] px-4 opacity-0 [animation:o-enter_220ms_cubic-bezier(0.16,1,0.3,1)_forwards]"
              style={{
                animationDelay: `${Math.min(index * 18, 520)}ms`,
                background: isAdd
                  ? "rgba(97,246,185,0.075)"
                  : isDel
                    ? "rgba(255,138,138,0.075)"
                    : isHunk
                      ? "rgba(147,197,253,0.06)"
                      : "transparent",
              }}
            >
              <span className="select-none pr-4 text-right text-white/18">
                {isHunk || isHeader ? "" : index + 1}
              </span>
              <span
                className="select-none text-center"
                style={{ color: isAdd ? "#61f6b9" : isDel ? "#ff8a8a" : isHunk ? "#93c5fd" : "rgba(255,255,255,0.16)" }}
              >
                {isAdd ? "+" : isDel ? "-" : isHunk ? "@" : "·"}
              </span>
              <span
                className="whitespace-pre pr-6"
                style={{
                  color: isAdd
                    ? "#b6ffdb"
                    : isDel
                      ? "#ffc0c0"
                      : isHunk
                        ? "#bfdbfe"
                        : isHeader
                          ? "rgba(255,255,255,0.36)"
                          : "rgba(255,255,255,0.74)",
                }}
              >
                {line.replace(/^[+-]{1}\s?/, "") || "\u00A0"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
