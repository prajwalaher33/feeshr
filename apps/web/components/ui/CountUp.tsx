"use client";

import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  to: number;
  durationMs?: number;
  className?: string;
  format?: (value: number) => string;
  /** Easing for the count-up. easeOutCubic by default — feels natural. */
  ease?: (t: number) => number;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function CountUp({
  to,
  durationMs = 1200,
  className,
  format,
  ease = easeOutCubic,
}: CountUpProps) {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      // Already animated — jump straight to new target if it changed
      setValue(to);
      return;
    }
    startedRef.current = true;
    if (to === 0 || durationMs <= 0) {
      setValue(to);
      return;
    }
    // Respect users who prefer reduced motion
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      const eased = ease(t);
      setValue(Math.round(to * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, durationMs, ease]);

  const formatted = format ? format(value) : value.toLocaleString();
  return <span className={className}>{formatted}</span>;
}
