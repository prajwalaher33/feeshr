"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDesktopStore } from "@/lib/stores/desktop-store";
import { timeAgo } from "@/lib/utils/time";

const EVENT_DOT_COLORS: Record<string, string> = {
  browser_navigate: "#22d3ee",
  browser_content: "#22d3ee",
  terminal_command: "#28c840",
  terminal_output: "#3a4250",
  file_open: "#8b5cf6",
  file_edit: "#f7c948",
  file_create: "#28c840",
  file_delete: "#ff6b6b",
  tool_switch: "#6366f1",
  status_change: "#22d3ee",
  permission_request: "#f7c948",
  permission_response: "#28c840",
  session_start: "#28c840",
  session_end: "#3a4250",
};

function getEventSummary(event: { event_type: string; payload: Record<string, unknown> }): string {
  const p = event.payload;
  switch (event.event_type) {
    case "browser_navigate": return `Navigate ${(p.url as string)?.replace(/^https?:\/\//, "").split("/")[0] ?? ""}`;
    case "terminal_command": return `$ ${(p.command as string)?.slice(0, 40) ?? ""}`;
    case "terminal_output": return (p.output as string)?.slice(0, 40) ?? "output";
    case "file_open": return `Open ${(p.name as string) ?? (p.path as string)?.split("/").pop() ?? ""}`;
    case "file_edit": return `Edit ${(p.path as string)?.split("/").pop() ?? ""}`;
    case "file_create": return `Create ${(p.name as string) ?? ""}`;
    case "file_delete": return `Delete ${(p.path as string)?.split("/").pop() ?? ""}`;
    case "tool_switch": return `Switch to ${p.tool ?? ""}`;
    case "status_change": return `${p.status ?? "changed"}`;
    case "permission_request": return `${(p.action as string) ?? "action"}`;
    case "permission_response": return `${(p.approved as boolean) ? "Approved" : "Denied"}`;
    case "session_start": return "Session started";
    case "session_end": return "Session ended";
    default: return event.event_type.replace(/_/g, " ");
  }
}

export function ActivityLog() {
  const { events } = useDesktopStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [events.length]);

  return (
    <div className="flex flex-col h-full w-[260px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[rgba(255,255,255,0.03)] shrink-0">
        <span
          className="text-[9px] text-[#3a4250] uppercase tracking-[1.5px] font-medium"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Activity
        </span>
        <span
          className="text-[9px] text-[#2a3040]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {events.length}
        </span>
      </div>

      {/* Events */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {events.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <span className="text-[10px] text-[#2a3040]">No activity</span>
          </div>
        )}

        <AnimatePresence initial={false}>
          {events.slice(0, 50).map((event, i) => (
            <motion.div
              key={event.id ?? `${event.created_at}-${i}`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="flex items-start gap-2.5 px-4 py-2 border-b border-[rgba(255,255,255,0.015)] hover:bg-[rgba(255,255,255,0.01)] transition-colors">
                {/* Dot */}
                <span
                  className="shrink-0 mt-[5px] w-[4px] h-[4px] rounded-full"
                  style={{ backgroundColor: EVENT_DOT_COLORS[event.event_type] ?? "#3a4250" }}
                />

                <div className="flex-1 min-w-0">
                  <p
                    className="text-[10px] text-[#6b7280] truncate leading-snug"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {getEventSummary(event)}
                  </p>
                  <span className="text-[9px] text-[#2a3040]">{timeAgo(event.created_at)}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
