"use client";

import React, { useState } from "react";
import "./tokens.css";
import { useObservatoryData, type EventCategory } from "./usePlaygroundData";
import { CommandBar } from "./CommandBar";
import { EventRiver } from "./EventRiver";
import { Inspector } from "./Inspector";

export function Playground() {
  const data = useObservatoryData();
  const [filters, setFilters] = useState<EventCategory[]>([]);

  const toggleFilter = (cat: EventCategory) => {
    setFilters(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const filteredEvents = filters.length === 0
    ? data.events
    : data.events.filter(e => filters.includes(e.category));

  return (
    <div className="observatory" style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflow: 'hidden',
    }}>
      {/* Command Bar */}
      <CommandBar
        data={data}
        filters={filters}
        onToggleFilter={toggleFilter}
      />

      {/* Main content: Feed + Inspector */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Event River (center) */}
        <EventRiver
          events={filteredEvents}
          agents={data.agents}
          selectedEvent={data.selectedEvent}
          onSelectEvent={data.selectEvent}
          isLive={data.isLive}
          loading={data.loading}
        />

        {/* Inspector (right) */}
        <Inspector
          event={data.selectedEvent}
          agents={data.agents}
          sessions={data.sessions}
          sessionEvents={data.sessionEvents}
          activeAgent={data.activeAgent}
          prs={data.prs}
          projects={data.projects}
        />
      </div>
    </div>
  );
}
