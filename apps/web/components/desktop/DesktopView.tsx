"use client";

import { useEffect, useRef, useState } from "react";
import { useDesktopSocket } from "@/lib/hooks/use-desktop-socket";
import { useDesktopStore } from "@/lib/stores/desktop-store";
import { MOCK_DESKTOP_SEQUENCE, getMockDesktopEvent } from "@/lib/mock/desktop-events";
import { DesktopToolbar } from "./DesktopToolbar";
import { TerminalWindow } from "./TerminalWindow";
import { BrowserWindow } from "./BrowserWindow";
import { FileExplorer } from "./FileExplorer";
import { ActivityLog } from "./ActivityLog";
import { ConfirmationDialog } from "./ConfirmationDialog";

interface DesktopViewProps {
  agentId: string;
}

/**
 * Main desktop viewer component.
 * Renders a virtual computer interface showing the agent's live activity
 * across browser, terminal, and file editor panes.
 * Falls back to mock data playback in development.
 */
export function DesktopView({ agentId }: DesktopViewProps) {
  const { connected, agentStatus, processEvent, setConnected } = useDesktopStore();
  const [useMock, setUseMock] = useState(false);
  const mockIndexRef = useRef(0);
  const mockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Connect real WebSocket
  useDesktopSocket(agentId);

  // Fall back to mock playback after 3s with no connection
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!connected) {
        setUseMock(true);
        setConnected(true);
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, [connected, setConnected]);

  // Mock event playback
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

      // Variable delay: commands take longer, outputs are quick
      const delay = event.event_type === "terminal_command" || event.event_type === "browser_navigate"
        ? 2000 + Math.random() * 1500
        : event.event_type === "permission_request"
          ? 3000
          : 800 + Math.random() * 1200;

      mockTimerRef.current = setTimeout(playNext, delay);
    }

    playNext();

    return () => {
      if (mockTimerRef.current) clearTimeout(mockTimerRef.current);
    };
  }, [useMock, agentId, processEvent]);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <DesktopToolbar />

      {/* Desktop layout */}
      <div className="relative grid grid-cols-[1fr_280px] gap-3 max-[1024px]:grid-cols-1" style={{ minHeight: "560px" }}>
        {/* Main pane (stacked windows) */}
        <div className="flex flex-col gap-3 min-w-0">
          {/* Primary window — the active tool gets more space */}
          <ActiveWindow />
          {/* Secondary windows collapsed below */}
          <SecondaryWindows />
        </div>

        {/* Side panel — activity log */}
        <div className="card overflow-hidden max-[1024px]:max-h-[300px]">
          <ActivityLog />
        </div>

        {/* Permission confirmation overlay */}
        <ConfirmationDialog />
      </div>

      {/* Idle state */}
      {agentStatus === "idle" && !useMock && (
        <div className="card p-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-raised flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <p className="text-sm text-secondary" style={{ fontFamily: "var(--font-display)" }}>
              Agent is idle. The desktop will activate when a task begins.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Renders the currently active tool window at full size. */
function ActiveWindow() {
  const { activeTool } = useDesktopStore();

  switch (activeTool) {
    case "terminal":
      return <div className="min-h-[280px]"><TerminalWindow /></div>;
    case "browser":
      return <div className="min-h-[280px]"><BrowserWindow /></div>;
    case "editor":
      return <div className="min-h-[280px]"><FileExplorer /></div>;
  }
}

/** Renders the inactive tool windows in compact form. */
function SecondaryWindows() {
  const { activeTool } = useDesktopStore();

  const windows = [
    { key: "terminal" as const, node: <TerminalWindow /> },
    { key: "browser" as const, node: <BrowserWindow /> },
    { key: "editor" as const, node: <FileExplorer /> },
  ].filter((w) => w.key !== activeTool);

  return (
    <div className="grid grid-cols-2 gap-3 max-[768px]:grid-cols-1">
      {windows.map((w) => (
        <div key={w.key} className="min-h-[160px]">
          {w.node}
        </div>
      ))}
    </div>
  );
}
