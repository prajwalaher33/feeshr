"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { PlaygroundEvent, WsEnvelope } from "@feeshr/types";

export type WsStatus = "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

interface UseWsStreamOptions {
  url: string | null;
  maxBuffer?: number;
  onEvent?: (event: PlaygroundEvent) => void;
}

interface UseWsStreamReturn {
  events: PlaygroundEvent[];
  status: WsStatus;
  lastSeq: number;
  latency: number;
  clear: () => void;
}

const MAX_EVENTS = 500;
const HEARTBEAT_INTERVAL = 20_000;
const HEARTBEAT_TIMEOUT = 60_000;
const MAX_RECONNECT_DELAY = 30_000;
const BACKPRESSURE_LIMIT = 500;

/**
 * WebSocket stream hook with:
 * - Versioned envelope (v:1) parsing
 * - Monotonic seq tracking for resume (reconnects with ?since=seq:N)
 * - Heartbeat monitoring (expects every 20s, closes at 60s gap)
 * - Backpressure: drops connection if buffer exceeds 500 unprocessed
 * - Exponential backoff reconnect (cap 30s)
 */
export function useWsStream({ url, maxBuffer = MAX_EVENTS, onEvent }: UseWsStreamOptions): UseWsStreamReturn {
  const [events, setEvents] = useState<PlaygroundEvent[]>([]);
  const [status, setStatus] = useState<WsStatus>("disconnected");
  const [latency, setLatency] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const seqRef = useRef(0);
  const retriesRef = useRef(0);
  const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bufferRef = useRef<PlaygroundEvent[]>([]);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const resetHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) clearTimeout(heartbeatTimerRef.current);
    heartbeatTimerRef.current = setTimeout(() => {
      // Heartbeat timeout — close and reconnect
      if (wsRef.current) {
        wsRef.current.close(4001, "Heartbeat timeout");
      }
    }, HEARTBEAT_TIMEOUT);
  }, []);

  const connect = useCallback(() => {
    if (!url) return;

    const resumeUrl = seqRef.current > 0 ? `${url}${url.includes("?") ? "&" : "?"}since=seq:${seqRef.current}` : url;

    setStatus("connecting");
    const ws = new WebSocket(resumeUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      retriesRef.current = 0;
      resetHeartbeat();
    };

    ws.onmessage = (msg) => {
      resetHeartbeat();

      let envelope: WsEnvelope;
      try {
        envelope = JSON.parse(msg.data);
      } catch {
        return; // malformed — skip
      }

      // Version check
      if (envelope.v !== 1) return;

      // Track seq
      if (envelope.seq > seqRef.current) {
        seqRef.current = envelope.seq;
      }

      // Heartbeat — no payload to process
      if (envelope.type === "heartbeat") {
        setLatency(Date.now() - new Date(envelope.ts).getTime());
        return;
      }

      // Backpressure check
      if (bufferRef.current.length >= BACKPRESSURE_LIMIT) {
        ws.close(4002, "Backpressure exceeded");
        return;
      }

      // Parse event payload
      const event = envelope.payload as PlaygroundEvent;
      if (!event || !event.type || !event.id) return;

      bufferRef.current.push(event);
      onEventRef.current?.(event);

      // Flush to state (batched)
      setEvents((prev) => {
        const merged = [...prev, event];
        return merged.length > maxBuffer ? merged.slice(-maxBuffer) : merged;
      });
    };

    ws.onclose = (e) => {
      if (heartbeatTimerRef.current) clearTimeout(heartbeatTimerRef.current);
      wsRef.current = null;

      if (e.code === 1000) {
        setStatus("disconnected");
        return;
      }

      // Reconnect with exponential backoff
      setStatus("reconnecting");
      const delay = Math.min(1000 * 2 ** retriesRef.current, MAX_RECONNECT_DELAY);
      retriesRef.current++;
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      setStatus("error");
    };
  }, [url, maxBuffer, resetHeartbeat]);

  // Connect on mount / URL change
  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close(1000);
      if (heartbeatTimerRef.current) clearTimeout(heartbeatTimerRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [connect]);

  const clear = useCallback(() => {
    setEvents([]);
    bufferRef.current = [];
  }, []);

  return {
    events,
    status,
    lastSeq: seqRef.current,
    latency,
    clear,
  };
}
