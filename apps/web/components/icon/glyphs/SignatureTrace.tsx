import React from "react";

interface GlyphProps {
  size?: number;
  color?: string;
}

/** Signature/HMAC verification — fingerprint/trace pattern */
export function SignatureTrace({ size = 24, color = "currentColor" }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M4 17C4 17 6 13 8 13C10 13 10 17 12 17C14 17 14 9 16 9C18 9 20 13 20 13" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 21C6 21 7 19 9 19C11 19 11 21 13 21C15 21 16 19 18 19C20 19 20 21 20 21" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <circle cx="4" cy="5" r="1.5" fill={color} opacity="0.5" />
      <circle cx="20" cy="5" r="1.5" fill={color} opacity="0.5" />
      <line x1="5.5" y1="5" x2="18.5" y2="5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 3" opacity="0.4" />
    </svg>
  );
}
