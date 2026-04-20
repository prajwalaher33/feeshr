"use client";

import React from "react";
import Link from "next/link";
import { Wordmark } from "./Wordmark";
import { Nav } from "./Nav";
import { useThemeStore } from "@/lib/stores/theme";
import { useSfxStore } from "@/lib/stores/sfx";

interface ChromeBarProps {
  onOpenCommand: () => void;
  onOpenShortcuts: () => void;
}

export function ChromeBar({ onOpenCommand, onOpenShortcuts }: ChromeBarProps) {
  const theme = useThemeStore((s) => s.theme);
  const themeToggle = useThemeStore((s) => s.toggle);
  const sfxEnabled = useSfxStore((s) => s.enabled);
  const sfxToggle = useSfxStore((s) => s.toggle);

  return (
    <header
      style={{
        height: 48,
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        background: "var(--bg-0)",
        borderBottom: "1px solid var(--line)",
        flexShrink: 0,
        gap: 16,
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Wordmark */}
      <Link href="/" style={{ textDecoration: "none", flexShrink: 0 }} aria-label="Home">
        <Wordmark height={14} />
      </Link>

      {/* Nav (center) */}
      <Nav />

      {/* Spacer */}
      <span style={{ flex: 1 }} />

      {/* Right controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {/* Sound toggle */}
        <button
          onClick={sfxToggle}
          className="v7-focus-ring"
          aria-label={sfxEnabled ? "Disable sound" : "Enable sound"}
          title={sfxEnabled ? "Sound on" : "Sound off"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--line)",
            background: sfxEnabled ? "color-mix(in srgb, var(--phos-500) 8%, transparent)" : "transparent",
            color: sfxEnabled ? "var(--phos-400)" : "var(--ink-3)",
            fontSize: "var(--fs-xs)",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            fontWeight: 500,
            cursor: "pointer",
            transition: "all var(--dur-sm) var(--ease-standard)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            {sfxEnabled && (
              <>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </>
            )}
            {!sfxEnabled && <line x1="23" y1="9" x2="17" y2="15" />}
          </svg>
          Sound
        </button>

        {/* Theme toggle */}
        <button
          onClick={themeToggle}
          className="v7-focus-ring"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          title={`Theme: ${theme}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--line)",
            background: "transparent",
            color: "var(--ink-3)",
            fontSize: "var(--fs-xs)",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            fontWeight: 500,
            cursor: "pointer",
            transition: "all var(--dur-sm) var(--ease-standard)",
          }}
        >
          {theme === "dark" ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          )}
          Theme
        </button>

        {/* Shortcuts */}
        <button
          onClick={onOpenShortcuts}
          className="v7-focus-ring"
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "4px 8px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--line)",
            background: "transparent",
            color: "var(--ink-3)",
            fontSize: "var(--fs-xs)",
            fontFamily: "var(--font-jetbrains), ui-monospace, monospace",
            cursor: "pointer",
            transition: "all var(--dur-sm) var(--ease-standard)",
          }}
        >
          ?
        </button>

        {/* Search / Command */}
        <button
          onClick={onOpenCommand}
          className="v7-focus-ring"
          aria-label="Open command bar"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 10px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--line)",
            background: "var(--bg-1)",
            color: "var(--ink-3)",
            fontSize: "var(--fs-xs)",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            cursor: "pointer",
            minWidth: 140,
            transition: "border-color var(--dur-sm) var(--ease-standard)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>Search...</span>
          <kbd style={{
            marginLeft: "auto",
            fontFamily: "var(--font-jetbrains), ui-monospace, monospace",
            fontSize: 9,
            padding: "1px 4px",
            borderRadius: 3,
            background: "var(--bg-2)",
            border: "1px solid var(--line)",
            color: "var(--ink-4)",
          }}>
            ⌘K
          </kbd>
        </button>
      </div>
    </header>
  );
}
