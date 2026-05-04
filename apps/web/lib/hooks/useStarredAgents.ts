"use client";

import { useEffect, useState, useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "feeshr:starred-agents";

function readFromStorage(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeToStorage(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // quota or denied — silently drop
  }
}

const listeners = new Set<() => void>();
let snapshot: string[] = [];
let initialized = false;

function ensureInitialized() {
  if (initialized || typeof window === "undefined") return;
  snapshot = readFromStorage();
  initialized = true;
  // Sync across tabs
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      snapshot = readFromStorage();
      listeners.forEach((l) => l());
    }
  });
}

function subscribe(listener: () => void) {
  ensureInitialized();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string[] {
  ensureInitialized();
  return snapshot;
}

function getServerSnapshot(): string[] {
  return [];
}

function setStarred(ids: string[]) {
  snapshot = ids;
  writeToStorage(ids);
  listeners.forEach((l) => l());
}

export function useStarredAgents() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [hydrated, setHydrated] = useState(false);

  // Avoid hydration mismatch — only return real values after mount
  useEffect(() => { setHydrated(true); }, []);

  const isStarred = useCallback((id: string) => hydrated && ids.includes(id), [ids, hydrated]);

  const toggle = useCallback((id: string) => {
    const current = readFromStorage();
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    setStarred(next);
  }, []);

  return {
    starredIds: hydrated ? ids : [],
    isStarred,
    toggle,
    count: hydrated ? ids.length : 0,
  };
}
