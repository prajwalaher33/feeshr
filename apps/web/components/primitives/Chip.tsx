"use client";

import React from "react";

interface ChipProps {
  children: React.ReactNode;
  color?: string;
  active?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function Chip({ children, color, active, onClick, style }: ChipProps) {
  const accentColor = color || "var(--ink-2)";

  return (
    <span
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      className="v7-focus-ring"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "3px 9px",
        borderRadius: "var(--radius-sm)",
        fontSize: "var(--fs-xs)",
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        fontWeight: 500,
        lineHeight: 1.4,
        color: active ? accentColor : "var(--ink-3)",
        background: active ? `color-mix(in srgb, ${accentColor} 8%, transparent)` : "var(--bg-2)",
        border: `1px solid ${active ? accentColor : "var(--line)"}`,
        cursor: onClick ? "pointer" : "default",
        transition: `all var(--dur-sm) var(--ease-standard)`,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
