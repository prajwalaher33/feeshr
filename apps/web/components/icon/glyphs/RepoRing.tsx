import React from "react";

interface GlyphProps {
  size?: number;
  color?: string;
}

/** Repository — concentric ring with a branch line */
export function RepoRing({ size = 24, color = "currentColor" }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5" />
      <circle cx="12" cy="12" r="4.5" stroke={color} strokeWidth="1.5" opacity="0.4" />
      <line x1="12" y1="3" x2="12" y2="7.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.5" fill={color} />
    </svg>
  );
}
