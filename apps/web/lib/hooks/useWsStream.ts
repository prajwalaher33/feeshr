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
  eventRate: number;
  buffered: number;
  clear: () => void;
}

const MAX_EVENTS = 700;
const BATCH_INTERVAL = 80;
const HEARTBEAT_TIMEOUT = 60_000;
const MAX_RECONNECT_DELAY = 30_000;
const BACKPRESSURE_LIMIT = 600;

export function useWsStream({
  url,
  maxBuffer = MAX_EVENTS,
  onEvent,
}: UseWsStreamOptions): UseWsStreamReturn {
  const [events, setEvents] = useState<PlaygroundEvent[]>([]);
  const [status, setStatus] = useState<WsStatus>("disconnected");
  const [latency, setLatency] = useState(0);
  const [eventRate, setEventRate] = useState(0);
  const [buffered, setBuffered] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const seqRef = useRef(0);
  const retriesRef = useRef(0);
  const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rateCounterRef = useRef(0);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const batchRef = useRef<PlaygroundEvent[]>([]);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const clearTimers = useCallback(() => {
    if (heartbeatTimerRef.current) clearTimeout(heartbeatTimerRef.current);
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    heartbeatTimerRef.current = null;
    reconnectTimerRef.current = null;
    batchTimerRef.current = null;
  }, []);

  const flushBatch = useCallback(() => {
    const batch = batchRef.current;
    if (batch.length === 0) return;

    batchRef.current = [];
    setBuffered(0);
    setEvents((prev) => {
      const merged = [...prev, ...batch];
      return merged.length > maxBuffer ? merged.slice(-maxBuffer) : merged;
    });
  }, [maxBuffer]);

  const enqueue = useCallback((event: PlaygroundEvent) => {
    if (seenIdsRef.current.has(event.id)) return;
    seenIdsRef.current.add(event.id);
    if (seenIdsRef.current.size > maxBuffer * 2) {
      seenIdsRef.current = new Set([...seenIdsRef.current].slice(-maxBuffer));
    }

    batchRef.current.push(event);
    setBuffered(batchRef.current.length);
    rateCounterRef.current += 1;
    onEventRef.current?.(event);

    if (!batchTimerRef.current) {
      batchTimerRef.current = setTimeout(() => {
        batchTimerRef.current = null;
        flushBatch();
      }, BATCH_INTERVAL);
    }
  }, [flushBatch, maxBuffer]);

  const resetHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) clearTimeout(heartbeatTimerRef.current);
    heartbeatTimerRef.current = setTimeout(() => {
      wsRef.current?.close(4001, "Heartbeat timeout");
    }, HEARTBEAT_TIMEOUT);
  }, []);

  const connect = useCallback(() => {
    if (!url) {
      setStatus("disconnected");
      return;
    }

    reconnectTimerRef.current = null;
    const resumeUrl = seqRef.current > 0
      ? `${url}${url.includes("?") ? "&" : "?"}since=seq:${seqRef.current}`
      : url;

    setStatus(retriesRef.current > 0 ? "reconnecting" : "connecting");
    const ws = new WebSocket(resumeUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      retriesRef.current = 0;
      resetHeartbeat();
    };

    ws.onmessage = (message) => {
      resetHeartbeat();

      let envelope: WsEnvelope;
      try {
        envelope = JSON.parse(message.data);
      } catch {
        return;
      }

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
      if (!event?.id || !event.type || !event.actor_id) return;
      enqueue(event);
    };

    ws.onerror = () => {
      setStatus("error");
      ws.close();
    };

    ws.onclose = (event) => {
      if (heartbeatTimerRef.current) clearTimeout(heartbeatTimerRef.current);
      wsRef.current = null;

      if (event.code === 1000) {
        setStatus("disconnected");
        return;
      }

      setStatus("reconnecting");
      const jitter = Math.floor(Math.random() * 350);
      const delay = Math.min(1000 * 2 ** retriesRef.current + jitter, MAX_RECONNECT_DELAY);
      retriesRef.current += 1;
      reconnectTimerRef.current = setTimeout(connect, delay);
    };
  }, [enqueue, resetHeartbeat, url]);

  useEffect(() => {
    if (rateTimerRef.current) clearInterval(rateTimerRef.current);
    rateTimerRef.current = setInterval(() => {
      setEventRate(rateCounterRef.current);
      rateCounterRef.current = 0;
    }, 1000);

    connect();
    return () => {
      clearTimers();
      if (rateTimerRef.current) clearInterval(rateTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close(1000);
      }
      wsRef.current = null;
      batchRef.current = [];
    };
  }, [clearTimers, connect]);

  const clear = useCallback(() => {
    batchRef.current = [];
    seenIdsRef.current.clear();
    setBuffered(0);
    setEvents([]);
  }, []);

  return { events, status, lastSeq: seqRef.current, latency, eventRate, buffered, clear };
}
