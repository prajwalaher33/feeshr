"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import type { PlaygroundEvent } from "@feeshr/types";
import { AgentHueDot } from "@/components/agent/AgentHueDot";
import { usePlaygroundStore } from "@/lib/stores/playground-store";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CodeTheatreProps {
  event: PlaygroundEvent | null;
  collapsed: boolean;
  onToggle: () => void;
}

// ─── Demo diff ──────────────────────────────────────────────────────────────

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

// ─── Component ──────────────────────────────────────────────────────────────

export function CodeTheatre({ event, collapsed, onToggle }: CodeTheatreProps) {
  const [animatedLines, setAnimatedLines] = useState<string[]>([]);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { commitHistory, theatreFullscreen, setTheatreFullscreen } = usePlaygroundStore();

  const currentIdx = commitHistory.findIndex(e => e.id === event?.id);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < commitHistory.length - 1 && currentIdx >= 0;

  const diffContent = event?.detail || DEMO_DIFF;
  const lines = diffContent.split("\n");

  // Extract file info from diff header or event
  const fileMatch = diffContent.match(/^---\s+a\/(.+)$/m);
  const filename = fileMatch?.[1] || event?.target_name || "rate_limiter.ts";
  const authorId = event?.actor_id || "";
  const authorName = event?.actor_name || "unknown";
  const branchMatch = event?.target_name || "fix/rate-limiter-race";

  // Line-by-line animation
  useEffect(() => {
    if (collapsed) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setAnimatedLines(lines);
      return;
    }

    setAnimatedLines([]);
    let idx = 0;

    function revealNext() {
      if (idx >= lines.length) return;
      idx++;
      setAnimatedLines(lines.slice(0, idx));
      const line = lines[idx - 1] || "";
      const delay = line.startsWith("+") ? 55 : line.startsWith("-") ? 35 : 18;
      animTimerRef.current = setTimeout(revealNext, delay);
    }

    animTimerRef.current = setTimeout(revealNext, 150);
    return () => { if (animTimerRef.current) clearTimeout(animTimerRef.current); };
  }, [diffContent, collapsed]);

  const stepCommit = useCallback((dir: -1 | 1) => {
    const target = commitHistory[currentIdx + dir];
    if (target) {
      usePlaygroundStore.getState().setPinnedId(target.id);
    }
  }, [currentIdx, commitHistory]);

  // Collapsed state
  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="w-full h-9 flex items-center justify-center gap-2 text-xs text-[#5a616b] cursor-pointer bg-transparent border-none hover:bg-white/[0.02] transition-colors"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        <span className="text-[10px]">▶</span>
        Code Theatre
        {commitHistory.length > 0 && (
          <span className="text-[#3d4556]">· {commitHistory.length} commits</span>
        )}
      </button>
    );
  }

  return (
    <div className={theatreFullscreen ? "flex flex-col flex-1" : "flex flex-col"} style={theatreFullscreen ? undefined : { height: 280 }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06] flex-shrink-0">
        {/* Collapse/close */}
        <button
          onClick={onToggle}
          className="text-[#5a616b] hover:text-[#8891a5] transition-colors cursor-pointer bg-transparent border-none text-xs p-1"
          aria-label={theatreFullscreen ? "Exit fullscreen" : "Collapse"}
        >
          {theatreFullscreen ? "✕" : "▼"}
        </button>

        {/* File name */}
        <span className="text-xs font-mono font-medium text-[#c5cbd3]">{filename}</span>

        <span className="text-[#1E242B]">|</span>

        {/* Author */}
        {authorId && (
          <div className="flex items-center gap-1.5">
            <AgentHueDot agentId={authorId} size={6} />
            <span className="text-xs text-[#8891a5]">{authorName}</span>
          </div>
        )}

        <span className="text-[#1E242B]">|</span>

        {/* Branch */}
        <span className="text-[10px] font-mono text-[#3d4556] px-2 py-0.5 rounded bg-white/[0.03] border border-white/[0.06]">
          {branchMatch}
        </span>

        <div className="flex-1" />

        {/* Commit stepper */}
        {commitHistory.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => stepCommit(-1)}
              disabled={!hasPrev}
              className="w-6 h-6 flex items-center justify-center rounded text-xs text-[#5a616b] hover:text-[#c5cbd3] hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-default cursor-pointer bg-transparent border-none transition-colors"
            >
              ←
            </button>
            <span className="text-[10px] font-mono text-[#3d4556]">
              {currentIdx >= 0 ? currentIdx + 1 : "?"}/{commitHistory.length}
            </span>
            <button
              onClick={() => stepCommit(1)}
              disabled={!hasNext}
              className="w-6 h-6 flex items-center justify-center rounded text-xs text-[#5a616b] hover:text-[#c5cbd3] hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-default cursor-pointer bg-transparent border-none transition-colors"
            >
              →
            </button>
          </div>
        )}

        {/* Fullscreen toggle */}
        <button
          onClick={() => setTheatreFullscreen(!theatreFullscreen)}
          className="w-6 h-6 flex items-center justify-center rounded text-xs text-[#5a616b] hover:text-[#c5cbd3] hover:bg-white/[0.04] cursor-pointer bg-transparent border-none transition-colors"
          aria-label="Toggle fullscreen"
        >
          {theatreFullscreen ? "⊟" : "⊞"}
        </button>
      </div>

      {/* Diff content */}
      <div
        className="flex-1 overflow-auto"
        style={{
          background: "#07080A",
          padding: "12px 0",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          lineHeight: 1.7,
        }}
      >
        {animatedLines.map((line, i) => {
          const isAdd = line.startsWith("+") && !line.startsWith("+++");
          const isDel = line.startsWith("-") && !line.startsWith("---");
          const isHunk = line.startsWith("@@");
          const isHeader = line.startsWith("---") || line.startsWith("+++");

          return (
            <div
              key={i}
              className="flex"
              style={{
                background: isAdd
                  ? "rgba(59, 208, 31, 0.06)"
                  : isDel
                  ? "rgba(229, 72, 77, 0.06)"
                  : "transparent",
              }}
            >
              {/* Line number gutter */}
              <span className="w-12 text-right pr-4 flex-shrink-0 select-none text-[#2A3138] text-[11px]">
                {isHunk || isHeader ? "" : i + 1}
              </span>

              {/* +/- indicator */}
              <span
                className="w-5 flex-shrink-0 select-none text-center"
                style={{
                  color: isAdd ? "#3BD01F" : isDel ? "#E5484D" : isHunk ? "#5B8DEF" : "transparent",
                }}
              >
                {isAdd ? "+" : isDel ? "-" : isHunk ? "@" : " "}
              </span>

              {/* Content */}
              <span
                className="pr-4"
                style={{
                  color: isAdd
                    ? "#64E04B"
                    : isDel
                    ? "#E5484D"
                    : isHunk
                    ? "#5B8DEF"
                    : isHeader
                    ? "#5a616b"
                    : "#C5CBD3",
                }}
              >
                {line.replace(/^[+-@]{1,3}\s?/, "") || "\u00A0"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
