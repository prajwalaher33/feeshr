"use client";

import { useDesktopStore } from "@/lib/stores/desktop-store";
import { timeAgo } from "@/lib/utils/time";
import type { DesktopEventType } from "@/lib/types/desktop";

const EVENT_ICONS: Record<DesktopEventType, string> = {
  browser_navigate: "globe",
  browser_content: "globe",
  terminal_command: "terminal",
  terminal_output: "terminal",
  file_open: "file",
  file_edit: "edit",
  file_create: "plus",
  file_delete: "trash",
  tool_switch: "tool",
  status_change: "activity",
  permission_request: "shield",
  permission_response: "check",
  session_start: "play",
  session_end: "stop",
};

const EVENT_COLORS: Record<string, string> = {
  browser_navigate: "text-cyan",
  browser_content: "text-cyan",
  terminal_command: "text-mint",
  terminal_output: "text-secondary",
  file_open: "text-violet",
  file_edit: "text-amber",
  file_create: "text-mint",
  file_delete: "text-coral",
  tool_switch: "text-indigo",
  status_change: "text-cyan",
  permission_request: "text-amber",
  permission_response: "text-mint",
  session_start: "text-mint",
  session_end: "text-secondary",
};

function formatEventType(type: string): string {
  return type.replace(/_/g, " ");
}

function getEventSummary(event: { event_type: string; payload: Record<string, unknown> }): string {
  const p = event.payload;
  switch (event.event_type) {
    case "browser_navigate": return `Navigated to ${(p.url as string)?.replace(/^https?:\/\//, "").slice(0, 50) ?? "a page"}`;
    case "terminal_command": return `$ ${(p.command as string)?.slice(0, 60) ?? "command"}`;
    case "terminal_output": return (p.output as string)?.slice(0, 60) ?? "output";
    case "file_open": return `Opened ${(p.name as string) ?? (p.path as string) ?? "file"}`;
    case "file_edit": return `Edited ${(p.path as string)?.split("/").pop() ?? "file"}`;
    case "file_create": return `Created ${(p.name as string) ?? "file"}`;
    case "file_delete": return `Deleted ${(p.path as string)?.split("/").pop() ?? "file"}`;
    case "tool_switch": return `Switched to ${p.tool ?? "tool"}`;
    case "status_change": return `Status: ${p.status ?? "changed"}`;
    case "permission_request": return `Permission: ${(p.action as string) ?? "action"}`;
    case "permission_response": return `Permission ${(p.approved as boolean) ? "granted" : "denied"}`;
    case "session_start": return `Session started${p.task ? `: ${(p.task as string).slice(0, 40)}` : ""}`;
    case "session_end": return "Session ended";
    default: return formatEventType(event.event_type);
  }
}

/**
 * Compact scrollable timeline of all desktop events.
 */
export function ActivityLog() {
  const { events } = useDesktopStore();

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2.5 bg-surface border-b border-border-subtle shrink-0">
        <h3
          className="text-xs font-medium text-secondary uppercase tracking-wide"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Activity Log
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        {events.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted text-xs">
            No activity yet
          </div>
        )}
        {events.map((event, i) => (
          <div
            key={event.id ?? `${event.created_at}-${i}`}
            className="flex items-start gap-2 px-4 py-2 border-b border-border-subtle last:border-b-0 hover:bg-raised/50 transition-colors"
          >
            {/* Timeline dot */}
            <div className={`shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${
              EVENT_COLORS[event.event_type] ?? "text-muted"
            } bg-current`} />

            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-primary truncate" style={{ fontFamily: "var(--font-mono)" }}>
                {getEventSummary(event)}
              </p>
              <span className="text-[10px] text-muted">{timeAgo(event.created_at)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
