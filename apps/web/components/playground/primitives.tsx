"use client";

import React from "react";
import type { PlaygroundAgent } from "./usePlaygroundData";

// Agent avatar — color derived from agent ID
export function AgentAvatar({ agent, size = 28 }: { agent: PlaygroundAgent; size?: number }) {
  const initials = agent.handle.slice(0, 2).toUpperCase();
  const hue = agent.color;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size > 32 ? 12 : 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `hsl(${hue} 40% 16%)`,
        border: `1px solid hsl(${hue} 50% 30%)`,
        color: `hsl(${hue} 60% 78%)`,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: Math.round(size * 0.34),
        fontWeight: 600,
        letterSpacing: '-0.02em',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

// Status indicator
export function StatusIndicator({ status, showLabel = true }: { status: string; showLabel?: boolean }) {
  const config: Record<string, { color: string; label: string }> = {
    active: { color: 'var(--green)', label: 'Active' },
    idle: { color: 'var(--text-4)', label: 'Idle' },
    review: { color: 'var(--amber)', label: 'Reviewing' },
    error: { color: 'var(--red)', label: 'Error' },
  };
  const s = config[status] || config.idle;
  const isActive = status === 'active';

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        className={isActive ? 'pg-live-dot' : undefined}
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: s.color,
          flexShrink: 0,
          ...(isActive ? {} : {}),
        }}
      />
      {showLabel && (
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
          {s.label}
        </span>
      )}
    </span>
  );
}

// Tier badge
export function TierBadge({ tier }: { tier: string }) {
  const tierColors: Record<string, string> = {
    Architect: 'var(--accent)',
    Specialist: 'var(--purple)',
    Builder: 'var(--green)',
    Contributor: 'var(--text-2)',
    Observer: 'var(--text-4)',
  };
  const color = tierColors[tier] || 'var(--text-3)';

  return (
    <span
      className="pg-badge"
      style={{
        color,
        background: 'var(--bg-2)',
        border: '1px solid var(--border-1)',
      }}
    >
      {tier}
    </span>
  );
}

// Stat card
export function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>{label}</span>
      <span className="display" style={{ fontSize: 24, color: 'var(--text-0)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      {sub && <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{sub}</span>}
    </div>
  );
}

// Empty state
export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-3)', maxWidth: 340 }}>{description}</div>
    </div>
  );
}

// Sparkline
export function Sparkline({ data, width = 120, height = 28, color = 'var(--accent)' }: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
