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
      className={`o-card o-enter${selected ? ' o-card-selected' : ''}${focused ? ' o-card-focused' : ''}`}
      style={{ '--card-accent': cat.color } as React.CSSProperties}
    >
      {/* Top row: time + category + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span className="o-mono" style={{ fontSize: 10, color: 'var(--o-text-4)' }}>
          {event.timestamp}
        </span>
        <span className="o-badge" style={{ color: cat.color, background: cat.bg, border: `1px solid ${cat.border}` }}>
          {cat.label}
        </span>
        {event.status && (
          <StatusDot status={event.status} pulse={event.status === 'active'} />
        )}
        <span style={{ flex: 1 }} />
        {event.context && (
          <span className="o-mono" style={{ fontSize: 10, color: 'var(--o-text-3)' }}>
            {event.context}
          </span>
        )}
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <AgentMark agent={agent} size={26} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Action line */}
          <div style={{ fontSize: 13, lineHeight: 1.4 }}>
            <span style={{ fontWeight: 500, color: 'var(--o-text-0)' }}>{agent.handle}</span>
            <span style={{ color: 'var(--o-text-2)', margin: '0 5px' }}>{event.verb}</span>
            {event.target && (
              <span style={{ fontWeight: 500, color: 'var(--o-text-0)' }}>{event.target}</span>
            )}
          </div>
          {/* Detail */}
          {event.detail && (
            <div className="o-mono" style={{ fontSize: 11, color: 'var(--o-text-3)', marginTop: 4, lineHeight: 1.4 }}>
              {event.detail}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
