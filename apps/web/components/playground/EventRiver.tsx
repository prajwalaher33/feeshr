"use client";

import React, { useRef, useEffect, useMemo } from "react";
import type { ObsAgent, ObsEvent } from "./usePlaygroundData";
import { EventCard } from "./EventCard";

interface EventRiverProps {
  events: ObsEvent[];
  agents: ObsAgent[];
  selectedEvent: ObsEvent | null;
  onSelectEvent: (event: ObsEvent | null) => void;
  isLive: boolean;
  loading: boolean;
  focusedIdx: number;
}

// Group consecutive events from same agent+target within 60s-equivalent
interface EventGroup {
  id: string;
  events: ObsEvent[];
  agentId: string;
  target: string;
  collapsed: boolean;
}

function groupEvents(events: ObsEvent[]): (ObsEvent | EventGroup)[] {
  if (events.length === 0) return [];

  const result: (ObsEvent | EventGroup)[] = [];
  let currentGroup: ObsEvent[] = [];

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const prev = currentGroup[currentGroup.length - 1];

    // Group if same agent AND (same target OR same category) AND consecutive
    const shouldGroup = prev &&
      prev.agentId === ev.agentId &&
      (prev.target === ev.target || prev.category === ev.category) &&
      prev.target !== "" &&
      currentGroup.length < 4;

    if (shouldGroup) {
      currentGroup.push(ev);
    } else {
      // Flush previous group
      if (currentGroup.length > 1) {
        result.push({
          id: `group-${currentGroup[0].id}`,
          events: currentGroup,
          agentId: currentGroup[0].agentId,
          target: currentGroup[0].target,
          collapsed: true,
        });
      } else if (currentGroup.length === 1) {
        result.push(currentGroup[0]);
      }
      currentGroup = [ev];
    }
  }
  // Flush remaining
  if (currentGroup.length > 1) {
    result.push({
      id: `group-${currentGroup[0].id}`,
      events: currentGroup,
      agentId: currentGroup[0].agentId,
      target: currentGroup[0].target,
      collapsed: true,
    });
  } else if (currentGroup.length === 1) {
    result.push(currentGroup[0]);
  }

  return result;
}

// Insert time rulers between events that have different time buckets
function getTimeBucket(ts: string): string {
  if (ts.endsWith('s')) return "Just now";
  const num = parseInt(ts);
  if (ts.endsWith('m')) {
    if (num <= 5) return "Last 5 min";
    if (num <= 15) return "Last 15 min";
    if (num <= 60) return "Last hour";
    return "Earlier";
  }
  if (ts.endsWith('h')) return num <= 1 ? "Last hour" : "Earlier today";
  if (ts.endsWith('d')) return "Earlier";
  return "Just now";
}

function isGroup(item: ObsEvent | EventGroup): item is EventGroup {
  return 'events' in item;
}

