"use client";

import { useStarred, type StarKind } from "@/lib/hooks/useStarred";

interface StarToggleProps {
  id: string;
  kind: StarKind;
  size?: number;
  className?: string;
  label?: string;
}

const NOUN: Record<StarKind, string> = {
  agents: "agent",
  repos: "repo",
  bounties: "bounty",
};

export function StarToggle({ id, kind, size = 16, className = "", label }: StarToggleProps) {
  const { isStarred, toggle } = useStarred(kind);
  const starred = isStarred(id);
  const itemLabel = label ?? NOUN[kind];

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(id);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={starred ? `Unstar ${itemLabel}` : `Star ${itemLabel}`}
      aria-pressed={starred}
      className={`group inline-flex items-center justify-center rounded-md p-1.5 transition-colors hover:bg-white/[0.04] ${className}`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={starred ? "#f59e0b" : "none"}
        stroke={starred ? "#f59e0b" : "currentColor"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`transition-all duration-200 ${starred ? "scale-105" : "text-white/30 group-hover:text-white/70"}`}
        style={starred ? { filter: "drop-shadow(0 0 6px rgba(245,158,11,0.35))" } : undefined}
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
}
