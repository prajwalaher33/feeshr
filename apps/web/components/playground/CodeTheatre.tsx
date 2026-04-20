"use client";

import React, { useRef, useEffect, useState } from "react";
import type { PlaygroundEvent } from "@feeshr/types";
import { AgentHueDot } from "@/components/agent/AgentHueDot";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CodeTheatreProps {
  event: PlaygroundEvent | null; // current PR commit event with diff
  collapsed: boolean;
  onToggle: () => void;
}

// ─── Monaco Theme (registered on first mount) ───────────────────────────────

const FEESHR_DARK_THEME = {
  base: "vs-dark" as const,
  inherit: false,
  rules: [
    { token: "", foreground: "F4F5F7", background: "0B0D10" },
    { token: "comment", foreground: "5A616B", fontStyle: "italic" },
    { token: "keyword", foreground: "B28CFF" },
    { token: "string", foreground: "64E04B" },
    { token: "number", foreground: "FFC978" },
    { token: "type", foreground: "7FE0C2" },
    { token: "function", foreground: "7FB4FF" },
    { token: "variable", foreground: "F4F5F7" },
  ],
  colors: {
    "editor.background": "#0B0D10",
    "editor.foreground": "#F4F5F7",
    "editorLineNumber.foreground": "#3A4049",
    "editor.lineHighlightBackground": "#111418",
    "editor.selectionBackground": "#2AA815AA",
    "diffEditor.insertedTextBackground": "#3BD01F22",
    "diffEditor.removedTextBackground": "#E5484D22",
  },
};

// ─── Demo diff content ──────────────────────────────────────────────────────

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
  const editorRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [animatedContent, setAnimatedContent] = useState("");
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine display content
  const diffContent = event?.detail || DEMO_DIFF;
  const filename = event?.target_name || "src/rate_limiter.ts";
  const authorId = event?.actor_id || "";
  const authorName = event?.actor_name || "unknown";
  const branch = event?.target_name || "fix/rate-limiter-race";

  // Load Monaco dynamically
  useEffect(() => {
    if (collapsed || loaded) return;

    async function loadMonaco() {
      const monaco = await import("monaco-editor");
      const { loader } = await import("@monaco-editor/react");
      loader.config({ monaco });

      // Register theme
      monaco.editor.defineTheme("feeshr-dark", FEESHR_DARK_THEME);
      setLoaded(true);
    }

    loadMonaco().catch(() => {
      // Fallback: show raw text without Monaco
      setLoaded(true);
    });
  }, [collapsed, loaded]);

  // Animate content appearing (hunk-by-hunk)
  useEffect(() => {
    if (collapsed) return;

    const lines = diffContent.split("\n");
    let idx = 0;

    function revealNext() {
      if (idx >= lines.length) return;
      idx++;
      setAnimatedContent(lines.slice(0, idx).join("\n"));
      const delay = lines[idx - 1]?.startsWith("+") ? 60 : lines[idx - 1]?.startsWith("-") ? 40 : 20;
      animTimerRef.current = setTimeout(revealNext, delay);
    }

    // Check reduced motion
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setAnimatedContent(diffContent);
    } else {
      setAnimatedContent("");
      animTimerRef.current = setTimeout(revealNext, 200);
    }

    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, [diffContent, collapsed]);

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="v7-focus-ring"
        style={{
          height: 32,
          flexShrink: 0,
          borderTop: "1px solid var(--line)",
          background: "var(--bg-1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          cursor: "pointer",
          border: "none",
          borderBottom: "none",
          width: "100%",
          padding: "0 16px",
          color: "var(--ink-3)",
          fontSize: "var(--fs-xs)",
          fontFamily: "var(--font-jetbrains)",
        }}
      >
        <span style={{ fontSize: 10 }}>&#9654;</span>
        Code Theatre
      </button>
    );
  }

  return (
    <div
      style={{
        height: 240,
        flexShrink: 0,
        borderTop: "1px solid var(--line)",
        background: "var(--bg-1)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 32,
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          gap: 8,
          borderBottom: "1px solid var(--line)",
        }}
      >
        <button
          onClick={onToggle}
          className="v7-focus-ring"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--ink-3)",
            fontSize: 10,
            padding: "2px 4px",
          }}
          aria-label="Collapse Code Theatre"
        >
          &#9660;
        </button>

        <span className="v7-mono" style={{ fontSize: "var(--fs-xs)", color: "var(--ink-1)" }}>
          {filename}
        </span>

        {authorId && (
          <>
            <span style={{ color: "var(--line)" }}>|</span>
            <AgentHueDot agentId={authorId} size={6} />
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--ink-2)" }}>
              {authorName}
            </span>
          </>
        )}

        <span style={{ flex: 1 }} />

        <span className="v7-mono" style={{ fontSize: 9, color: "var(--ink-4)" }}>
          {branch}
        </span>
      </div>

      {/* Editor / Diff content */}
      <div
        ref={editorRef}
        style={{
          flex: 1,
          overflow: "auto",
          background: "var(--bg-0)",
          padding: "8px 16px",
          fontFamily: "var(--font-jetbrains)",
          fontSize: "var(--fs-xs)",
          lineHeight: 1.6,
          whiteSpace: "pre",
        }}
      >
        {animatedContent.split("\n").map((line, i) => (
          <div
            key={i}
            style={{
              color: line.startsWith("+")
                ? "var(--ok)"
                : line.startsWith("-")
                ? "var(--err)"
                : line.startsWith("@@")
                ? "var(--info)"
                : "var(--ink-2)",
              background: line.startsWith("+")
                ? "color-mix(in srgb, var(--ok) 6%, transparent)"
                : line.startsWith("-")
                ? "color-mix(in srgb, var(--err) 6%, transparent)"
                : "transparent",
              padding: "0 4px",
              borderRadius: 2,
            }}
          >
            {line || "\u00A0"}
          </div>
        ))}
      </div>
    </div>
  );
}
