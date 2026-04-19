"use client";

import React from "react";
import type { ObsAgent, EventCategory } from "./usePlaygroundData";

// ─── Agent Avatar ────────────────────────────────────────────────────────────

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
      fontFamily: 'var(--o-font-mono)',
      fontSize: Math.max(9, Math.round(size * 0.34)),
      fontWeight: 600,
      letterSpacing: '-0.02em',
      flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

// ─── Category Colors ─────────────────────────────────────────────────────────

export const CATEGORY_STYLE: Record<EventCategory, { color: string; bg: string; border: string; label: string }> = {
  genesis:  { color: 'var(--o-genesis)', bg: 'var(--o-genesis-dim)', border: 'var(--o-genesis-border)', label: 'Genesis' },
  run:      { color: 'var(--o-live)', bg: 'var(--o-live-dim)', border: 'var(--o-live-border)', label: 'Run' },
  pr:       { color: 'var(--o-live)', bg: 'var(--o-live-dim)', border: 'var(--o-live-border)', label: 'PR' },
  review:   { color: 'var(--o-warning)', bg: 'var(--o-warning-dim)', border: 'var(--o-warning-border)', label: 'Review' },
  merge:    { color: 'var(--o-success)', bg: 'var(--o-success-dim)', border: 'var(--o-success-border)', label: 'Merge' },
  failure:  { color: 'var(--o-error)', bg: 'var(--o-error-dim)', border: 'var(--o-error-border)', label: 'Failure' },
  claim:    { color: 'var(--o-live)', bg: 'var(--o-live-dim)', border: 'var(--o-live-border)', label: 'Claim' },
  decision: { color: 'var(--o-genesis)', bg: 'var(--o-genesis-dim)', border: 'var(--o-genesis-border)', label: 'Decision' },
  security: { color: 'var(--o-error)', bg: 'var(--o-error-dim)', border: 'var(--o-error-border)', label: 'Security' },
  publish:  { color: 'var(--o-success)', bg: 'var(--o-success-dim)', border: 'var(--o-success-border)', label: 'Publish' },
  other:    { color: 'var(--o-text-3)', bg: 'var(--o-surface)', border: 'var(--o-border)', label: 'Event' },
};

// ─── Category Badge ──────────────────────────────────────────────────────────

export function CategoryBadge({ category }: { category: EventCategory }) {
  const s = CATEGORY_STYLE[category];
  return (
    <span className="o-badge" style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  );
}

// ─── Status Indicator ────────────────────────────────────────────────────────

export function StatusDot({ status, pulse = false }: { status: "active" | "idle" | "review" | "success" | "error" | "warning"; pulse?: boolean }) {
  const colors: Record<string, string> = {
    active: 'var(--o-live)', success: 'var(--o-success)',
    warning: 'var(--o-warning)', error: 'var(--o-error)',
    review: 'var(--o-warning)', idle: 'var(--o-idle)',
  };
  const c = colors[status] || colors.idle;
  return (
    <span
      className={pulse ? 'o-live-dot' : undefined}
      style={{
        width: 6, height: 6, borderRadius: '50%',
        background: c, flexShrink: 0,
        ...(pulse ? {} : { boxShadow: 'none', animation: 'none' }),
      }}
    />
  );
}

// ─── Tier Badge ──────────────────────────────────────────────────────────────

export function TierBadge({ tier }: { tier: string }) {
  return (
    <span className="o-badge" style={{
      color: 'var(--o-text-2)', background: 'var(--o-raised)', border: '1px solid var(--o-border)',
    }}>
      {tier}
    </span>
  );
}
