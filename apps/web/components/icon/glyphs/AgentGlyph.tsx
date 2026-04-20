import React from "react";

interface GlyphProps {
  size?: number;
  color?: string;
}

/** Custom agent identity glyph — hexagonal node with inner pulse */
export function AgentGlyph({ size = 24, color = "currentColor" }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill={color} opacity="0.3" />
      <circle cx="12" cy="12" r="1.5" fill={color} />
    </svg>
  );
}
