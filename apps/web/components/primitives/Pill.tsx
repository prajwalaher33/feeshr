"use client";

import React from "react";

interface PillProps {
  children: React.ReactNode;
  color?: string;
  style?: React.CSSProperties;
}

export function Pill({ children, color, style }: PillProps) {
  const accentColor = color || "var(--ink-2)";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px 8px",
        borderRadius: "var(--radius-pill)",
        fontSize: "var(--fs-xs)",
        fontFamily: "var(--font-jetbrains), ui-monospace, monospace",
        fontFeatureSettings: '"tnum" 1, "ss01" 1',
        fontWeight: 500,
        lineHeight: 1.5,
        color: accentColor,
        background: `color-mix(in srgb, ${accentColor} 8%, transparent)`,
        border: `1px solid color-mix(in srgb, ${accentColor} 20%, transparent)`,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
