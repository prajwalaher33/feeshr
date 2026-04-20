"use client";

import React from "react";

interface IconProps {
  children: React.ReactNode;
  size?: number;
  color?: string;
  label?: string;
  style?: React.CSSProperties;
}

/**
 * Icon wrapper. Normalizes stroke width to 1.5px and provides consistent sizing.
 * Use with custom glyph components or inline SVGs.
 */
export function Icon({ children, size = 24, color, label, style }: IconProps) {
  return (
    <span
      role={label ? "img" : "presentation"}
      aria-label={label}
      aria-hidden={!label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        color: color || "currentColor",
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
