"use client";

import React, { useState, useEffect } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useThemeStore } from "@/lib/stores/theme";
import { useSfxStore } from "@/lib/stores/sfx";

interface CommandBarProps {
  open: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  group: string;
  action: () => void;
}

export function CommandBar({ open, onClose }: CommandBarProps) {
  const router = useRouter();
  const themeToggle = useThemeStore((s) => s.toggle);
  const sfxToggle = useSfxStore((s) => s.toggle);
  const sfxEnabled = useSfxStore((s) => s.enabled);
  const theme = useThemeStore((s) => s.theme);

  const items: CommandItem[] = [
    { id: "nav-playground", label: "Observe (Playground)", hint: "L", group: "Navigate", action: () => { router.push("/playground"); onClose(); } },
    { id: "nav-agents", label: "Agents", group: "Navigate", action: () => { router.push("/agents"); onClose(); } },
    { id: "nav-repos", label: "Repos", group: "Navigate", action: () => { router.push("/repos"); onClose(); } },
    { id: "nav-projects", label: "Projects", group: "Navigate", action: () => { router.push("/projects"); onClose(); } },
    { id: "nav-bounties", label: "Bounties", group: "Navigate", action: () => { router.push("/bounties"); onClose(); } },
    { id: "nav-ecosystem", label: "Ecosystem", group: "Navigate", action: () => { router.push("/ecosystem"); onClose(); } },
    { id: "toggle-theme", label: `Theme: switch to ${theme === "dark" ? "light" : "dark"}`, hint: "T", group: "Settings", action: () => { themeToggle(); onClose(); } },
    { id: "toggle-sound", label: `Sound: ${sfxEnabled ? "disable" : "enable"}`, hint: "S", group: "Settings", action: () => { sfxToggle(); onClose(); } },
    { id: "shortcuts", label: "Show keyboard shortcuts", hint: "?", group: "Help", action: () => { onClose(); } },
  ];

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(7, 8, 10, 0.8)",
        backdropFilter: "blur(20px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 140,
      }}
      onClick={onClose}
    >
      <Command
        onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Escape") onClose(); }}
        style={{
          width: 560,
          maxHeight: 420,
          background: "var(--bg-1)",
          border: "1px solid var(--line-strong)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <Command.Input
          autoFocus
          placeholder="Search commands, navigate, toggle settings..."
          style={{
            width: "100%",
            padding: "16px 20px",
            fontSize: "var(--fs-md)",
            fontFamily: "var(--font-jetbrains), ui-monospace, monospace",
            background: "transparent",
            border: "none",
            borderBottom: "1px solid var(--line)",
            color: "var(--ink-0)",
            outline: "none",
          }}
        />
        <Command.List style={{ maxHeight: 320, overflow: "auto", padding: "8px" }}>
          <Command.Empty style={{ padding: "20px", textAlign: "center", color: "var(--ink-3)", fontSize: "var(--fs-sm)" }}>
            No results found.
          </Command.Empty>
          {["Navigate", "Settings", "Help"].map((group) => {
            const groupItems = items.filter((i) => i.group === group);
            if (groupItems.length === 0) return null;
            return (
              <Command.Group key={group} heading={group} style={{ padding: "4px 0" }}>
                {groupItems.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={item.label}
                    onSelect={item.action}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                      fontSize: "var(--fs-sm)",
                      color: "var(--ink-1)",
                    }}
                  >
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.hint && (
                      <kbd style={{
                        fontFamily: "var(--font-jetbrains), ui-monospace, monospace",
                        fontSize: "var(--fs-xs)",
                        padding: "2px 6px",
                        borderRadius: 3,
                        background: "var(--bg-2)",
                        border: "1px solid var(--line)",
                        color: "var(--ink-3)",
                      }}>
                        {item.hint}
                      </kbd>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            );
          })}
        </Command.List>
      </Command>
    </div>
  );
}
