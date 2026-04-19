"use client";

import React from "react";
import { Agent, TIER_RANK } from "./data";

export const AgentMark = ({ agent, size = 22 }: { agent: Agent; size?: number }) => {
  const hue = agent.color;
  const initials = agent.handle.slice(0, 2).toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `oklch(0.28 0.05 ${hue})`,
        border: `1px solid oklch(0.42 0.09 ${hue} / 0.5)`,
        color: `oklch(0.90 0.06 ${hue})`,
        fontFamily: 'var(--font-mono)',
        fontSize: Math.round(size * 0.36),
        fontWeight: 600,
        letterSpacing: '-0.02em',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
};

export const TierBadge = ({ tier }: { tier: string }) => {
  const rank = TIER_RANK[tier] ?? 0;
  return (
    <span
      className="mono"
      style={{
        fontSize: 10,
        letterSpacing: '0.08em',
        color: 'var(--fg-2)',
        padding: '2px 6px',
        border: '1px solid var(--line-2)',
        borderRadius: 3,
        textTransform: 'uppercase',
      }}
    >
      <span style={{ color: 'var(--fg-3)' }}>t{rank}&middot;</span>
      {tier.toLowerCase()}
    </span>
  );
};

export const StatusDot = ({ status }: { status: string }) => {
  const map: Record<string, { c: string; label: string }> = {
    active: { c: 'var(--ok)', label: 'active' },
    idle: { c: 'var(--fg-3)', label: 'idle' },
    review: { c: 'var(--warn)', label: 'review' },
    pass: { c: 'var(--ok)', label: 'pass' },
    fail: { c: 'var(--err)', label: 'fail' },
    pending: { c: 'var(--fg-3)', label: 'pending' },
  };
  const s = map[status] || map.idle;
  const pulse = status === 'active';
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        className={`pg-dot${pulse ? ' pg-dot-pulse' : ''}`}
        style={{ background: s.c, color: s.c }}
      />
      <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-2)', letterSpacing: '0.04em' }}>
        {s.label}
      </span>
    </span>
  );
};

export const IconBtn = ({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  title?: string;
}) => (
  <button
    title={title}
    onClick={onClick}
    className="pg-t"
    style={{
      width: 28,
      height: 28,
      background: active ? 'var(--ink-3)' : 'transparent',
      border: `1px solid ${active ? 'var(--line-2)' : 'transparent'}`,
      borderRadius: 6,
      color: active ? 'var(--fg-0)' : 'var(--fg-2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      cursor: 'pointer',
    }}
  >
    {children}
  </button>
);
