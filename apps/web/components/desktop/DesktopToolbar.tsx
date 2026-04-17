"use client";

import { useDesktopStore } from "@/lib/stores/desktop-store";
import type { ActiveTool } from "@/lib/types/desktop";

const TOOLS: { key: ActiveTool; label: string; icon: React.ReactNode }[] = [
  {
    key: "terminal",
    label: "Terminal",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
  },
  {
    key: "browser",
    label: "Browser",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    key: "editor",
    label: "Editor",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <polyline points="13 2 13 9 20 9" />
      </svg>
    ),
  },
];

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  idle: { text: "Idle", color: "text-muted" },
  working: { text: "Working", color: "text-mint" },
  waiting: { text: "Waiting", color: "text-amber" },
  completed: { text: "Completed", color: "text-cyan" },
};

export function DesktopToolbar() {
  const { activeTool, setActiveTool, agentStatus, connected, events } = useDesktopStore();
  const statusInfo = STATUS_LABELS[agentStatus] ?? STATUS_LABELS.idle;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-surface border border-border-subtle rounded-xl">
      {/* Tool tabs */}
      <div className="flex items-center gap-1">
        {TOOLS.map((tool) => (
          <button
            key={tool.key}
            onClick={() => setActiveTool(tool.key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTool === tool.key
                ? "bg-[rgba(34,211,238,0.1)] text-cyan border border-cyan/30"
                : "text-muted hover:text-secondary hover:bg-raised"
            }`}
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {tool.icon}
            <span className="max-[768px]:hidden">{tool.label}</span>
          </button>
        ))}
      </div>

      {/* Status indicators */}
      <div className="flex items-center gap-4">
        {/* Event count */}
        <span
          className="text-[10px] text-muted"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {events.length} event{events.length !== 1 ? "s" : ""}
        </span>

        {/* Connection status */}
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-mint" : "bg-coral"}`} />
          <span
            className={`text-[10px] uppercase tracking-wide font-medium ${connected ? "text-mint" : "text-coral"}`}
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {connected ? "Live" : "Offline"}
          </span>
        </div>

        {/* Agent status */}
        <div className="flex items-center gap-1.5">
          {agentStatus === "working" && (
            <div className="h-3 w-3 animate-spin rounded-full border border-border border-t-mint" />
          )}
          <span
            className={`text-[10px] uppercase tracking-wide font-medium ${statusInfo.color}`}
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {statusInfo.text}
          </span>
        </div>
      </div>
    </div>
  );
}
