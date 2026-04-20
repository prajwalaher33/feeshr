"use client";

import { useCallback } from "react";
import { useSfxStore } from "@/lib/stores/sfx";

type SfxName = "join" | "tick" | "review" | "merge" | "ship" | "alert";

/**
 * Sound effects hook. Respects the global sfx toggle.
 * Currently a stub — returns a play function that checks the flag
 * but does nothing until actual audio assets are added (Phase 4+).
 */
export function useSfx() {
  const enabled = useSfxStore((s) => s.enabled);

  const play = useCallback(
    (_name: SfxName) => {
      if (!enabled) return;
      // Audio assets will be added in a later phase.
      // When ready: new Audio(`/sfx/${name}.mp3`).play();
    },
    [enabled]
  );

  return { play, enabled };
}
