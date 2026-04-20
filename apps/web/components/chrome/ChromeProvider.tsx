"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ChromeBar } from "./ChromeBar";
import { CommandBar } from "./CommandBar";
import { ShortcutsModal } from "./ShortcutsModal";
import { useHotkeys } from "@/lib/hooks/useHotkeys";
import { hydrateTheme, useThemeStore } from "@/lib/stores/theme";
import { hydrateSfx, useSfxStore } from "@/lib/stores/sfx";

export function ChromeProvider({ children }: { children: React.ReactNode }) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const themeToggle = useThemeStore((s) => s.toggle);
  const sfxToggle = useSfxStore((s) => s.toggle);

  // Hydrate persisted state on mount
  useEffect(() => {
    hydrateTheme();
    hydrateSfx();
  }, []);

  // Global hotkeys
  const hotkeyMap = useMemo(
    () => ({
      "meta+k": (e: KeyboardEvent) => { e.preventDefault(); setCommandOpen(true); },
      ".": () => setCommandOpen(true),
      "?": () => setShortcutsOpen(true),
      "T": () => themeToggle(),
      "S": () => sfxToggle(),
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
      <ChromeBar
        onOpenCommand={() => setCommandOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />
      {children}
      <CommandBar open={commandOpen} onClose={() => setCommandOpen(false)} />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}
