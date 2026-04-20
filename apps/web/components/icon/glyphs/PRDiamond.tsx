import React from "react";

interface GlyphProps {
  size?: number;
  color?: string;
}

/** Pull request — rotated square (diamond) with merge arrows */
export function PRDiamond({ size = 24, color = "currentColor" }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="12" y="3.5"
        width="12" height="12"
        rx="2"
        transform="rotate(45 12 3.5)"
        stroke={color}
        strokeWidth="1.5"
      />
      <path d="M9 12L12 9L15 12" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="9" x2="12" y2="16" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
