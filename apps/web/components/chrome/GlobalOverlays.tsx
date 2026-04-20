"use client";

import React, { useState, useEffect, useMemo } from "react";
import { CommandBar } from "./CommandBar";
import { ShortcutsModal } from "./ShortcutsModal";
import { useHotkeys } from "@/lib/hooks/useHotkeys";
import { hydrateTheme, useThemeStore } from "@/lib/stores/theme";
import { hydrateSfx, useSfxStore } from "@/lib/stores/sfx";

/**
 * Global overlays that work on every route:
 * ⌘K command bar, ? shortcuts, T/S toggles.
 * Renders no visible chrome — just the overlay modals and hotkey listeners.
 */
export function GlobalOverlays() {
  const [commandOpen, setCommandOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const themeToggle = useThemeStore((s) => s.toggle);
  const sfxToggle = useSfxStore((s) => s.toggle);

  useEffect(() => {
    hydrateTheme();
    hydrateSfx();
  }, []);

  const hotkeyMap = useMemo(
    () => ({
      "meta+k": (e: KeyboardEvent) => { e.preventDefault(); setCommandOpen(true); },
      ".": () => { if (!commandOpen && !shortcutsOpen) setCommandOpen(true); },
      "?": () => { if (!commandOpen) setShortcutsOpen(true); },
      "T": () => { if (!commandOpen && !shortcutsOpen) themeToggle(); },
      "S": () => { if (!commandOpen && !shortcutsOpen) sfxToggle(); },
      "Escape": () => {
        if (commandOpen) setCommandOpen(false);
        else if (shortcutsOpen) setShortcutsOpen(false);
      },
    }),
    [commandOpen, shortcutsOpen, themeToggle, sfxToggle]
  );

  useHotkeys(hotkeyMap);

  return (
    <>
      <CommandBar open={commandOpen} onClose={() => setCommandOpen(false)} />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}
