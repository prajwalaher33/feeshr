"use client";

/**
 * WebSocket hook for the Feeshr observer feed.
 *
 * Connects to the sanitized feed, enforces client-side privacy guards,
 * implements a ring buffer for backpressure handling, and falls back
 * to REST polling when WebSocket is unavailable.
 */

import { useEffect, useRef, useCallback } from "react";
import { useFeedStore } from "@/lib/stores/feed-store";
import { getWebSocketUrl, getFeed } from "@/lib/api-client";
import { validateFeedEvent, sanitizeEvent } from "@/lib/privacy-guard";

/** Maximum events to buffer before dropping oldest. */
const RING_BUFFER_SIZE = 200;

/** Polling interval (ms) when WebSocket is unavailable. */
const POLL_INTERVAL = 10_000;

/** Reconnect delay (ms) after WebSocket disconnect. */
const RECONNECT_DELAY = 3_000;

/** Maximum reconnect attempts before falling back to polling. */
const MAX_RECONNECT = 5;

export function useFeedSocket() {
  const { addEvent, setEvents } = useFeedStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bufferRef = useRef<unknown[]>([]);

  const processEvent = useCallback(
    (raw: unknown) => {
      // Privacy guard: reject events with forbidden keys
      if (!validateFeedEvent(raw)) {
        return; // dropped — logged by privacy-guard
      }

      // Defense-in-depth: strip any remaining forbidden keys
      const safe = sanitizeEvent(raw) as Record<string, unknown>;

      // Ring buffer: drop oldest if full
      if (bufferRef.current.length >= RING_BUFFER_SIZE) {
        bufferRef.current.shift();
      }
      bufferRef.current.push(safe);

      // Forward to store
      addEvent(safe as any);
    },
    [addEvent],
  );

  const connectWs = useCallback(() => {
    if (typeof window === "undefined") return;

    const url = getWebSocketUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectCount.current = 0;
      // Stop polling if it was running
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        processEvent(data);
      } catch {
        // Ignore non-JSON messages
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (reconnectCount.current < MAX_RECONNECT) {
        reconnectCount.current++;
        setTimeout(connectWs, RECONNECT_DELAY);
      } else {
        // Fall back to polling
        startPolling();
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [processEvent]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const { events } = await getFeed(20);
        // Each event goes through privacy guard
        for (const event of events) {
          processEvent(event);
        }
      } catch {
        // Hub unreachable, keep polling
      }
    }, POLL_INTERVAL);
  }, [processEvent]);

  useEffect(() => {
    // Load initial events via REST
    getFeed(20).then(({ events }) => {
      if (events.length > 0) {
        const safeEvents = events.filter(validateFeedEvent).map(sanitizeEvent);
        setEvents(safeEvents as any[]);
      }
    });

    // Try WebSocket first
    connectWs();

    return () => {
      wsRef.current?.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [connectWs, setEvents]);
}
