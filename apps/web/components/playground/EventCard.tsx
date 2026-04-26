"use client";

import React from "react";
import type { ObsAgent, ObsEvent } from "./usePlaygroundData";
import { AgentMark, CATEGORY_STYLE, StatusDot } from "./primitives";

interface EventCardProps {
  event: ObsEvent;
  agent: ObsAgent;
  selected: boolean;
  focused?: boolean;
  onClick: () => void;
}

export function EventCard({ event, agent, selected, focused, onClick }: EventCardProps) {
  const cat = CATEGORY_STYLE[event.category];

  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 16px',
        borderRadius: 12,
        cursor: 'pointer',
        background: selected
          ? 'var(--bg-3, #171B20)'
          : focused
            ? 'var(--bg-2, #111418)'
            : 'transparent',
        border: selected
          ? '1px solid var(--line-strong, #2A3138)'
          : '1px solid transparent',
        transition: 'all 150ms ease',
      }}
    >
      {/* Top row: time + category + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{
          fontFamily: 'var(--font-mono, ui-monospace, monospace)',
          fontSize: 10, color: 'var(--ink-4, #3A4049)',
        }}>
          {event.timestamp}
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          padding: '2px 8px', borderRadius: 6,
          fontSize: 10, fontWeight: 600, letterSpacing: '0.02em',
          color: cat.color, background: cat.bg, border: `1px solid ${cat.border}`,
        }}>
          {cat.label}
        </span>
        {event.status && (
          <StatusDot status={event.status} pulse={event.status === 'active'} />
        )}
        <span style={{ flex: 1 }} />
        {event.context && (
          <span style={{
            fontFamily: 'var(--font-mono, ui-monospace, monospace)',
            fontSize: 10, color: 'var(--ink-3, #5A616B)',
          }}>
            {event.context}
          </span>
        )}
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <AgentMark agent={agent} size={26} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, lineHeight: 1.4 }}>
            <span style={{ fontWeight: 500, color: 'var(--ink-0, #F4F5F7)' }}>{agent.handle}</span>
            <span style={{ color: 'var(--ink-2, #8A919B)', margin: '0 5px' }}>{event.verb}</span>
            {event.target && (
              <span style={{ fontWeight: 500, color: 'var(--ink-0, #F4F5F7)' }}>{event.target}</span>
            )}
          </div>
          {event.detail && (
            <div style={{
              fontFamily: 'var(--font-mono, ui-monospace, monospace)',
              fontSize: 11, color: 'var(--ink-3, #5A616B)', marginTop: 4, lineHeight: 1.4,
            }}>
              {event.detail}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
