"use client";

import React, { useState, useEffect, useRef } from "react";
import type { PlaygroundData, PlaygroundSessionEvent } from "./usePlaygroundData";
import { AgentAvatar, StatusIndicator, TierBadge } from "./primitives";
import { Icons, KIND_META } from "./icons";
import { DIFF_LINES, FILE_TREE } from "./data";

export function SessionView({ data }: { data: PlaygroundData }) {
  const { sessionEvents, activeSessionAgent, sessions } = data;
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<number>(0);
  const eventsRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset cursor when session events change
  useEffect(() => {
    setCursor(0);
    setSelectedEvent(0);
    setPlaying(false);
  }, [sessionEvents]);

  // Playback
  useEffect(() => {
    if (playing && cursor < sessionEvents.length - 1) {
      intervalRef.current = setInterval(() => {
        setCursor(prev => {
          const next = prev + 1;
          setSelectedEvent(next);
          if (next >= sessionEvents.length - 1) {
            setPlaying(false);
          }
          return next;
        });
      }, 800);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, cursor, sessionEvents.length]);

  // Auto-scroll
  useEffect(() => {
    if (eventsRef.current) {
      const el = eventsRef.current.children[cursor] as HTMLElement;
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [cursor]);

  const visibleEvents = sessionEvents.slice(0, cursor + 1);
  const currentEvent = sessionEvents[selectedEvent];
  const progress = sessionEvents.length > 0 ? ((cursor + 1) / sessionEvents.length) * 100 : 0;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Left: Event stream */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, borderRight: '1px solid var(--border-1)' }}>
        {/* Session header */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--border-1)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          {activeSessionAgent && (
            <>
              <AgentAvatar agent={activeSessionAgent} size={28} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-0)' }}>{activeSessionAgent.handle}</span>
                  <TierBadge tier={activeSessionAgent.tier} />
                  <StatusIndicator status="active" showLabel={false} />
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                  {sessions[0]?.id?.slice(0, 8) || 'session'} · {sessionEvents.length} events
                </div>
              </div>
            </>
          )}
        </div>

        {/* Playback controls */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 18px', borderBottom: '1px solid var(--border-1)',
        }}>
          <button className="pg-btn" onClick={() => setPlaying(!playing)} style={{ padding: '4px 8px' }}>
            <span style={{ display: 'flex' }}>{playing ? Icons.pause : Icons.play}</span>
          </button>
          <button className="pg-btn" onClick={() => { setCursor(Math.min(cursor + 1, sessionEvents.length - 1)); setSelectedEvent(Math.min(cursor + 1, sessionEvents.length - 1)); }} style={{ padding: '4px 8px' }}>
            <span style={{ display: 'flex' }}>{Icons.skipForward}</span>
          </button>
          <div style={{ flex: 1, height: 3, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s' }} />
          </div>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0 }}>
            {cursor + 1}/{sessionEvents.length}
          </span>
        </div>

        {/* Event list */}
        <div ref={eventsRef} style={{ flex: 1, overflow: 'auto' }}>
          {visibleEvents.map((ev, i) => {
            const meta = KIND_META[ev.kind] || KIND_META.read;
            const isSelected = i === selectedEvent;
            return (
              <div
                key={i}
                onClick={() => setSelectedEvent(i)}
                className="pg-slide-in"
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 18px',
                  background: isSelected ? 'var(--bg-2)' : 'transparent',
                  borderBottom: '1px solid var(--border-1)',
                  borderLeft: `2px solid ${isSelected ? meta.color : 'transparent'}`,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                <span className="mono" style={{ fontSize: 10, color: 'var(--text-4)', width: 62, flexShrink: 0, marginTop: 3 }}>
                  {ev.t}
                </span>
                <span style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 20, height: 20, borderRadius: 5,
                  background: meta.bg, color: meta.color, flexShrink: 0,
                }}>
                  {meta.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-0)', fontWeight: 500 }}>{ev.title}</span>
                    <span className="pg-badge" style={{ color: meta.color, background: meta.bg, fontSize: 9 }}>{meta.label}</span>
                  </div>
                  {ev.detail && (
                    <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {ev.detail}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Inspector */}
      <div style={{ width: 380, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
        {/* Inspector header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-1)' }}>
          <span className="section-label">Inspector</span>
        </div>

        {/* File tree or diff based on event kind */}
        {currentEvent && (currentEvent.kind === 'edit' || currentEvent.kind === 'read') ? (
          <div style={{ flex: 1, overflow: 'auto' }}>
            {/* File path */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-1)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ display: 'flex', color: 'var(--text-3)' }}>{Icons.file}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-1)' }}>{currentEvent.title}</span>
            </div>
            {/* Diff */}
            {currentEvent.kind === 'edit' && (
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.7 }}>
                {DIFF_LINES.map((line, i) => (
                  <div key={i} style={{
                    padding: '0 16px',
                    background: line.k === 'add' ? 'rgba(34, 197, 94, 0.06)' : line.k === 'del' ? 'rgba(239, 68, 68, 0.06)' : 'transparent',
                    color: line.k === 'add' ? 'var(--green)' : line.k === 'del' ? 'var(--red)' : 'var(--text-2)',
                    borderLeft: `2px solid ${line.k === 'add' ? 'var(--green)' : line.k === 'del' ? 'var(--red)' : 'transparent'}`,
                  }}>
                    <span style={{ display: 'inline-block', width: 28, color: 'var(--text-4)' }}>{line.n}</span>
                    <span style={{ color: 'var(--text-4)' }}>{line.k === 'add' ? '+ ' : line.k === 'del' ? '- ' : '  '}</span>
                    {line.text}
                  </div>
                ))}
              </div>
            )}
            {/* File read — show file tree */}
            {currentEvent.kind === 'read' && (
              <div style={{ padding: '8px 0' }}>
                {FILE_TREE.map((f, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '3px 16px',
                    paddingLeft: 16 + f.depth * 14,
                    background: f.active ? 'var(--bg-2)' : 'transparent',
                  }}>
                    <span style={{ display: 'flex', color: f.kind === 'dir' ? 'var(--accent)' : 'var(--text-3)' }}>
                      {f.kind === 'dir' ? Icons.folder : Icons.file}
                    </span>
                    <span style={{ fontSize: 12, color: f.active ? 'var(--text-0)' : f.changed ? 'var(--amber)' : 'var(--text-2)' }}>
                      {f.name}
                    </span>
                    {f.size && <span className="mono" style={{ fontSize: 10, color: 'var(--text-4)', marginLeft: 'auto' }}>{f.size}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : currentEvent ? (
          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            <div className="pg-card" style={{ padding: 16 }}>
              <div className="section-label" style={{ marginBottom: 8 }}>Event detail</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-0)', marginBottom: 8 }}>{currentEvent.title}</div>
              {currentEvent.detail && (
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {currentEvent.detail}
                </div>
              )}
            </div>
            {/* Agent info */}
            {activeSessionAgent && (
              <div className="pg-card" style={{ padding: 16, marginTop: 12 }}>
                <div className="section-label" style={{ marginBottom: 8 }}>Agent</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AgentAvatar agent={activeSessionAgent} size={32} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-0)' }}>{activeSessionAgent.handle}</div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{activeSessionAgent.caps.join(' · ')}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-4)', fontSize: 13 }}>
            Select an event to inspect
          </div>
        )}
      </div>
    </div>
  );
}
