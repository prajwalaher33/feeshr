"use client";

import React from "react";
import { Icons } from "./icons";

const NAV_ITEMS = [
  { id: 'mission', label: 'Mission Control', icon: Icons.mission, shortcut: '1' },
  { id: 'feed', label: 'Activity', icon: Icons.feed, shortcut: '2' },
  { id: 'agents', label: 'Agents', icon: Icons.agents, shortcut: '3' },
  { id: 'project', label: 'Projects', icon: Icons.project, shortcut: '4' },
  { id: 'pr', label: 'Reviews', icon: Icons.pr, shortcut: '5' },
];

const PINNED_SESSIONS = [
  { who: 'aurelius', what: 'pq-rotation', status: 'active' },
  { who: 'synthesis-04', what: 'inspector-ui', status: 'active' },
  { who: 'pelagic', what: 'db migration v2', status: 'idle' },
];

export function LeftNav({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  return (
    <div
      style={{
        width: 220,
        borderRight: '1px solid var(--line-1)',
        background: 'var(--ink-0)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Brand */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--line-1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent-line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 4h8M2 8h5" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>Feeshr</div>
              <div className="mono" style={{ fontSize: 9.5, color: 'var(--fg-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                operating engine
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding: '10px 8px', flex: 1, overflow: 'auto' }}>
        <div className="label" style={{ padding: '8px 10px 6px' }}>Workspace</div>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className="pg-t"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '7px 10px',
              background: active === item.id ? 'var(--ink-2)' : 'transparent',
              border: `1px solid ${active === item.id ? 'var(--line-2)' : 'transparent'}`,
              borderRadius: 6,
              color: active === item.id ? 'var(--fg-0)' : 'var(--fg-1)',
              fontSize: 13,
              textAlign: 'left',
              marginBottom: 1,
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: active === item.id ? 'var(--accent)' : 'var(--fg-3)' }}>
                {item.icon}
              </span>
              {item.label}
            </span>
            <span className="kbd">{item.shortcut}</span>
          </button>
        ))}

        <div className="label" style={{ padding: '22px 10px 6px' }}>Pinned sessions</div>
        {PINNED_SESSIONS.map((s, i) => (
          <button
            key={i}
            className="pg-t"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 10px',
              background: 'transparent',
              border: '1px solid transparent',
              borderRadius: 6,
              color: 'var(--fg-2)',
              fontSize: 12,
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <span
              className={`pg-dot${s.status === 'active' ? ' pg-dot-pulse' : ''}`}
              style={{
                background: s.status === 'active' ? 'var(--ok)' : 'var(--fg-4)',
                color: s.status === 'active' ? 'var(--ok)' : 'var(--fg-4)',
              }}
            />
            <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{s.who}</span>
            <span style={{ color: 'var(--fg-3)' }}>/</span>
            <span style={{ fontSize: 12, color: 'var(--fg-1)' }}>{s.what}</span>
          </button>
        ))}
      </div>

      {/* Bottom status rail */}
      <div
        style={{
          padding: '10px 14px',
          borderTop: '1px solid var(--line-1)',
          fontSize: 11,
          color: 'var(--fg-3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="pg-dot pg-dot-pulse" style={{ background: 'var(--ok)', color: 'var(--ok)' }} />
            <span className="mono" style={{ fontSize: 10.5, letterSpacing: '0.04em' }}>hub.alive &middot; 12ms</span>
          </span>
        </div>
        <div className="mono" style={{ marginTop: 6, fontSize: 10, letterSpacing: '0.04em' }}>
          8 agents &middot; 3 sessions &middot; 47 runs/hr
        </div>
      </div>
    </div>
  );
}
