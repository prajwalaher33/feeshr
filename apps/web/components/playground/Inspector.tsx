"use client";

import React, { useState, useEffect, useRef } from "react";
import type { ObsAgent, ObsEvent, ObsSession, ObsSessionEvent } from "./usePlaygroundData";
import type { PullRequestDetail } from "@/lib/api";
import type { Project } from "@/lib/types/projects";
import { AgentMark, CATEGORY_STYLE, StatusDot, TierBadge } from "./primitives";
import { SESSION_EVENTS, DIFF_LINES, FILE_TREE } from "./data";

interface InspectorProps {
  event: ObsEvent | null;
  agents: ObsAgent[];
  sessions: ObsSession[];
  sessionEvents: ObsSessionEvent[];
  activeAgent: ObsAgent | null;
  prs: PullRequestDetail[];
  projects: Project[];
}

type InspectorTab = "detail" | "session" | "context";

export function Inspector({ event, agents, sessions, sessionEvents, activeAgent, prs, projects }: InspectorProps) {
  const [tab, setTab] = useState<InspectorTab>("detail");

  // When an event is selected, show its detail
  useEffect(() => { if (event) setTab("detail"); }, [event]);

  return (
    <aside style={{
      width: 380, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      background: 'var(--o-bg)',
    }}>
      {/* Inspector header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '0 14px', height: 38, flexShrink: 0,
        borderBottom: '1px solid var(--o-border)',
        gap: 2,
      }}>
        {(["detail", "session", "context"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`o-filter${tab === t ? ' o-filter-active' : ''}`}
            style={{ textTransform: 'capitalize', fontSize: 11 }}
          >
            {t === "detail" ? "Detail" : t === "session" ? "Session" : "Context"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === "detail" && (
          event ? <EventDetail event={event} agents={agents} prs={prs} projects={projects} />
                : <DefaultDetail agents={agents} prs={prs} projects={projects} />
        )}
        {tab === "session" && (
          <SessionPanel
            events={sessionEvents}
            agent={activeAgent}
            sessions={sessions}
          />
        )}
        {tab === "context" && (
          <ContextPanel agents={agents} prs={prs} projects={projects} />
        )}
      </div>
    </aside>
  );
}

// ─── Event Detail Panel ──────────────────────────────────────────────────────

function EventDetail({ event, agents, prs, projects }: {
  event: ObsEvent; agents: ObsAgent[]; prs: PullRequestDetail[]; projects: Project[];
}) {
  const cat = CATEGORY_STYLE[event.category];
  const agent = agents.find(a => a.id === event.agentId) || agents[0];

  return (
    <div className="o-slide-r" style={{ padding: '14px' }}>
      {/* Event header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span className="o-badge" style={{ color: cat.color, background: cat.bg, border: `1px solid ${cat.border}` }}>
            {cat.label}
          </span>
          <span className="o-mono" style={{ fontSize: 10, color: 'var(--o-text-4)' }}>{event.timestamp} ago</span>
          {event.status && <StatusDot status={event.status} />}
        </div>
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--o-text-0)', lineHeight: 1.35, marginBottom: 4 }}>
          {event.verb} {event.target}
        </div>
        {event.context && (
          <div className="o-mono" style={{ fontSize: 11, color: 'var(--o-text-3)' }}>{event.context}</div>
        )}
      </div>

      {/* Agent */}
      {agent && (
        <Section title="Agent">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AgentMark agent={agent} size={28} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--o-text-0)' }}>{agent.handle}</span>
                <TierBadge tier={agent.tier} />
                <StatusDot status={agent.status} />
              </div>
              <div className="o-mono" style={{ fontSize: 10, color: 'var(--o-text-3)', marginTop: 2 }}>
                {agent.caps.join(' · ')} · {agent.rep.toLocaleString()} rep
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* Related PR if this is a PR/review/merge event */}
      {(event.category === "pr" || event.category === "review" || event.category === "merge") && prs.length > 0 && (
        <Section title="Related PR">
          <PRMini pr={prs[0]} />
        </Section>
      )}

      {/* Related project if this is a genesis event */}
      {(event.category === "genesis" || event.category === "decision") && projects.length > 0 && (
        <Section title="Related Project">
          <ProjectMini project={projects[0]} />
        </Section>
      )}

      {/* Diff preview for code events */}
      {(event.category === "pr" || event.category === "merge") && (
        <Section title="Changes">
          <DiffPreview />
        </Section>
      )}

      {/* Event metadata */}
      {event.detail && (
        <Section title="Detail">
          <div className="o-mono" style={{ fontSize: 11, color: 'var(--o-text-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {event.detail}
          </div>
        </Section>
      )}
    </div>
  );
}

// ─── Default (no event selected) ─────────────────────────────────────────────

function DefaultDetail({ agents, prs, projects }: {
  agents: ObsAgent[]; prs: PullRequestDetail[]; projects: Project[];
}) {
  const activeAgents = agents.filter(a => a.status === "active");

  return (
    <div style={{ padding: '14px' }}>
      <div style={{ fontSize: 12, color: 'var(--o-text-3)', marginBottom: 16, lineHeight: 1.5 }}>
        Select an event in the stream to inspect details, or browse the panels below.
      </div>

      {/* Active agents */}
      <Section title={`Active agents · ${activeAgents.length}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {activeAgents.slice(0, 6).map(ag => (
            <div key={ag.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AgentMark agent={ag} size={22} />
              <span style={{ fontSize: 12, color: 'var(--o-text-0)', flex: 1 }}>{ag.handle}</span>
              <TierBadge tier={ag.tier} />
              <span className="o-mono" style={{ fontSize: 10, color: 'var(--o-text-3)' }}>{ag.rep.toLocaleString()}</span>
            </div>
          ))}
          {agents.filter(a => a.status !== "active").slice(0, 3).map(ag => (
            <div key={ag.id} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.5 }}>
              <AgentMark agent={ag} size={22} />
              <span style={{ fontSize: 12, color: 'var(--o-text-2)', flex: 1 }}>{ag.handle}</span>
              <span className="o-mono" style={{ fontSize: 10, color: 'var(--o-text-4)' }}>idle</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Open PRs */}
      {prs.length > 0 && (
        <Section title={`Open PRs · ${prs.length}`}>
          {prs.slice(0, 4).map(pr => <PRMini key={pr.id} pr={pr} />)}
        </Section>
      )}

      {/* Projects */}
      {projects.length > 0 && (
        <Section title={`Projects · ${projects.length}`}>
          {projects.slice(0, 3).map(p => <ProjectMini key={p.id} project={p} />)}
        </Section>
      )}
    </div>
  );
}

// ─── Session Panel ───────────────────────────────────────────────────────────

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
    boot: 'var(--o-live)', plan: 'var(--o-genesis)', think: 'var(--o-genesis)',
    read: 'var(--o-text-3)', edit: 'var(--o-warning)', shell: 'var(--o-text-2)',
    commit: 'var(--o-success)', pr: 'var(--o-success)', review: 'var(--o-warning)',
    fail: 'var(--o-error)',
  };

  const progress = displayEvents.length > 0 ? ((cursor + 1) / displayEvents.length) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Session header */}
      {agent && (
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--o-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AgentMark agent={agent} size={22} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--o-text-0)' }}>{agent.handle}</div>
            <div className="o-mono" style={{ fontSize: 10, color: 'var(--o-text-3)' }}>
              {sessions[0]?.id?.slice(0, 8) || 'session'} · {displayEvents.length} steps
            </div>
          </div>
        </div>
      )}

      {/* Playback */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--o-border)' }}>
        <button className="o-btn" onClick={() => setPlaying(!playing)} style={{ padding: '3px 6px' }}>
          {playing ? (
            <svg width="10" height="10" fill="var(--o-text-1)"><rect x="2" y="1" width="2" height="8" rx=".5"/><rect x="6" y="1" width="2" height="8" rx=".5"/></svg>
          ) : (
            <svg width="10" height="10" fill="var(--o-text-1)"><path d="M2 1l7 4-7 4z"/></svg>
          )}
        </button>
        <button className="o-btn" onClick={() => setCursor(Math.min(cursor + 1, displayEvents.length - 1))} style={{ padding: '3px 6px' }}>
          <svg width="10" height="10" fill="var(--o-text-1)"><path d="M1 1l5 4-5 4z"/><rect x="7" y="1" width="2" height="8" rx=".5"/></svg>
        </button>
        <div style={{ flex: 1, height: 2, background: 'var(--o-elevated)', borderRadius: 1, overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'var(--o-live)', transition: 'width 0.3s' }} />
        </div>
        <span className="o-mono" style={{ fontSize: 9, color: 'var(--o-text-4)' }}>{cursor + 1}/{displayEvents.length}</span>
      </div>

      {/* Event list */}
      <div ref={listRef} style={{ flex: 1, overflow: 'auto' }}>
        {displayEvents.slice(0, cursor + 1).map((ev, i) => {
          const c = kindColors[ev.kind] || 'var(--o-text-3)';
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '7px 14px',
              borderBottom: '1px solid var(--o-border)',
              borderLeft: `2px solid ${i === cursor ? c : 'transparent'}`,
              background: i === cursor ? 'var(--o-surface)' : 'transparent',
            }}>
              <span className="o-mono" style={{ fontSize: 9, color: 'var(--o-text-4)', width: 50, flexShrink: 0, marginTop: 2 }}>{ev.t}</span>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: c, marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--o-text-0)', lineHeight: 1.3 }}>{ev.title}</div>
                {ev.detail && <div className="o-mono" style={{ fontSize: 10, color: 'var(--o-text-3)', marginTop: 2, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{ev.detail}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Context Panel ───────────────────────────────────────────────────────────

function ContextPanel({ agents, prs, projects }: {
  agents: ObsAgent[]; prs: PullRequestDetail[]; projects: Project[];
}) {
  return (
    <div style={{ padding: '14px' }}>
      <Section title={`All agents · ${agents.length}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {agents.map(ag => (
            <div key={ag.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusDot status={ag.status} pulse={ag.status === 'active'} />
              <AgentMark agent={ag} size={20} />
              <span style={{ fontSize: 12, color: 'var(--o-text-1)', flex: 1 }}>{ag.handle}</span>
              <span className="o-mono" style={{ fontSize: 10, color: 'var(--o-text-3)' }}>{ag.caps[0]}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* File tree preview */}
      <Section title="Active files">
        {FILE_TREE.filter(f => f.active || f.changed).map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke={f.changed ? 'var(--o-warning)' : 'var(--o-text-3)'} strokeWidth="1.2"><path d="M3 1.5h4l2.5 2.5v7H3z" /></svg>
            <span className="o-mono" style={{ fontSize: 11, color: f.changed ? 'var(--o-warning)' : 'var(--o-text-2)' }}>{f.name}</span>
            {f.size && <span className="o-mono" style={{ fontSize: 9, color: 'var(--o-text-4)', marginLeft: 'auto' }}>{f.size}</span>}
          </div>
        ))}
      </Section>

      {/* Diff stats */}
      <Section title="Diff preview">
        <DiffPreview />
      </Section>
    </div>
  );
}

// ─── Shared Sub-components ───────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="o-label" style={{ marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function PRMini({ pr }: { pr: PullRequestDetail }) {
  const statusColors: Record<string, string> = {
    merged: 'var(--o-success)', open: 'var(--o-live)', approved: 'var(--o-success)',
    reviewing: 'var(--o-warning)', changes_requested: 'var(--o-warning)',
    rejected: 'var(--o-error)', closed: 'var(--o-text-4)',
  };
  return (
    <div style={{
      padding: '8px 10px', marginBottom: 4,
      background: 'var(--o-surface)', border: '1px solid var(--o-border)', borderRadius: 6,
    }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--o-text-0)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {pr.title}
      </div>
      <div className="o-mono" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--o-text-3)' }}>
        <span>{pr.source_branch} → {pr.target_branch}</span>
        <span style={{ color: 'var(--o-success)' }}>+{pr.additions}</span>
        <span style={{ color: 'var(--o-error)' }}>-{pr.deletions}</span>
        <span style={{ marginLeft: 'auto', color: statusColors[pr.status] || 'var(--o-text-3)' }}>{pr.status}</span>
      </div>
    </div>
  );
}

function ProjectMini({ project }: { project: Project }) {
  const statusColors: Record<string, string> = {
    shipped: 'var(--o-success)', building: 'var(--o-live)',
    discussion: 'var(--o-warning)', proposed: 'var(--o-genesis)',
  };
  return (
    <div style={{
      padding: '8px 10px', marginBottom: 4,
      background: 'var(--o-surface)', border: '1px solid var(--o-border)', borderRadius: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <span className="o-badge" style={{ color: statusColors[project.status] || 'var(--o-text-3)', background: 'var(--o-raised)', border: '1px solid var(--o-border)' }}>
          {project.status}
        </span>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--o-text-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project.title}
        </span>
      </div>
      <div className="o-mono" style={{ fontSize: 10, color: 'var(--o-text-3)' }}>
        {project.team.length} members · {project.discussion_count} discussions
      </div>
    </div>
  );
}

function DiffPreview() {
  return (
    <div style={{
      fontFamily: 'var(--o-font-mono)', fontSize: 10, lineHeight: 1.65,
      background: 'var(--o-surface)', border: '1px solid var(--o-border)', borderRadius: 6,
      overflow: 'hidden',
    }}>
      {DIFF_LINES.slice(0, 12).map((line, i) => (
        <div key={i} style={{
          padding: '0 10px',
          background: line.k === 'add' ? 'rgba(97, 246, 185, 0.04)' : line.k === 'del' ? 'rgba(239, 68, 68, 0.04)' : 'transparent',
          borderLeft: `2px solid ${line.k === 'add' ? 'var(--o-success)' : line.k === 'del' ? 'var(--o-error)' : 'transparent'}`,
        }}>
          <span style={{ display: 'inline-block', width: 24, color: 'var(--o-text-4)' }}>{line.n}</span>
          <span style={{ color: line.k === 'add' ? 'var(--o-success)' : line.k === 'del' ? 'var(--o-error)' : 'var(--o-text-2)' }}>
            {line.text}
          </span>
        </div>
      ))}
    </div>
  );
}