export function EventRiver({ events, agents, selectedEvent, onSelectEvent, isLive, loading, focusedIdx }: EventRiverProps) {
  const getAgent = (id: string) => agents.find(a => a.id === id) || agents[0];
  const listRef = useRef<HTMLDivElement>(null);

  // Group events
  const grouped = useMemo(() => groupEvents(events), [events]);

  // Build display items with time rulers
  const displayItems = useMemo(() => {
    const items: { type: "event" | "group" | "ruler"; data: ObsEvent | EventGroup | string; flatIdx: number }[] = [];
    let lastBucket = "";
    let flatIdx = 0;

    for (const item of grouped) {
      const ts = isGroup(item) ? item.events[0].timestamp : item.timestamp;
      const bucket = getTimeBucket(ts);

      if (bucket !== lastBucket) {
        items.push({ type: "ruler", data: bucket, flatIdx: -1 });
        lastBucket = bucket;
      }

      if (isGroup(item)) {
        items.push({ type: "group", data: item, flatIdx });
        flatIdx += item.events.length;
      } else {
        items.push({ type: "event", data: item, flatIdx });
        flatIdx++;
      }
    }
    return items;
  }, [grouped]);

  // Auto-scroll focused item into view
  useEffect(() => {
    if (focusedIdx < 0 || !listRef.current) return;
    // Find the DOM element corresponding to focused event
    const items = listRef.current.querySelectorAll('[data-event-idx]');
    for (const el of items) {
      const idx = parseInt(el.getAttribute('data-event-idx') || '-1');
      if (idx === focusedIdx) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        break;
      }
    }
  }, [focusedIdx]);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isLive && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="o-live-dot" style={{ width: 5, height: 5 }} />
              <span className="o-mono" style={{ fontSize: 10, color: 'var(--o-live)' }}>Following</span>
            </span>
          )}
          <span className="o-mono" style={{ fontSize: 9, color: 'var(--o-text-4)' }}>
            j/k navigate · enter select
          </span>
        </div>
      </div>

      {/* Event list */}
      <div ref={listRef} style={{ flex: 1, overflow: 'auto', padding: '4px 12px 12px' }}>
        {events.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <span style={{ fontSize: 12, color: 'var(--o-text-4)' }}>No matching events</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {displayItems.map((item, displayIdx) => {
              if (item.type === "ruler") {
                return (
                  <div key={`ruler-${displayIdx}`} className="o-time-ruler">
                    {item.data as string}
                  </div>
                );
              }

              if (item.type === "group") {
                const group = item.data as EventGroup;
                return (
                  <GroupedCards
                    key={group.id}
                    group={group}
                    agents={agents}
                    getAgent={getAgent}
                    selectedEvent={selectedEvent}
                    onSelectEvent={onSelectEvent}
                    focusedIdx={focusedIdx}
                    baseIdx={item.flatIdx}
                  />
                );
              }

              const event = item.data as ObsEvent;
              return (
                <div key={event.id} data-event-idx={item.flatIdx}>
                  <EventCard
                    event={event}
                    agent={getAgent(event.agentId)}
                    selected={selectedEvent?.id === event.id}
                    focused={focusedIdx === item.flatIdx}
                    onClick={() => onSelectEvent(selectedEvent?.id === event.id ? null : event)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Grouped events display
function GroupedCards({ group, agents, getAgent, selectedEvent, onSelectEvent, focusedIdx, baseIdx }: {
  group: EventGroup;
  agents: ObsAgent[];
  getAgent: (id: string) => ObsAgent;
  selectedEvent: ObsEvent | null;
  onSelectEvent: (event: ObsEvent | null) => void;
  focusedIdx: number;
  baseIdx: number;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const agent = getAgent(group.agentId);

  if (!expanded) {
    // Show collapsed summary
    return (
      <div className="o-group" data-event-idx={baseIdx}>
        <div className="o-group-header" onClick={() => setExpanded(true)}>
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="var(--o-text-3)" strokeWidth="1.3">
            <path d="M2 3l2 2 2-2" />
          </svg>
          <span style={{ fontSize: 11, color: 'var(--o-text-2)' }}>
            <span style={{ fontWeight: 500, color: 'var(--o-text-0)' }}>{agent.handle}</span>
            {' · '}{group.events.length} events on{' '}
            <span style={{ fontWeight: 500, color: 'var(--o-text-0)' }}>{group.target || group.events[0].category}</span>
          </span>
          <span style={{ flex: 1 }} />
          <span className="o-mono" style={{ fontSize: 9, color: 'var(--o-text-4)' }}>
            {group.events[0].timestamp} – {group.events[group.events.length - 1].timestamp}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="o-group">
      <div className="o-group-header" onClick={() => setExpanded(false)}>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="var(--o-text-3)" strokeWidth="1.3">
          <path d="M2 5l2-2 2 2" />
        </svg>
        <span style={{ fontSize: 11, color: 'var(--o-text-2)' }}>
          <span style={{ fontWeight: 500, color: 'var(--o-text-0)' }}>{agent.handle}</span>
          {' · '}{group.events.length} events
        </span>
      </div>
      {group.events.map((event, i) => (
        <div key={event.id} data-event-idx={baseIdx + i}>
          <EventCard
            event={event}
            agent={getAgent(event.agentId)}
            selected={selectedEvent?.id === event.id}
            focused={focusedIdx === baseIdx + i}
            onClick={() => onSelectEvent(selectedEvent?.id === event.id ? null : event)}
          />
        </div>
      ))}
    </div>
  );
}
