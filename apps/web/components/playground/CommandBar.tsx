"use client";

import React from "react";
import type { ObservatoryData, EventCategory } from "./usePlaygroundData";
import { CATEGORY_STYLE, StatusDot } from "./primitives";

const FILTER_CATEGORIES: EventCategory[] = [
  "genesis", "run", "pr", "review", "merge", "failure", "claim", "decision",
];

interface CommandBarProps {
  data: ObservatoryData;
  filters: EventCategory[];
  onToggleFilter: (cat: EventCategory) => void;
}

export function CommandBar({ data, filters, onToggleFilter }: CommandBarProps) {
  const { stats, agents, prs, isLive, events } = data;

  const activeAgents = agents.filter(a => a.status === "active").length;
  const activeRuns = data.sessions.length;
  const openPRs = prs.filter(p => p.status === "open" || p.status === "reviewing").length;
  const mergesToday = stats?.prs_merged_today ?? prs.filter(p => p.status === "merged").length;
  const failures = events.filter(e => e.category === "failure").length;

  return (
    <header style={{
      display: 'flex', alignItems: 'center',
      height: 44, flexShrink: 0,
      padding: '0 16px',
      borderBottom: '1px solid var(--o-border)',
      background: 'var(--o-bg)',
      gap: 12,
    }}>
      {/* Identity + Live status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="o-display" style={{ fontSize: 13, color: 'var(--o-text-0)', letterSpacing: '-0.01em' }}>
          Observatory
        </span>
        {isLive ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 8px', background: 'var(--o-live-dim)', border: '1px solid var(--o-live-border)', borderRadius: 4 }}>
            <StatusDot status="active" pulse />
            <span className="o-mono" style={{ fontSize: 10, color: 'var(--o-live)', fontWeight: 500 }}>LIVE</span>
          </span>
        ) : (
          <span className="o-demo-banner">DEMO</span>
        )}
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 20, background: 'var(--o-border)' }} />

      {/* Stats strip */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span className="o-stat">
          <StatusDot status="active" />
          <span className="o-stat-value">{activeAgents}</span> agents
        </span>
        <span className="o-stat">
          <span className="o-stat-value">{activeRuns}</span> runs
        </span>
        <span className="o-stat">
          <span className="o-stat-value">{data.projects.length}</span> projects
        </span>
        <span className="o-stat">
          <span className="o-stat-value">{openPRs}</span> open PRs
        </span>
        <span className="o-stat">
          <span style={{ color: 'var(--o-success)' }} className="o-stat-value">{mergesToday}</span> merged
        </span>
        {failures > 0 && (
          <span className="o-stat">
            <span style={{ color: 'var(--o-error)' }} className="o-stat-value">{failures}</span> blocked
          </span>
        )}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {FILTER_CATEGORIES.map(cat => {
          const s = CATEGORY_STYLE[cat];
          const active = filters.includes(cat);
          return (
            <button
              key={cat}
              onClick={() => onToggleFilter(cat)}
              className={`o-filter${active ? ' o-filter-active' : ''}`}
              style={active ? { color: s.color, background: s.bg, borderColor: s.border } : {}}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Search placeholder */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', borderRadius: 5,
        background: 'var(--o-surface)', border: '1px solid var(--o-border)',
        width: 180,
      }}>
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="var(--o-text-4)" strokeWidth="1.3">
          <circle cx="6" cy="6" r="4" /><path d="M9 9l3 3" />
        </svg>
        <span style={{ fontSize: 11, color: 'var(--o-text-4)' }}>Search...</span>
        <span style={{ flex: 1 }} />
        <span className="o-mono" style={{ fontSize: 9, color: 'var(--o-text-4)', padding: '1px 4px', background: 'var(--o-raised)', borderRadius: 2 }}>⌘K</span>
      </div>
    </header>
  );
}
