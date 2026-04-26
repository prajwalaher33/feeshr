"use client";

import React from "react";
import type { ObsAgent, EventCategory } from "./usePlaygroundData";

export function AgentMark({ agent, size = 24 }: { agent: ObsAgent; size?: number }) {
  const initials = agent.handle.slice(0, 2).toUpperCase();
  const h = agent.hue;
  return (
    <div style={{
      width: size, height: size,
      borderRadius: size > 28 ? 8 : 6,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `hsl(${h} 30% 14%)`,
      border: `1px solid hsl(${h} 40% 26%)`,
      color: `hsl(${h} 50% 72%)`,
      fontFamily: 'var(--font-mono, ui-monospace, monospace)',
      fontSize: Math.max(9, Math.round(size * 0.34)),
      fontWeight: 600,
      letterSpacing: '-0.02em',
      flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

export const CATEGORY_STYLE: Record<EventCategory, { color: string; bg: string; border: string; label: string }> = {
  genesis:  { color: '#bf5af2', bg: 'rgba(191, 90, 242, 0.08)', border: 'rgba(191, 90, 242, 0.22)', label: 'Genesis' },
  run:      { color: 'var(--ok, #3BD01F)', bg: 'rgba(59, 208, 31, 0.08)', border: 'rgba(59, 208, 31, 0.22)', label: 'Run' },
  pr:       { color: 'var(--info, #5B8DEF)', bg: 'rgba(91, 141, 239, 0.08)', border: 'rgba(91, 141, 239, 0.22)', label: 'PR' },
  review:   { color: 'var(--warn, #E8B339)', bg: 'rgba(232, 179, 57, 0.08)', border: 'rgba(232, 179, 57, 0.22)', label: 'Review' },
  merge:    { color: 'var(--ok, #3BD01F)', bg: 'rgba(59, 208, 31, 0.08)', border: 'rgba(59, 208, 31, 0.22)', label: 'Merge' },
  failure:  { color: 'var(--err, #E5484D)', bg: 'rgba(229, 72, 77, 0.08)', border: 'rgba(229, 72, 77, 0.22)', label: 'Failure' },
  claim:    { color: '#22d3ee', bg: 'rgba(34, 211, 238, 0.08)', border: 'rgba(34, 211, 238, 0.22)', label: 'Claim' },
  decision: { color: '#bf5af2', bg: 'rgba(191, 90, 242, 0.08)', border: 'rgba(191, 90, 242, 0.22)', label: 'Decision' },
  security: { color: 'var(--err, #E5484D)', bg: 'rgba(229, 72, 77, 0.08)', border: 'rgba(229, 72, 77, 0.22)', label: 'Security' },
  publish:  { color: 'var(--ok, #3BD01F)', bg: 'rgba(59, 208, 31, 0.08)', border: 'rgba(59, 208, 31, 0.22)', label: 'Publish' },
  other:    { color: 'var(--ink-3, #5A616B)', bg: 'var(--bg-2, #111418)', border: 'var(--line, #1E242B)', label: 'Event' },
};

export function CategoryBadge({ category }: { category: EventCategory }) {
  const s = CATEGORY_STYLE[category];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 6,
      fontSize: 10, fontWeight: 600, letterSpacing: '0.02em',
      color: s.color, background: s.bg, border: `1px solid ${s.border}`,
    }}>
      {s.label}
    </span>
  );
}

export function StatusDot({ status, pulse = false }: { status: "active" | "idle" | "review" | "success" | "error" | "warning"; pulse?: boolean }) {
  const colors: Record<string, string> = {
    active: 'var(--ok, #3BD01F)', success: 'var(--ok, #3BD01F)',
    warning: 'var(--warn, #E8B339)', error: 'var(--err, #E5484D)',
    review: 'var(--warn, #E8B339)', idle: 'var(--ink-4, #3A4049)',
  };
  const c = colors[status] || colors.idle;
  return (
    <span
      style={{
        width: 6, height: 6, borderRadius: '50%',
        background: c, flexShrink: 0,
        boxShadow: pulse ? `0 0 6px ${c}` : 'none',
        animation: pulse ? 'pulse 2s ease-in-out infinite' : 'none',
      }}
    />
  );
}

export function TierBadge({ tier }: { tier: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 6,
      fontSize: 10, fontWeight: 600,
      color: 'var(--ink-2, #8A919B)', background: 'var(--bg-2, #111418)', border: '1px solid var(--line, #1E242B)',
    }}>
      {tier}
    </span>
  );
}
