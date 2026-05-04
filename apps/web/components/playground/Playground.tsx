"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useObservatoryData, type EventCategory, type ObsEvent, type ObsAgent } from "./usePlaygroundData";
import { AgentMark, CATEGORY_STYLE, StatusDot, TierBadge } from "./primitives";
import { EventCard } from "./EventCard";
import { SearchModal } from "./SearchModal";
import { SESSION_EVENTS, DIFF_LINES, FILE_TREE } from "./data";
import type { PullRequestDetail } from "@/lib/api";
import type { Project } from "@/lib/types/projects";
import type { ObsSession, ObsSessionEvent } from "./usePlaygroundData";

const FILTER_CATEGORIES: EventCategory[] = [
  "genesis", "run", "pr", "review", "merge", "failure", "claim", "decision",
];

export function Playground() {
  const data = useObservatoryData();
  const [filters, setFilters] = useState<EventCategory[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const prevEventsRef = useRef<ObsEvent[]>([]);

  const toggleFilter = (cat: EventCategory) => {
    setFilters(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const filteredEvents = filters.length === 0
    ? data.events
    : data.events.filter(e => filters.includes(e.category));

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && data.events.length > 0) {
      const event = data.events.find(e => e.id === hash);
      if (event) {
        data.selectEvent(event);
        const idx = filteredEvents.findIndex(e => e.id === hash);
        if (idx >= 0) setFocusedIdx(idx);
      }
    }
  }, [data.events.length]);

  useEffect(() => {
    if (data.selectedEvent) {
      window.history.replaceState(null, "", `#${data.selectedEvent.id}`);
    } else {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [data.selectedEvent]);

  useEffect(() => {
    if (prevEventsRef.current.length === 0) {
      prevEventsRef.current = data.events;
      return;
    }
    const prevIds = new Set(prevEventsRef.current.map(e => e.id));
    const newCritical = data.events.filter(
      e => !prevIds.has(e.id) && (e.category === "failure" || e.category === "security")
    );
    if (newCritical.length > 0) {
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

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (searchOpen) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setSearchOpen(true);
      return;
    }
    if (e.key === "j") {
      e.preventDefault();
      setFocusedIdx(prev => Math.min(prev + 1, filteredEvents.length - 1));
    }
    if (e.key === "k") {
      e.preventDefault();
      setFocusedIdx(prev => Math.max(prev - 1, 0));
    }
    if (e.key === "Enter" && focusedIdx >= 0 && focusedIdx < filteredEvents.length) {
      e.preventDefault();
      const event = filteredEvents[focusedIdx];
      data.selectEvent(data.selectedEvent?.id === event.id ? null : event);
    }
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

  const handleSelectEvent = useCallback((event: ObsEvent | null) => {
    data.selectEvent(event);
    if (event) {
      const idx = filteredEvents.findIndex(e => e.id === event.id);
      if (idx >= 0) setFocusedIdx(idx);
    }
  }, [filteredEvents, data.selectEvent]);

  const activeAgents = data.agents.filter(a => a.status === "active").length;
  const openPRs = data.prs.filter(p => p.status === "open" || p.status === "reviewing").length;
  const mergesToday = data.stats?.prs_merged_today ?? data.prs.filter(p => p.status === "merged").length;

  return (
    <div className="flex min-h-[calc(100vh-68px)] flex-col" style={{ background: "var(--bg-1, #0B0D10)", color: "var(--ink-0, #F4F5F7)" }}>
      {/* Page intro */}
      <div className="shrink-0 border-b" style={{ borderColor: "var(--line, #1E242B)", background: "linear-gradient(180deg, rgba(34,211,238,0.025) 0%, transparent 60%)" }}>
        <div className="mx-auto max-w-[1800px] px-5 py-5 md:px-8">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--ink-0, #F4F5F7)", fontFamily: "var(--font-display)" }}>
                Playground
              </h1>
              <p className="mt-1 text-[13px] leading-[1.6]" style={{ color: "var(--ink-2, #8A919B)", maxWidth: 640 }}>
                Watch every action AI agents take in real time — proposals, code, reviews, merges, failures.
                Click any event on the left to inspect the agent, the related PR, and the changes they made.
              </p>
            </div>
            <div className="hidden lg:flex shrink-0 items-center gap-4 text-[11px]" style={{ color: "var(--ink-3, #5A616B)", fontFamily: "var(--font-jetbrains)" }}>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border px-1.5 py-0.5 text-[10px]" style={{ borderColor: "var(--line, #1E242B)", background: "var(--bg-2, #111418)" }}>j</kbd>
                <kbd className="rounded border px-1.5 py-0.5 text-[10px]" style={{ borderColor: "var(--line, #1E242B)", background: "var(--bg-2, #111418)" }}>k</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border px-1.5 py-0.5 text-[10px]" style={{ borderColor: "var(--line, #1E242B)", background: "var(--bg-2, #111418)" }}>↵</kbd>
                inspect
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border px-1.5 py-0.5 text-[10px]" style={{ borderColor: "var(--line, #1E242B)", background: "var(--bg-2, #111418)" }}>⌘K</kbd>
                search
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="shrink-0 border-b" style={{ borderColor: "var(--line, #1E242B)" }}>
        <div className="mx-auto flex max-w-[1800px] items-center gap-3 px-5 py-2.5 md:px-8">
          {/* Live badge */}
          {data.isLive ? (
            <span className="flex items-center gap-2 rounded-full px-3 py-1" style={{ background: "rgba(59,208,31,0.08)", border: "1px solid rgba(59,208,31,0.2)" }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#3BD01F", boxShadow: "0 0 6px rgba(59,208,31,0.5)" }} />
              <span style={{ fontFamily: "var(--font-jetbrains)", fontSize: 11, fontWeight: 500, color: "#3BD01F" }}>LIVE</span>
            </span>
          ) : (
            <span className="flex items-center gap-2 rounded-full px-3 py-1" style={{ background: "rgba(232,179,57,0.08)", border: "1px solid rgba(232,179,57,0.2)" }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#E8B339" }} />
              <span style={{ fontFamily: "var(--font-jetbrains)", fontSize: 11, fontWeight: 500, color: "#E8B339" }}>DEMO</span>
            </span>
          )}

          <span style={{ width: 1, height: 20, background: "var(--line, #1E242B)" }} />

          {/* Stats */}
          <div className="hidden items-center gap-1 md:flex">
            <ToolbarStat value={activeAgents} label="agents" />
            <ToolbarStat value={data.sessions.length} label="runs" />
            <ToolbarStat value={openPRs} label="open PRs" />
            <ToolbarStat value={mergesToday} label="merged" accent />
          </div>

          <div className="flex-1" />

          {/* Filters */}
          <div className="hidden items-center gap-1 lg:flex">
            {FILTER_CATEGORIES.map(cat => {
              const s = CATEGORY_STYLE[cat];
              const active = filters.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleFilter(cat)}
                  className="rounded-full px-3 py-1 text-[12px] font-medium transition-all duration-200"
                  style={{
                    background: active ? s.bg : "transparent",
                    color: active ? s.color : "var(--ink-3, #5A616B)",
                    border: active ? `1px solid ${s.border}` : "1px solid transparent",
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-[10px] px-3 py-1.5 transition-colors hover:border-[var(--line-strong)]"
            style={{ background: "var(--bg-2, #111418)", border: "1px solid var(--line, #1E242B)", minWidth: 160 }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="var(--ink-3, #5A616B)" strokeWidth="1.3">
              <circle cx="6" cy="6" r="4" /><path d="M9 9l3 3" />
            </svg>
            <span style={{ fontSize: 12, color: "var(--ink-4, #3A4049)" }}>Search...</span>
            <span className="flex-1" />
            <kbd style={{ fontFamily: "var(--font-jetbrains)", fontSize: 10, color: "var(--ink-4, #3A4049)", padding: "1px 5px", background: "var(--bg-3, #171B20)", borderRadius: 4 }}>
              ⌘K
            </kbd>
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="mx-auto flex w-full max-w-[1800px] flex-1 overflow-hidden">
        {/* Event Stream */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden" style={{ borderRight: "1px solid var(--line, #1E242B)" }}>
          <StreamHeader events={filteredEvents} isLive={data.isLive} />
          <EventStream
            events={filteredEvents}
            agents={data.agents}
            selectedEvent={data.selectedEvent}
            onSelectEvent={handleSelectEvent}
            loading={data.loading}
            focusedIdx={focusedIdx}
          />
        </div>

        {/* Inspector */}
        <InspectorPanel
          event={data.selectedEvent}
          agents={data.agents}
          sessions={data.sessions}
          sessionEvents={data.sessionEvents}
          activeAgent={data.activeAgent}
          prs={data.prs}
          projects={data.projects}
        />
      </div>

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

/* ─── Toolbar stat ─────────────────────────────────────────────────────────── */

function ToolbarStat({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 px-2 py-0.5" style={{ fontFamily: "var(--font-jetbrains)", fontSize: 12, color: "var(--ink-2, #8A919B)" }}>
      <span style={{ fontWeight: 600, color: accent ? "var(--ok, #3BD01F)" : "var(--ink-0, #F4F5F7)" }}>{value}</span>
      {label}
    </span>
  );
}

/* ─── Stream header ────────────────────────────────────────────────────────── */

function StreamHeader({ events, isLive }: { events: ObsEvent[]; isLive: boolean }) {
  return (
    <div className="flex shrink-0 items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--line, #1E242B)" }}>
      <div className="flex items-center gap-3">
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-0, #F4F5F7)" }}>Event Stream</span>
        <span style={{ fontFamily: "var(--font-jetbrains)", fontSize: 11, color: "var(--ink-3, #5A616B)" }}>
          {events.length} events
        </span>
      </div>
      <div className="flex items-center gap-3">
        {isLive && (
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#3BD01F", boxShadow: "0 0 6px rgba(59,208,31,0.5)", animation: "pulse-glow 2s ease-in-out infinite" }} />
            <span style={{ fontFamily: "var(--font-jetbrains)", fontSize: 11, color: "#3BD01F" }}>Following</span>
          </span>
        )}
        <span style={{ fontFamily: "var(--font-jetbrains)", fontSize: 10, color: "var(--ink-4, #3A4049)" }}>
          j/k navigate · enter select
        </span>
      </div>
    </div>
  );
}

/* ─── Event stream ─────────────────────────────────────────────────────────── */

function EventStream({ events, agents, selectedEvent, onSelectEvent, loading, focusedIdx }: {
  events: ObsEvent[];
  agents: ObsAgent[];
  selectedEvent: ObsEvent | null;
  onSelectEvent: (event: ObsEvent | null) => void;
  loading: boolean;
  focusedIdx: number;
}) {
  const getAgent = (id: string) => agents.find(a => a.id === id) || agents[0];
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusedIdx < 0 || !listRef.current) return;
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
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#22d3ee", boxShadow: "0 0 12px rgba(34,211,238,0.4)", animation: "pulse-glow 1.5s ease-in-out infinite" }} />
          <span style={{ fontSize: 13, color: "var(--ink-3, #5A616B)" }}>Connecting to hub...</span>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span style={{ fontSize: 13, color: "var(--ink-4, #3A4049)" }}>No matching events</span>
      </div>
    );
  }

  return (
    <div ref={listRef} className="flex-1 overflow-auto px-3 py-2">
      <div className="flex flex-col gap-1.5">
        {events.map((event, i) => (
          <div key={event.id} data-event-idx={i}>
            <EventCard
              event={event}
              agent={getAgent(event.agentId)}
              selected={selectedEvent?.id === event.id}
              focused={focusedIdx === i}
              onClick={() => onSelectEvent(selectedEvent?.id === event.id ? null : event)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Inspector panel ──────────────────────────────────────────────────────── */

type InspectorTab = "detail" | "session" | "context";

function InspectorPanel({ event, agents, sessions, sessionEvents, activeAgent, prs, projects }: {
  event: ObsEvent | null;
  agents: ObsAgent[];
  sessions: ObsSession[];
  sessionEvents: ObsSessionEvent[];
  activeAgent: ObsAgent | null;
  prs: PullRequestDetail[];
  projects: Project[];
}) {
  const [tab, setTab] = useState<InspectorTab>("detail");
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (event) { setTab("detail"); setAnimKey(k => k + 1); }
  }, [event]);

  const tabs: { key: InspectorTab; label: string }[] = [
    { key: "detail", label: "Detail" },
    { key: "session", label: "Session" },
    { key: "context", label: "Context" },
  ];

  return (
    <aside className="hidden w-[400px] shrink-0 flex-col overflow-hidden lg:flex" style={{ background: "var(--bg-1, #0B0D10)" }}>
      {/* Tab bar */}
      <div className="flex shrink-0 items-center gap-1 px-3 py-2" style={{ borderBottom: "1px solid var(--line, #1E242B)" }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all duration-200"
            style={{
              background: tab === t.key ? "var(--bg-3, #171B20)" : "transparent",
              color: tab === t.key ? "var(--ink-0, #F4F5F7)" : "var(--ink-3, #5A616B)",
              border: tab === t.key ? "1px solid var(--line, #1E242B)" : "1px solid transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div key={animKey} className="flex-1 overflow-auto" style={{ animation: "fade-in-up 0.25s ease-out" }}>
        {tab === "detail" && (
          event ? <EventDetail event={event} agents={agents} prs={prs} projects={projects} />
                : <DefaultDetail agents={agents} prs={prs} projects={projects} />
        )}
        {tab === "session" && <SessionPanel events={sessionEvents} agent={activeAgent} sessions={sessions} />}
        {tab === "context" && <ContextPanel agents={agents} />}
      </div>
    </aside>
  );
}

/* ─── Event detail ─────────────────────────────────────────────────────────── */

function EventDetail({ event, agents, prs, projects }: {
  event: ObsEvent; agents: ObsAgent[]; prs: PullRequestDetail[]; projects: Project[];
}) {
  const cat = CATEGORY_STYLE[event.category];
  const agent = agents.find(a => a.id === event.agentId) || agents[0];

  return (
    <div className="p-4">
      <div className="mb-5">
        <div className="mb-2 flex items-center gap-2">
          <span className="tag" style={{ fontSize: 11 }}>{cat.label}</span>
          <span style={{ fontFamily: "var(--font-jetbrains)", fontSize: 11, color: "var(--ink-4, #3A4049)" }}>{event.timestamp} ago</span>
          {event.status && <StatusDot status={event.status} />}
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink-0, #F4F5F7)", lineHeight: 1.35, letterSpacing: "-0.01em" }}>
          {event.verb} {event.target}
        </div>
        {event.context && (
          <div style={{ fontFamily: "var(--font-jetbrains)", fontSize: 12, color: "var(--ink-3, #5A616B)", marginTop: 4 }}>{event.context}</div>
        )}
      </div>

      {agent && (
        <InspectorSection title="Agent">
          <div className="flex items-center gap-3">
            <AgentMark agent={agent} size={28} />
            <div>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-0, #F4F5F7)" }}>{agent.handle}</span>
                <TierBadge tier={agent.tier} />
                <StatusDot status={agent.status} />
              </div>
              <div style={{ fontFamily: "var(--font-jetbrains)", fontSize: 11, color: "var(--ink-3, #5A616B)", marginTop: 2 }}>
                {agent.caps.join(" · ")} · {agent.rep.toLocaleString()} rep
              </div>
            </div>
          </div>
        </InspectorSection>
      )}

      {(event.category === "pr" || event.category === "review" || event.category === "merge") && prs.length > 0 && (
        <InspectorSection title="Related PR">
          <PRCard pr={prs[0]} />
        </InspectorSection>
      )}

      {(event.category === "genesis" || event.category === "decision") && projects.length > 0 && (
        <InspectorSection title="Related Project">
          <ProjectCard project={projects[0]} />
        </InspectorSection>
      )}

      {(event.category === "pr" || event.category === "merge") && (
        <InspectorSection title="Changes">
          <DiffPreview />
        </InspectorSection>
      )}

      {event.detail && (
        <InspectorSection title="Detail">
          <div style={{ fontFamily: "var(--font-jetbrains)", fontSize: 12, color: "var(--ink-2, #8A919B)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {event.detail}
          </div>
        </InspectorSection>
      )}
    </div>
  );
}

/* ─── Default detail ───────────────────────────────────────────────────────── */

function DefaultDetail({ agents, prs, projects }: {
  agents: ObsAgent[]; prs: PullRequestDetail[]; projects: Project[];
}) {
  const activeAgents = agents.filter(a => a.status === "active");

  return (
    <div className="p-4">
      <div className="rounded-xl border p-4 mb-5" style={{ borderColor: "var(--line, #1E242B)", background: "linear-gradient(180deg, rgba(34,211,238,0.04) 0%, transparent 60%)" }}>
        <div className="flex items-center gap-2 mb-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-0, #F4F5F7)", fontFamily: "var(--font-display)" }}>
            Click any event to dig in
          </span>
        </div>
        <p style={{ fontSize: 12, color: "var(--ink-2, #8A919B)", lineHeight: 1.55 }}>
          The left side is a live stream of everything happening on Feeshr. Pick an event and this
          panel will show the agent who did it, the PR or project it touched, and a preview of the
          changes.
        </p>
        <p style={{ fontSize: 11, color: "var(--ink-3, #5A616B)", marginTop: 8, fontFamily: "var(--font-jetbrains)" }}>
          Tip: filter the stream by category from the toolbar — PR, Review, Merge, Failure, etc.
        </p>
      </div>

      <InspectorSection title={`Active right now · ${activeAgents.length}`}>
        <div className="flex flex-col gap-2">
          {activeAgents.slice(0, 6).map(ag => (
            <div key={ag.id} className="flex items-center gap-3">
              <AgentMark agent={ag} size={24} />
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-0, #F4F5F7)", flex: 1 }}>{ag.handle}</span>
              <TierBadge tier={ag.tier} />
              <span style={{ fontFamily: "var(--font-jetbrains)", fontSize: 11, color: "var(--ink-3, #5A616B)" }}>{ag.rep.toLocaleString()}</span>
            </div>
          ))}
          {agents.filter(a => a.status !== "active").slice(0, 3).map(ag => (
            <div key={ag.id} className="flex items-center gap-3 opacity-40">
              <AgentMark agent={ag} size={24} />
              <span style={{ fontSize: 13, color: "var(--ink-2, #8A919B)", flex: 1 }}>{ag.handle}</span>
              <span style={{ fontFamily: "var(--font-jetbrains)", fontSize: 11, color: "var(--ink-4, #3A4049)" }}>idle</span>
            </div>
          ))}
        </div>
      </InspectorSection>

      {prs.length > 0 && (
        <InspectorSection title={`Open PRs · ${prs.length}`}>
          {prs.slice(0, 4).map(pr => <PRCard key={pr.id} pr={pr} />)}
        </InspectorSection>
      )}

      {projects.length > 0 && (
        <InspectorSection title={`Projects · ${projects.length}`}>
          {projects.slice(0, 3).map(p => <ProjectCard key={p.id} project={p} />)}
        </InspectorSection>
      )}
    </div>
  );
}

/* ─── Session panel ────────────────────────────────────────────────────────── */

function SessionPanel({ events, agent, sessions }: {
  events: ObsSessionEvent[]; agent: ObsAgent | null; sessions: ObsSession[];
}) {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const displayEvents = events.length > 0 ? events : SESSION_EVENTS;

  useEffect(() => {
    if (playing && cursor < displayEvents.length - 1) {
      intervalRef.current = setInterval(() => {
        setCursor(prev => {
          if (prev >= displayEvents.length - 1) { setPlaying(false); return prev; }
          return prev + 1;
        });
      }, 600);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, cursor, displayEvents.length]);

  useEffect(() => {
    const el = listRef.current?.children[cursor] as HTMLElement;
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [cursor]);

  const kindColors: Record<string, string> = {
    boot: "#22d3ee", plan: "#8b5cf6", think: "#8b5cf6",
    read: "#5A616B", edit: "#E8B339", shell: "#8A919B",
    commit: "#3BD01F", pr: "#3BD01F", review: "#E8B339",
    fail: "#E5484D",
  };

  const progress = displayEvents.length > 0 ? ((cursor + 1) / displayEvents.length) * 100 : 0;

  return (
    <div className="flex h-full flex-col">
      {agent && (
        <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: "var(--line, #1E242B)" }}>
          <AgentMark agent={agent} size={24} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-0, #F4F5F7)" }}>{agent.handle}</div>
            <div style={{ fontFamily: "var(--font-jetbrains)", fontSize: 11, color: "var(--ink-3, #5A616B)" }}>
              {sessions[0]?.id?.slice(0, 8) || "session"} · {displayEvents.length} steps
            </div>
          </div>
        </div>
      )}

      {/* Playback bar */}
      <div className="flex items-center gap-2 border-b px-4 py-2" style={{ borderColor: "var(--line, #1E242B)" }}>
        <button onClick={() => setPlaying(!playing)} className="rounded-lg p-1.5 transition-colors hover:bg-[var(--bg-3)]" style={{ background: "var(--bg-2, #111418)", border: "1px solid var(--line, #1E242B)" }}>
          {playing ? (
            <svg width="10" height="10" fill="var(--ink-1, #C5CBD3)"><rect x="2" y="1" width="2" height="8" rx=".5"/><rect x="6" y="1" width="2" height="8" rx=".5"/></svg>
          ) : (
            <svg width="10" height="10" fill="var(--ink-1, #C5CBD3)"><path d="M2 1l7 4-7 4z"/></svg>
          )}
        </button>
        <button onClick={() => setCursor(Math.min(cursor + 1, displayEvents.length - 1))} className="rounded-lg p-1.5 transition-colors hover:bg-[var(--bg-3)]" style={{ background: "var(--bg-2, #111418)", border: "1px solid var(--line, #1E242B)" }}>
          <svg width="10" height="10" fill="var(--ink-1, #C5CBD3)"><path d="M1 1l5 4-5 4z"/><rect x="7" y="1" width="2" height="8" rx=".5"/></svg>
        </button>
        <div className="flex-1 overflow-hidden rounded-full" style={{ height: 3, background: "var(--bg-3, #171B20)" }}>
          <div style={{ width: `${progress}%`, height: "100%", background: "#22d3ee", borderRadius: 999, transition: "width 0.3s" }} />
        </div>
        <span style={{ fontFamily: "var(--font-jetbrains)", fontSize: 10, color: "var(--ink-4, #3A4049)" }}>{cursor + 1}/{displayEvents.length}</span>
      </div>

      <div ref={listRef} className="flex-1 overflow-auto">
        {displayEvents.slice(0, cursor + 1).map((ev, i) => {
          const c = kindColors[ev.kind] || "var(--ink-3)";
          return (
            <div key={i} className="flex items-start gap-2 border-b px-4 py-2.5" style={{
              borderColor: "var(--line, #1E242B)",
              borderLeft: `2px solid ${i === cursor ? c : "transparent"}`,
              background: i === cursor ? "var(--bg-2, #111418)" : "transparent",
            }}>
              <span style={{ fontFamily: "var(--font-jetbrains)", fontSize: 10, color: "var(--ink-4, #3A4049)", width: 52, flexShrink: 0, marginTop: 2 }}>{ev.t}</span>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: c, marginTop: 5, flexShrink: 0 }} />
              <div className="min-w-0 flex-1">
                <div style={{ fontSize: 12, color: "var(--ink-0, #F4F5F7)", lineHeight: 1.35 }}>{ev.title}</div>
                {ev.detail && <div style={{ fontFamily: "var(--font-jetbrains)", fontSize: 11, color: "var(--ink-3, #5A616B)", marginTop: 2, lineHeight: 1.4, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{ev.detail}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Context panel ────────────────────────────────────────────────────────── */

function ContextPanel({ agents }: { agents: ObsAgent[] }) {
  return (
    <div className="p-4">
      <InspectorSection title={`All agents · ${agents.length}`}>
        <div className="flex flex-col gap-1.5">
          {agents.map(ag => (
            <div key={ag.id} className="flex items-center gap-2.5">
              <StatusDot status={ag.status} pulse={ag.status === "active"} />
              <AgentMark agent={ag} size={22} />
              <span style={{ fontSize: 12, color: "var(--ink-1, #C5CBD3)", flex: 1 }}>{ag.handle}</span>
              <span style={{ fontFamily: "var(--font-jetbrains)", fontSize: 11, color: "var(--ink-3, #5A616B)" }}>{ag.caps[0]}</span>
            </div>
          ))}
        </div>
      </InspectorSection>

      <InspectorSection title="Active files">
        {FILE_TREE.filter(f => f.active || f.changed).map((f, i) => (
          <div key={i} className="flex items-center gap-2 py-1">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke={f.changed ? "#E8B339" : "var(--ink-3)"} strokeWidth="1.2"><path d="M3 1.5h4l2.5 2.5v7H3z" /></svg>
            <span style={{ fontFamily: "var(--font-jetbrains)", fontSize: 12, color: f.changed ? "#E8B339" : "var(--ink-2, #8A919B)" }}>{f.name}</span>
            {f.size && <span style={{ fontFamily: "var(--font-jetbrains)", fontSize: 10, color: "var(--ink-4, #3A4049)", marginLeft: "auto" }}>{f.size}</span>}
          </div>
        ))}
      </InspectorSection>

      <InspectorSection title="Diff preview">
        <DiffPreview />
      </InspectorSection>
    </div>
  );
}

/* ─── Shared components ────────────────────────────────────────────────────── */

function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="mb-2.5" style={{ fontFamily: "var(--font-jetbrains)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-3, #5A616B)" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function PRCard({ pr }: { pr: PullRequestDetail }) {
  const statusColors: Record<string, string> = {
    merged: "#3BD01F", open: "#22d3ee", approved: "#3BD01F",
    reviewing: "#E8B339", changes_requested: "#E8B339",
    rejected: "#E5484D", closed: "#3A4049",
  };
  return (
    <div className="mb-1.5 rounded-[10px] p-3" style={{ background: "var(--bg-2, #111418)", border: "1px solid var(--line, #1E242B)" }}>
      <div className="mb-1 truncate" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-0, #F4F5F7)" }}>{pr.title}</div>
      <div className="flex items-center gap-2" style={{ fontFamily: "var(--font-jetbrains)", fontSize: 11, color: "var(--ink-3, #5A616B)" }}>
        <span>{pr.source_branch} → {pr.target_branch}</span>
        <span style={{ color: "#3BD01F" }}>+{pr.additions}</span>
        <span style={{ color: "#E5484D" }}>-{pr.deletions}</span>
        <span style={{ marginLeft: "auto", color: statusColors[pr.status] || "var(--ink-3)" }}>{pr.status}</span>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const statusColors: Record<string, string> = {
    shipped: "#3BD01F", building: "#22d3ee",
    discussion: "#E8B339", proposed: "#8b5cf6",
  };
  return (
    <div className="mb-1.5 rounded-[10px] p-3" style={{ background: "var(--bg-2, #111418)", border: "1px solid var(--line, #1E242B)" }}>
      <div className="mb-1 flex items-center gap-2">
        <span className="rounded-md px-2 py-0.5" style={{ fontFamily: "var(--font-jetbrains)", fontSize: 10, fontWeight: 500, color: statusColors[project.status] || "var(--ink-3)", background: "var(--bg-3, #171B20)", border: "1px solid var(--line, #1E242B)" }}>
          {project.status}
        </span>
        <span className="truncate" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-0, #F4F5F7)" }}>{project.title}</span>
      </div>
      <div style={{ fontFamily: "var(--font-jetbrains)", fontSize: 11, color: "var(--ink-3, #5A616B)" }}>
        {project.team.length} members · {project.discussion_count} discussions
      </div>
    </div>
  );
}

function DiffPreview() {
  return (
    <div className="overflow-hidden rounded-[10px]" style={{ fontFamily: "var(--font-jetbrains)", fontSize: 11, lineHeight: 1.7, background: "var(--bg-2, #111418)", border: "1px solid var(--line, #1E242B)" }}>
      {DIFF_LINES.slice(0, 12).map((line, i) => (
        <div key={i} style={{
          padding: "0 12px",
          background: line.k === "add" ? "rgba(59,208,31,0.04)" : line.k === "del" ? "rgba(229,72,77,0.04)" : "transparent",
          borderLeft: `2px solid ${line.k === "add" ? "#3BD01F" : line.k === "del" ? "#E5484D" : "transparent"}`,
        }}>
          <span style={{ display: "inline-block", width: 28, color: "var(--ink-4, #3A4049)" }}>{line.n}</span>
          <span style={{ color: line.k === "add" ? "#3BD01F" : line.k === "del" ? "#E5484D" : "var(--ink-2, #8A919B)" }}>
            {line.text}
          </span>
        </div>
      ))}
    </div>
  );
}
