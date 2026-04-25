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
  const authorId = activeEvent?.actor_id ?? "";
  const authorName = activeEvent?.actor_name ?? "demo agent";

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
        className="flex h-full min-h-[60px] w-full items-center justify-center gap-3 px-5 text-[13px] text-white/35 transition-colors hover:bg-white/[0.03] hover:text-white/60"
      >
        <span className="font-medium">Open diff viewer</span>
        {commitHistory.length > 0 && (
          <span className="font-mono text-white/20">{commitHistory.length} commits</span>
        )}
      </button>
    );
  }

  return (
    <div className="flex h-full min-h-[260px] w-full flex-col overflow-hidden bg-[#0a0a0a]">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="12" height="12" rx="3" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" />
              <path d="M5 8H11" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M5 5.5H9" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M5 10.5H10" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span className="truncate text-[13px] font-medium text-white/70">{filename}</span>
          </div>

          <span className="hidden text-white/10 sm:inline">|</span>

          <div className="hidden items-center gap-2 sm:flex">
            {authorId && <AgentHueDot agentId={authorId} size={6} glow />}
            <span className="text-[12px] text-white/35">{authorName}</span>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <span className="rounded-md bg-[#30d158]/10 px-1.5 py-0.5 font-mono text-[11px] text-[#30d158]">
              +{diffStats.additions}
            </span>
            <span className="rounded-md bg-[#ff453a]/10 px-1.5 py-0.5 font-mono text-[11px] text-[#ff453a]">
              -{diffStats.deletions}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {commitHistory.length > 1 && (
            <>
              <button
                onClick={() => stepCommit(-1)}
                disabled={!hasPrev}
                className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-white/40 transition hover:bg-white/[0.06] hover:text-white/70 disabled:opacity-20"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M6 2L3.5 5L6 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <span className="min-w-[40px] text-center font-mono text-[11px] text-white/25">
                {currentIdx >= 0 ? currentIdx + 1 : "1"}/{Math.max(commitHistory.length, 1)}
              </span>
              <button
                onClick={() => stepCommit(1)}
                disabled={!hasNext}
                className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-white/40 transition hover:bg-white/[0.06] hover:text-white/70 disabled:opacity-20"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M4 2L6.5 5L4 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          )}

          <button
            onClick={() => setTheatreFullscreen(!theatreFullscreen)}
            className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-1.5 text-white/30 transition hover:bg-white/[0.06] hover:text-white/60"
            aria-label={theatreFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              {theatreFullscreen ? (
                <>
                  <path d="M4 1V4H1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M8 11V8H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </>
              ) : (
                <>
                  <path d="M1 4V1H4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M11 8V11H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </>
              )}
            </svg>
          </button>

          <button
            onClick={onToggle}
            className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-1.5 text-white/30 transition hover:bg-white/[0.06] hover:text-white/60"
            aria-label={theatreFullscreen ? "Close" : "Collapse"}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Code */}
      <div className="min-h-0 flex-1 overflow-auto py-3 font-mono text-[12px] leading-[22px]" style={{ fontFamily: "var(--o-font-mono)" }}>
        {animatedLines.map((line, index) => {
          const isAdd = line.startsWith("+") && !line.startsWith("+++");
          const isDel = line.startsWith("-") && !line.startsWith("---");
          const isHunk = line.startsWith("@@");
          const isHeader = line.startsWith("---") || line.startsWith("+++");

          return (
            <div
              key={`${index}-${line}`}
              className="grid grid-cols-[48px_20px_minmax(0,1fr)] opacity-0 [animation:o-enter_180ms_cubic-bezier(0.16,1,0.3,1)_forwards]"
              style={{
                animationDelay: `${Math.min(index * 16, 400)}ms`,
                background: isAdd
                  ? "rgba(48,209,88,0.06)"
                  : isDel
                    ? "rgba(255,69,58,0.06)"
                    : isHunk
                      ? "rgba(10,132,255,0.04)"
                      : "transparent",
              }}
            >
              <span className="select-none pr-3 text-right text-white/12">
                {isHunk || isHeader ? "" : index + 1}
              </span>
              <span
                className="select-none text-center"
                style={{
                  color: isAdd ? "#30d158" : isDel ? "#ff453a" : isHunk ? "#0a84ff" : "rgba(255,255,255,0.08)",
                }}
              >
                {isAdd ? "+" : isDel ? "-" : isHunk ? "@" : " "}
              </span>
              <span
                className="whitespace-pre pr-6"
                style={{
                  color: isAdd
                    ? "rgba(48,209,88,0.90)"
                    : isDel
                      ? "rgba(255,69,58,0.85)"
                      : isHunk
                        ? "rgba(10,132,255,0.70)"
                        : isHeader
                          ? "rgba(255,255,255,0.25)"
                          : "rgba(255,255,255,0.65)",
                }}
              >
                {line.replace(/^[+-]{1}\s?/, "") || " "}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
