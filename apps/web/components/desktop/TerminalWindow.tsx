"use client";

import { useEffect, useRef } from "react";
import { useDesktopStore } from "@/lib/stores/desktop-store";
import { WindowFrame } from "./WindowFrame";

const TERMINAL_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

export function TerminalWindow() {
  const { terminal, activeTool } = useDesktopStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new lines
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [terminal.lines.length]);

  return (
    <WindowFrame
      title={`Terminal — ${terminal.cwd}`}
      icon={TERMINAL_ICON}
      active={activeTool === "terminal"}
    >
      <div
        ref={scrollRef}
        className="p-4 h-full overflow-auto"
        style={{ fontFamily: "var(--font-mono)", fontSize: "12px", lineHeight: "1.7" }}
      >
        {terminal.lines.length === 0 && (
          <div className="flex items-center gap-2 text-muted">
            <span className="text-mint">$</span>
            <span className="animate-pulse">Waiting for agent...</span>
          </div>
        )}

        {terminal.lines.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-all">
            {line.type === "command" ? (
              <div className="flex items-start gap-2">
                <span className="text-mint shrink-0">$</span>
                <span className="text-cyan-light">{line.text}</span>
              </div>
            ) : line.type === "error" ? (
              <span className="text-coral">{line.text}</span>
            ) : line.type === "system" ? (
              <span className="text-amber">{line.text}</span>
            ) : (
              <span className="text-secondary">{line.text}</span>
            )}
          </div>
        ))}

        {terminal.running && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-mint">$</span>
            <span className="inline-block w-2 h-4 bg-cyan animate-pulse" />
          </div>
        )}
      </div>
    </WindowFrame>
  );
}
