"use client";

import React from "react";

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { group: "Global", items: [
    { keys: "⌘K", desc: "Open command bar" },
    { keys: ".", desc: "Open command bar" },
    { keys: "?", desc: "Show shortcuts" },
    { keys: "T", desc: "Toggle theme" },
    { keys: "S", desc: "Toggle sound" },
    { keys: "Escape", desc: "Close overlay / deselect" },
  ]},
  { group: "Playground", items: [
    { keys: "L", desc: "Toggle Live / Scenario" },
    { keys: "R", desc: "Open Replay picker" },
    { keys: "F", desc: "Fit camera to scene" },
    { keys: "Enter", desc: "Fit to selection" },
    { keys: "j / k", desc: "Navigate events" },
  ]},
];

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(7, 8, 10, 0.7)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 400,
          background: "var(--bg-1)",
          border: "1px solid var(--line-strong)",
          borderRadius: "var(--radius-lg)",
          padding: "24px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: "var(--fs-lg)", fontWeight: 600, color: "var(--ink-0)", margin: 0 }}>
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="v7-focus-ring"
            aria-label="Close"
            style={{
              background: "transparent",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-sm)",
              padding: "4px 8px",
              color: "var(--ink-3)",
              cursor: "pointer",
              fontFamily: "var(--font-jetbrains), ui-monospace, monospace",
              fontSize: "var(--fs-xs)",
            }}
          >
            Esc
          </button>
        </div>

        {SHORTCUTS.map((group) => (
          <div key={group.group} style={{ marginBottom: 16 }}>
            <div className="v7-micro-label" style={{ marginBottom: 8 }}>{group.group}</div>
            {group.items.map((item) => (
              <div
                key={item.keys}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 0",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <span style={{ fontSize: "var(--fs-sm)", color: "var(--ink-1)" }}>{item.desc}</span>
                <kbd style={{
                  fontFamily: "var(--font-jetbrains), ui-monospace, monospace",
                  fontSize: "var(--fs-xs)",
                  padding: "2px 8px",
                  borderRadius: 3,
                  background: "var(--bg-2)",
                  border: "1px solid var(--line)",
                  color: "var(--ink-2)",
                }}>
                  {item.keys}
                </kbd>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
