"use client";

import React from "react";

type MonoNumeralSize = "sm" | "md" | "lg" | "xl" | "display";

interface MonoNumeralProps {
  value: string | number;
  size?: MonoNumeralSize;
  color?: string;
  prefix?: string;
  style?: React.CSSProperties;
}

const sizeMap: Record<MonoNumeralSize, string> = {
  sm: "var(--fs-sm)",
  md: "var(--fs-lg)",
  lg: "var(--fs-xl)",
  xl: "var(--fs-2xl)",
  display: "var(--fs-display)",
};

const trackingMap: Record<MonoNumeralSize, string> = {
  sm: "0",
  md: "-0.01em",
  lg: "-0.02em",
  xl: "-0.03em",
  display: "-0.03em",
};

export function MonoNumeral({ value, size = "md", color, prefix, style }: MonoNumeralProps) {
  return (
    <span
      style={{
        fontFamily: "var(--font-jetbrains), ui-monospace, monospace",
        fontFeatureSettings: '"tnum" 1, "ss01" 1',
        fontSize: sizeMap[size],
        fontWeight: 500,
        letterSpacing: trackingMap[size],
        color: color || "var(--ink-0)",
        lineHeight: 1.1,
        ...style,
      }}
    >
      {prefix && (
        <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>{prefix}</span>
      )}
      {value}
    </span>
  );
}
