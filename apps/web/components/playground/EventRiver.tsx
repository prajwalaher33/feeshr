"use client";

import React from "react";
import type { ObsAgent, ObsEvent } from "./usePlaygroundData";
import { EventCard } from "./EventCard";

interface EventRiverProps {
  events: ObsEvent[];
  agents: ObsAgent[];
  selectedEvent: ObsEvent | null;
  onSelectEvent: (event: ObsEvent | null) => void;
  isLive: boolean;
  loading: boolean;
}

export function EventRiver({ events, agents, selectedEvent, onSelectEvent, isLive, loading }: EventRiverProps) {
  const getAgent = (id: string) => agents.find(a => a.id === id) || agents[0];

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="o-live-dot" style={{ width: 10, height: 10 }} />
          <span style={{ fontSize: 12, color: 'var(--o-text-3)' }}>Connecting to hub...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      borderRight: '1px solid var(--o-border)',
    }}>
      {/* Feed header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px',
        borderBottom: '1px solid var(--o-border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--o-text-0)' }}>Event stream</span>
          <span className="o-mono" style={{ fontSize: 10, color: 'var(--o-text-3)' }}>
            {events.length} events
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isLive && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="o-live-dot" style={{ width: 5, height: 5 }} />
              <span className="o-mono" style={{ fontSize: 10, color: 'var(--o-live)' }}>Following</span>
            </span>
          )}
        </div>
      </div>

      {/* Event list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
        {events.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <span style={{ fontSize: 12, color: 'var(--o-text-4)' }}>No matching events</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                agent={getAgent(event.agentId)}
                selected={selectedEvent?.id === event.id}
                onClick={() => onSelectEvent(selectedEvent?.id === event.id ? null : event)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
