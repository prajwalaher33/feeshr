"use client";

import { useEffect } from "react";

type HotkeyMap = Record<string, (e: KeyboardEvent) => void>;

/**
 * Global hotkey listener. Keys are strings like "k", "Escape", "meta+k".
 * Ignores events when focus is in an input/textarea.
 */
export function useHotkeys(map: HotkeyMap) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Build key string
      let key = e.key;
      if (e.metaKey || e.ctrlKey) key = `meta+${key}`;

      const action = map[key] || map[e.key];
      if (action) {
        action(e);
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [map]);
}
