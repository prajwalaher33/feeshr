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
const HEARTBEAT_TIMEOUT = 60_000;
const MAX_RECONNECT_DELAY = 30_000;
const BACKPRESSURE_LIMIT = 500;
const BATCH_INTERVAL = 50;

export function useWsStream({ url, maxBuffer = MAX_EVENTS, onEvent }: UseWsStreamOptions): UseWsStreamReturn {
  const [events, setEvents] = useState<PlaygroundEvent[]>([]);
  const [status, setStatus] = useState<WsStatus>("disconnected");
  const [latency, setLatency] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const seqRef = useRef(0);
  const retriesRef = useRef(0);
  const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // Batching: collect events and flush on interval
  const batchRef = useRef<PlaygroundEvent[]>([]);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushBatch = useCallback(() => {
    if (batchRef.current.length === 0) return;
    const batch = batchRef.current;
    batchRef.current = [];
    setEvents((prev) => {
      const merged = [...prev, ...batch];
      return merged.length > maxBuffer ? merged.slice(-maxBuffer) : merged;
    });
  }, [maxBuffer]);

  const enqueueBatch = useCallback((event: PlaygroundEvent) => {
    batchRef.current.push(event);
    onEventRef.current?.(event);

    if (!batchTimerRef.current) {
      batchTimerRef.current = setTimeout(() => {
        batchTimerRef.current = null;
        flushBatch();
      }, BATCH_INTERVAL);
    }
  }, [flushBatch]);

  const resetHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) clearTimeout(heartbeatTimerRef.current);
    heartbeatTimerRef.current = setTimeout(() => {
      if (wsRef.current) wsRef.current.close(4001, "Heartbeat timeout");
    }, HEARTBEAT_TIMEOUT);
  }, []);

  const connect = useCallback(() => {
    if (!url) return;

    const resumeUrl = seqRef.current > 0
      ? `${url}${url.includes("?") ? "&" : "?"}since=seq:${seqRef.current}`
      : url;

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
      try { envelope = JSON.parse(msg.data); } catch { return; }
      if (envelope.v !== 1) return;

      if (envelope.seq > seqRef.current) seqRef.current = envelope.seq;

      if (envelope.type === "heartbeat") {
        setLatency(Date.now() - new Date(envelope.ts).getTime());
        return;
      }

      if (batchRef.current.length >= BACKPRESSURE_LIMIT) {
        ws.close(4002, "Backpressure exceeded");
        return;
      }

      const event = envelope.payload as PlaygroundEvent;
      if (!event?.type || !event.id) return;

      enqueueBatch(event);
    };

    ws.onclose = (e) => {
      if (heartbeatTimerRef.current) clearTimeout(heartbeatTimerRef.current);
      wsRef.current = null;

      if (e.code === 1000) { setStatus("disconnected"); return; }

      setStatus("reconnecting");
      const delay = Math.min(1000 * 2 ** retriesRef.current, MAX_RECONNECT_DELAY);
      retriesRef.current++;
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => setStatus("error");
  }, [url, resetHeartbeat, enqueueBatch]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close(1000);
      if (heartbeatTimerRef.current) clearTimeout(heartbeatTimerRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    };
  }, [connect]);

  const clear = useCallback(() => {
    setEvents([]);
    batchRef.current = [];
  }, []);

  return { events, status, lastSeq: seqRef.current, latency, clear };
}
