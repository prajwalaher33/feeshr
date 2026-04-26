"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import "./tokens.css";
import { useObservatoryData, type EventCategory, type ObsEvent } from "./usePlaygroundData";
import { CommandBar } from "./CommandBar";
import { EventRiver } from "./EventRiver";
import { Inspector } from "./Inspector";
import { SearchModal } from "./SearchModal";
import { ScenarioDock } from "./ScenarioDock";
import { createSceneRunner, abortScene, type ScenarioDefinition, type SceneRun } from "@/lib/scenarioRunner";
import type { PlaygroundEvent } from "@feeshr/types";

export function Playground() {
  const data = useObservatoryData();
  const [filters, setFilters] = useState<EventCategory[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const prevEventsRef = useRef<ObsEvent[]>([]);
  const [activeRun, setActiveRun] = useState<SceneRun | null>(null);
  const activeRunRef = useRef<SceneRun | null>(null);

  const handleScenarioEvent = useCallback((event: PlaygroundEvent) => {
    data.injectEvent(event);
  }, [data.injectEvent]);

  const handleStartScenario = useCallback((scenario: ScenarioDefinition) => {
    if (activeRunRef.current?.status === "running") {
      abortScene(activeRunRef.current);
    }
    const run = createSceneRunner(scenario, handleScenarioEvent);
    activeRunRef.current = run;
    setActiveRun(run);

    const interval = setInterval(() => {
      if (run.status !== "running") {
        clearInterval(interval);
      }
      setActiveRun({ ...run });
    }, 500);
  }, [handleScenarioEvent]);

  const handleAbortScenario = useCallback(() => {
    if (activeRunRef.current) {
      abortScene(activeRunRef.current);
      setActiveRun({ ...activeRunRef.current });
      activeRunRef.current = null;
    }
  }, []);

  const toggleFilter = (cat: EventCategory) => {
    setFilters(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const filteredEvents = filters.length === 0
    ? data.events
    : data.events.filter(e => filters.includes(e.category));

  // ─── URL Deep Linking ────────────────────────────────────────────────────
  // Read event ID from URL hash on mount
  useEffect(() => {
    const hash = window.location.hash.slice(1); // remove #
    if (hash && data.events.length > 0) {
      const event = data.events.find(e => e.id === hash);
      if (event) {
        data.selectEvent(event);
        const idx = filteredEvents.findIndex(e => e.id === hash);
        if (idx >= 0) setFocusedIdx(idx);
      }
    }
  }, [data.events.length]);

  // Update URL when event is selected
  useEffect(() => {
    if (data.selectedEvent) {
      window.history.replaceState(null, "", `#${data.selectedEvent.id}`);
    } else {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [data.selectedEvent]);

  // ─── Sound Notification for Critical Events ──────────────────────────────
  useEffect(() => {
    if (prevEventsRef.current.length === 0) {
      prevEventsRef.current = data.events;
      return;
    }
    // Find new events that weren't in previous
    const prevIds = new Set(prevEventsRef.current.map(e => e.id));
    const newCritical = data.events.filter(
      e => !prevIds.has(e.id) && (e.category === "failure" || e.category === "security")
    );
    if (newCritical.length > 0) {
      // Play a subtle notification tone using Web Audio API
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = newCritical[0].category === "security" ? 440 : 330;
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } catch { /* AudioContext not available */ }
    }
    prevEventsRef.current = data.events;
  }, [data.events]);

  // ─── Keyboard Navigation ─────────────────────────────────────────────────
  const handleKey = useCallback((e: KeyboardEvent) => {
    // Don't capture when search modal or input is focused
    if (searchOpen) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    // Cmd+K / Ctrl+K → open search
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setSearchOpen(true);
      return;
    }

    // j/k → navigate events
    if (e.key === "j") {
      e.preventDefault();
      setFocusedIdx(prev => {
        const next = Math.min(prev + 1, filteredEvents.length - 1);
        return next;
      });
    }
    if (e.key === "k") {
      e.preventDefault();
      setFocusedIdx(prev => Math.max(prev - 1, 0));
    }

    // Enter → select focused event
    if (e.key === "Enter" && focusedIdx >= 0 && focusedIdx < filteredEvents.length) {
      e.preventDefault();
      const event = filteredEvents[focusedIdx];
      data.selectEvent(data.selectedEvent?.id === event.id ? null : event);
    }

    // Escape → deselect
    if (e.key === "Escape") {
      e.preventDefault();
      data.selectEvent(null);
      setFocusedIdx(-1);
    }
  }, [searchOpen, focusedIdx, filteredEvents, data.selectedEvent]);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  // Sync focused index when selecting via click
  const handleSelectEvent = useCallback((event: ObsEvent | null) => {
    data.selectEvent(event);
    if (event) {
      const idx = filteredEvents.findIndex(e => e.id === event.id);
      if (idx >= 0) setFocusedIdx(idx);
    }
  }, [filteredEvents, data.selectEvent]);

  return (
    <div className="observatory" style={{
      display: 'flex', flexDirection: 'column',
      minHeight: 'calc(100vh - 68px)', overflow: 'hidden',
    }}>
      {/* Command Bar */}
      <CommandBar
        data={data}
        filters={filters}
        onToggleFilter={toggleFilter}
        onOpenSearch={() => setSearchOpen(true)}
      />

      {/* Main content: Dock + Feed + Inspector */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Scenario Dock (left) */}
        <ScenarioDock
          activeRun={activeRun}
          onStart={handleStartScenario}
          onAbort={handleAbortScenario}
        />

        {/* Event River (center) */}
        <EventRiver
          events={filteredEvents}
          agents={data.agents}
          selectedEvent={data.selectedEvent}
          onSelectEvent={handleSelectEvent}
          isLive={data.isLive}
          loading={data.loading}
          focusedIdx={focusedIdx}
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

      {/* Search Modal */}
      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        agents={data.agents}
        events={data.events}
        prs={data.prs}
        projects={data.projects}
        onSelectEvent={(event) => {
          handleSelectEvent(event);
          setSearchOpen(false);
        }}
      />
    </div>
  );
}
