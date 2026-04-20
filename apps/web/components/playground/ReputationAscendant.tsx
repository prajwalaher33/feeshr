"use client";

import React, { useEffect, useRef, useState } from "react";
import type { PlaygroundEvent } from "@feeshr/types";
import { getAgentHue } from "@/lib/agentHue";
import { scheduleCinema, type CinemaPriority } from "@/lib/sceneConductor";

// ─── Types ──────────────────────────────────────────────────────────────────

interface FloatingNumeral {
  id: string;
  value: string;
  color: string;
  x: number; // viewport-relative percentage (0–100)
  startTime: number;
  isBigMoment: boolean;
}

export interface ReputationAscendantProps {
  events: PlaygroundEvent[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const NUMERAL_DURATION = 1200; // ms for normal
const BIG_MOMENT_DURATION = 1800; // ms for cinema moment
const BIG_MOMENT_THRESHOLD = 50; // rep gain that triggers cinema
const QUEUE_INTERVAL = 180; // ms between stacked gains

// ─── Component ──────────────────────────────────────────────────────────────

export function ReputationAscendant({ events }: ReputationAscendantProps) {
  const [numerals, setNumerals] = useState<FloatingNumeral[]>([]);
  const processedRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<FloatingNumeral[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotionRef = useRef(false);
  const bigMomentUsedRef = useRef(false); // one per scene

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Process reputation events
  useEffect(() => {
    for (const ev of events) {
      if (ev.type !== "agent.reputation_changed") continue;
      if (processedRef.current.has(ev.id)) continue;
      processedRef.current.add(ev.id);

      // Parse rep change from detail
      const match = ev.detail?.match(/([+-]?\d+)/);
      if (!match) continue;

      const repValue = parseInt(match[1], 10);
      const absValue = Math.abs(repValue);
      const isBig = absValue >= BIG_MOMENT_THRESHOLD && !bigMomentUsedRef.current;

      if (isBig) bigMomentUsedRef.current = true;

      const numeral: FloatingNumeral = {
        id: ev.id,
        value: repValue > 0 ? `+${repValue}` : `${repValue}`,
        color: getAgentHue(ev.actor_id),
        x: 30 + Math.random() * 40, // spread across center 40% of viewport
        startTime: 0, // set when displayed
        isBigMoment: isBig,
      };

      queueRef.current.push(numeral);
    }

    // Start processing queue if not already
    if (!timerRef.current && queueRef.current.length > 0) {
      processNext();
    }

    // Trim processed set
    if (processedRef.current.size > 500) {
      const arr = [...processedRef.current];
      processedRef.current = new Set(arr.slice(-250));
    }
  }, [events]);

  function processNext() {
    if (queueRef.current.length === 0) {
      timerRef.current = null;
      return;
    }

    const next = queueRef.current.shift()!;
    next.startTime = performance.now();

    if (next.isBigMoment && !reducedMotionRef.current) {
      // Schedule through SceneConductor
      scheduleCinema({
        id: `rep-ascendant-${next.id}`,
        priority: "medium" as CinemaPriority,
        duration: BIG_MOMENT_DURATION,
        onStart: () => {
          setNumerals(prev => [...prev, next]);
        },
        onEnd: () => {
          setNumerals(prev => prev.filter(n => n.id !== next.id));
        },
      });
    } else {
      // Normal numeral — just display
      setNumerals(prev => [...prev, next]);
      setTimeout(() => {
        setNumerals(prev => prev.filter(n => n.id !== next.id));
      }, NUMERAL_DURATION);
    }

    timerRef.current = setTimeout(processNext, QUEUE_INTERVAL);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (reducedMotionRef.current) {
    // Show static badges instead of floating
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 20,
      }}
      aria-hidden="true"
    >
      {numerals.map(n => (
        <AscendingNumeral key={n.id} numeral={n} />
      ))}
    </div>
  );
}

// ─── Individual numeral ─────────────────────────────────────────────────────

function AscendingNumeral({ numeral }: { numeral: FloatingNumeral }) {
  const elRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const totalDuration = numeral.isBigMoment ? BIG_MOMENT_DURATION : NUMERAL_DURATION;

    function animate() {
      const node = elRef.current;
      if (!node) return;

      const elapsed = performance.now() - numeral.startTime;
      const t = Math.min(elapsed / totalDuration, 1);

      // Rise and fade
      const y = numeral.isBigMoment ? 30 - t * 20 : 60 - t * 40;
      const opacity = t < 0.2 ? t / 0.2 : t > 0.7 ? (1 - t) / 0.3 : 1;
      const scale = numeral.isBigMoment
        ? 1 + Math.sin(t * Math.PI) * 0.2
        : 1;

      node.style.top = `${y}%`;
      node.style.opacity = `${opacity}`;
      node.style.transform = `translateX(-50%) scale(${scale})`;

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [numeral]);

  return (
    <div
      ref={elRef}
      style={{
        position: "absolute",
        left: `${numeral.x}%`,
        top: "60%",
        transform: "translateX(-50%)",
        fontFamily: numeral.isBigMoment ? "var(--font-instrument)" : "var(--font-jetbrains)",
        fontSize: numeral.isBigMoment ? "var(--fs-display)" : "var(--fs-xl)",
        fontWeight: numeral.isBigMoment ? 400 : 700,
        color: numeral.color,
        textShadow: numeral.isBigMoment ? `0 0 24px ${numeral.color}` : "none",
        opacity: 0,
        whiteSpace: "nowrap",
      }}
    >
      {numeral.value}
    </div>
  );
}
