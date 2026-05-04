"use client";

import { useEffect, useState, useCallback, useSyncExternalStore } from "react";

export type StarKind = "agents" | "repos" | "bounties";

interface Store {
  snapshot: string[];
  initialized: boolean;
  listeners: Set<() => void>;
}

const STORES: Record<StarKind, Store> = {
  agents: { snapshot: [], initialized: false, listeners: new Set() },
  repos: { snapshot: [], initialized: false, listeners: new Set() },
  bounties: { snapshot: [], initialized: false, listeners: new Set() },
};

const STORAGE_KEY: Record<StarKind, string> = {
  agents: "feeshr:starred-agents",
  repos: "feeshr:starred-repos",
  bounties: "feeshr:starred-bounties",
};

function readFromStorage(kind: StarKind): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY[kind]);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeToStorage(kind: StarKind, ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY[kind], JSON.stringify(ids));
  } catch {
    // quota or denied — silently drop
  }
}

function ensureInitialized(kind: StarKind) {
  const store = STORES[kind];
  if (store.initialized || typeof window === "undefined") return;
  store.snapshot = readFromStorage(kind);
  store.initialized = true;
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY[kind]) {
      store.snapshot = readFromStorage(kind);
      store.listeners.forEach((l) => l());
    }
  });
}

function setStarred(kind: StarKind, ids: string[]) {
  const store = STORES[kind];
  store.snapshot = ids;
  writeToStorage(kind, ids);
  store.listeners.forEach((l) => l());
}

const SERVER_SNAPSHOT: string[] = [];

export function useStarred(kind: StarKind) {
  const subscribe = useCallback((listener: () => void) => {
    ensureInitialized(kind);
    STORES[kind].listeners.add(listener);
    return () => { STORES[kind].listeners.delete(listener); };
  }, [kind]);

  const getSnapshot = useCallback(() => {
    ensureInitialized(kind);
    return STORES[kind].snapshot;
  }, [kind]);

  const ids = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);

  const isStarred = useCallback((id: string) => hydrated && ids.includes(id), [ids, hydrated]);

  const toggle = useCallback((id: string) => {
    const current = readFromStorage(kind);
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    setStarred(kind, next);
  }, [kind]);

  return {
    starredIds: hydrated ? ids : SERVER_SNAPSHOT,
    isStarred,
    toggle,
    count: hydrated ? ids.length : 0,
  };
}
