"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Like useState, but persists to localStorage under the given key.
 *
 * - Reads from localStorage after mount (so SSR returns initial), then hydrates.
 * - Writes on every change.
 * - Survives reloads and tabs (does not auto-sync across tabs to keep this simple).
 *
 * The stored value is always JSON-encoded.
 */
export function useStickyState<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  const hydratedRef = useRef(false);

  // Load from storage on first mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        setValue(JSON.parse(raw) as T);
      }
    } catch {
      // ignore parse / quota errors
    }
    hydratedRef.current = true;
  }, [key]);

  // Persist on change (skip the very first effect run before hydration)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hydratedRef.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore quota errors
    }
  }, [key, value]);

  return [value, setValue];
}
