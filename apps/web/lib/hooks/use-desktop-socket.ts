"use client";

/**
 * WebSocket hook for a specific agent's desktop event stream.
 *
 * Connects to /api/v1/agents/:id/desktop/ws and processes
 * incoming desktop events into the Zustand store. Falls back
 * to REST polling when WebSocket is unavailable.
 */

import { useEffect, useRef, useCallback } from "react";
import { useDesktopStore } from "@/lib/stores/desktop-store";
import { validateFeedEvent, sanitizeEvent } from "@/lib/privacy-guard";
import type { DesktopEvent } from "@/lib/types/desktop";

const POLL_INTERVAL = 5_000;
const RECONNECT_DELAY = 3_000;
const MAX_RECONNECT = 5;

function getDesktopWsUrl(agentId: string): string {
  const hubUrl =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_HUB_URL ?? "http://localhost:8080")
      : "http://hub:8080";
  const wsProto = hubUrl.startsWith("https") ? "wss" : "ws";
  const host = hubUrl.replace(/^https?:\/\//, "");
  return `${wsProto}://${host}/api/v1/agents/${agentId}/desktop/ws`;
}

function getDesktopRestUrl(agentId: string): string {
  const hubUrl =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_HUB_URL ?? "http://localhost:8080")
      : "http://hub:8080";
  return `${hubUrl}/api/v1/agents/${agentId}/desktop/session`;
}

export function useDesktopSocket(agentId: string) {
  const { processEvent, setConnected, reset } = useDesktopStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastEventTime = useRef<string | null>(null);

  const handleEvent = useCallback(
    (raw: unknown) => {
      if (!validateFeedEvent(raw)) return;
      const safe = sanitizeEvent(raw) as Record<string, unknown>;

      // Extract the desktop event from the broadcast envelope
      const event: DesktopEvent = {
        id: safe.id as string | undefined,
        session_id: (safe.session_id as string) ?? "",
        agent_id: (safe.agent_id as string) ?? agentId,
        event_type: (safe.event_type as DesktopEvent["event_type"]) ?? "status_change",
        payload: (safe.payload as Record<string, unknown>) ?? {},
        created_at: (safe.created_at as string) ?? new Date().toISOString(),
      };

      lastEventTime.current = event.created_at;
      processEvent(event);
    },
    [agentId, processEvent],
  );

  const connectWs = useCallback(() => {
    if (typeof window === "undefined" || !agentId) return;

    const url = getDesktopWsUrl(agentId);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectCount.current = 0;
      setConnected(true);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        // Skip the welcome message
        if (data.type === "desktop_connected") return;
        handleEvent(data);
      } catch {
        // ignore non-JSON
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      setConnected(false);
      if (reconnectCount.current < MAX_RECONNECT) {
        reconnectCount.current++;
        setTimeout(connectWs, RECONNECT_DELAY);
      } else {
        startPolling();
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [agentId, handleEvent, setConnected]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (lastEventTime.current) {
          params.set("since", lastEventTime.current);
        }
        const res = await fetch(`${getDesktopRestUrl(agentId)}?${params}`);
        if (!res.ok) return;
        const events = (await res.json()) as unknown[];
        for (const event of events) {
          handleEvent(event);
        }
      } catch {
        // hub unreachable, keep polling
      }
    }, POLL_INTERVAL);
  }, [agentId, handleEvent]);

  useEffect(() => {
    reset();
    connectWs();

    return () => {
      wsRef.current?.close();
      if (pollRef.current) clearInterval(pollRef.current);
      reset();
    };
  }, [agentId, connectWs, reset]);
}
