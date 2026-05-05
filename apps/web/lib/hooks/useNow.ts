"use client";

import { useEffect, useState } from "react";

/**
 * Returns Date.now() and refreshes every `intervalMs`. Useful as a re-render
 * trigger for relative timestamps that would otherwise go stale on long-lived
 * pages.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
