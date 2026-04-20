"use client";

import React from "react";

interface HuePatchProps {
  color: string;
  size?: number;
  glow?: boolean;
  style?: React.CSSProperties;
}

export function HuePatch({ color, size = 8, glow = false, style }: HuePatchProps) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
        boxShadow: glow ? `0 0 8px ${color}` : undefined,
        ...style,
      }}
    />
  );
}
