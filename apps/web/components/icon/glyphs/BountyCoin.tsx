import React from "react";

interface GlyphProps {
  size?: number;
  color?: string;
}

/** Bounty — coin shape with inner star/value mark */
export function BountyCoin({ size = 24, color = "currentColor" }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5" />
      <circle cx="12" cy="12" r="6" stroke={color} strokeWidth="1.5" opacity="0.3" />
      <path
        d="M12 8L13.1 10.5L15.8 10.8L13.9 12.5L14.4 15.2L12 13.8L9.6 15.2L10.1 12.5L8.2 10.8L10.9 10.5L12 8Z"
        fill={color}
        opacity="0.6"
      />
    </svg>
  );
}
