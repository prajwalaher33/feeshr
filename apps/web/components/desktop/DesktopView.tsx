"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDesktopSocket } from "@/lib/hooks/use-desktop-socket";
import { useDesktopStore } from "@/lib/stores/desktop-store";
import { MOCK_DESKTOP_SEQUENCE, getMockDesktopEvent } from "@/lib/mock/desktop-events";
import { TerminalWindow } from "./TerminalWindow";
import { BrowserWindow } from "./BrowserWindow";
import { FileExplorer } from "./FileExplorer";
import { ActivityLog } from "./ActivityLog";
import { ConfirmationDialog } from "./ConfirmationDialog";
import type { ActiveTool } from "@/lib/types/desktop";

interface DesktopViewProps {
  agentId: string;
}

const TOOL_TABS: { key: ActiveTool; label: string; icon: React.ReactNode }[] = [
  {
    key: "terminal",
    label: "Terminal",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
  },
  {
    key: "browser",
    label: "Browser",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <polyline points="13 2 13 9 20 9" />
      </svg>
    ),
  },
];

export function DesktopView({ agentId }: DesktopViewProps) {
  const { connected, agentStatus, activeTool, setActiveTool, processEvent, setConnected } = useDesktopStore();
  const [useMock, setUseMock] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const mockIndexRef = useRef(0);
  const mockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useDesktopSocket(agentId);

  // Mock fallback
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!connected) {
        setUseMock(true);
        setConnected(true);
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, [connected, setConnected]);

  useEffect(() => {
    if (!useMock) return;
    function playNext() {
      if (mockIndexRef.current >= MOCK_DESKTOP_SEQUENCE.length) {
        mockIndexRef.current = 0;
        return;
      }
      const event = getMockDesktopEvent(agentId, mockIndexRef.current);
      processEvent(event);
      mockIndexRef.current++;
      const delay = event.event_type === "terminal_command" || event.event_type === "browser_navigate"
        ? 2000 + Math.random() * 1500
        : event.event_type === "permission_request"
          ? 3000
          : 800 + Math.random() * 1200;
      mockTimerRef.current = setTimeout(playNext, delay);
    }
    playNext();
    return () => { if (mockTimerRef.current) clearTimeout(mockTimerRef.current); };
  }, [useMock, agentId, processEvent]);

  return (
    <div className="flex flex-col gap-3">
      {/* Monitor */}
      <div className="desktop-monitor p-[3px]">
        {/* Top bezel — traffic lights, tool tabs, status */}
        <div className="flex items-center justify-between px-5 py-3 relative z-10">
          {/* Left: traffic lights + status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-[6px]">
              <span className="w-[10px] h-[10px] rounded-full bg-[#ff5f57] opacity-80" />
              <span className="w-[10px] h-[10px] rounded-full bg-[#febc2e] opacity-80" />
              <span className="w-[10px] h-[10px] rounded-full bg-[#28c840] opacity-80" />
            </div>

            <AnimatePresence mode="wait">
              {agentStatus === "working" && (
                <motion.div
                  key="working"
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-[rgba(255,255,255,0.06)] border-t-cyan" />
                  <span className="text-[10px] text-cyan/80 font-medium" style={{ fontFamily: "var(--font-mono)" }}>
                    Working
                  </span>
                </motion.div>
              )}
              {agentStatus === "completed" && (
                <motion.div
                  key="complete"
                  className="flex items-center gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-mint">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-[10px] text-mint/80 font-medium" style={{ fontFamily: "var(--font-mono)" }}>
                    Complete
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Center: tool tabs */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-[rgba(255,255,255,0.025)] rounded-lg p-[3px]">
            {TOOL_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTool(tab.key)}
                className={`desktop-tab flex items-center gap-1.5 px-3 py-[5px] rounded-md text-[11px] font-medium transition-all duration-200 ${
                  activeTool === tab.key
                    ? "desktop-tab-active bg-[rgba(255,255,255,0.05)] text-[#c8d0e0]"
                    : "text-[#4a5568] hover:text-[#6b7280] hover:bg-[rgba(255,255,255,0.02)]"
                }`}
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {tab.icon}
                <span className="max-[768px]:hidden">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Right: observer badge + live indicator + sidebar toggle */}
          <div className="flex items-center gap-3">
            {/* Observer badge */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[rgba(255,255,255,0.02)]">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4a5568]">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span className="text-[9px] text-[#4a5568] uppercase tracking-wider font-medium" style={{ fontFamily: "var(--font-mono)" }}>
                Watching
              </span>
            </div>

            {/* Live dot */}
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-[5px] w-[5px]">
                {connected && <span className="absolute inline-flex h-full w-full rounded-full bg-mint opacity-50 animate-ping" />}
                <span className={`relative inline-flex h-[5px] w-[5px] rounded-full ${connected ? "bg-mint" : "bg-[#4a5568]"}`} />
              </span>
              <span
                className={`text-[9px] uppercase tracking-wider font-medium ${connected ? "text-mint/60" : "text-[#4a5568]"}`}
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {connected ? "Live" : "Offline"}
              </span>
            </div>

            {/* Sidebar toggle */}
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className={`p-1.5 rounded-md transition-all duration-200 ${showSidebar ? "bg-[rgba(255,255,255,0.04)] text-[#6b7280]" : "text-[#4a5568] hover:text-[#6b7280]"}`}
              aria-label="Toggle activity log"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="15" y1="3" x2="15" y2="21" />
              </svg>
            </button>
          </div>
        </div>

        {/* Screen area */}
        <div className="desktop-screen mx-1 mb-1 relative" style={{ minHeight: "540px" }}>
          <div className="flex h-full" style={{ minHeight: "540px" }}>
            {/* Main content — smooth tool transition */}
            <div className="flex-1 min-w-0 relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTool}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="absolute inset-0"
                >
                  {activeTool === "terminal" && <TerminalWindow />}
                  {activeTool === "browser" && <BrowserWindow />}
                  {activeTool === "editor" && <FileExplorer />}
                </motion.div>
              </AnimatePresence>

              {/* Permission dialog overlays the screen */}
              <ConfirmationDialog />
            </div>

            {/* Sidebar — activity log */}
            <AnimatePresence>
              {showSidebar && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 260, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="desktop-sidebar shrink-0 overflow-hidden"
                >
                  <ActivityLog />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Monitor stand */}
      <div className="flex justify-center -mt-1">
        <div className="w-20 h-[3px] rounded-full bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.04)] to-transparent" />
      </div>

      {/* Idle state */}
      {agentStatus === "idle" && !useMock && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center py-6"
        >
          <p className="text-[13px] text-[#4a5568]" style={{ fontFamily: "var(--font-body)" }}>
            Waiting for agent to start a task...
          </p>
        </motion.div>
      )}
    </div>
  );
}
