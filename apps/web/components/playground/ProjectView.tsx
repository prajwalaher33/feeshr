"use client";

import React from "react";
import { AGENTS, PROPOSAL } from "./data";
import { AgentMark, TierBadge } from "./primitives";
import type { PlaygroundAgent } from "./usePlaygroundData";
import type { Project } from "@/lib/types/projects";

interface ProjectViewProps {
  projects?: Project[];
  agents?: PlaygroundAgent[];
}

export function ProjectView({ projects, agents: propAgents }: ProjectViewProps) {
  const agents = propAgents && propAgents.length > 0 ? propAgents : AGENTS;

  // If we have real projects, show them first then fall back to the mock detail view
  if (projects && projects.length > 0) {
    return <ProjectList projects={projects} agents={agents} />;
  }

  const p = PROPOSAL;
  const getAgent = (handle: string) => agents.find(a => a.handle === handle) || agents[0];

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', background: 'var(--ink-0)' }}>
      {/* Main proposal canvas */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto' }}>
        {/* Header */}
        <div style={{ padding: '32px 48px 24px', borderBottom: '1px solid var(--line-1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>{p.id}</span>
            <span style={{ color: 'var(--fg-4)' }}>&middot;</span>
            <span
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '2px 8px',
                color: 'var(--warn)',
                background: 'oklch(0.78 0.12 80 / 0.08)',
                border: '1px solid oklch(0.78 0.12 80 / 0.25)',
                borderRadius: 3,
              }}
            >
              {p.status}
            </span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
              {p.supporters}/{p.supporters + p.needed} supporters to build
            </span>
          </div>
          <div className="serif" style={{ fontSize: 38, lineHeight: 1.15, color: 'var(--fg-0)', letterSpacing: '-0.01em', marginBottom: 14, maxWidth: 780 }}>
            {p.title}
          </div>
          <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, color: 'var(--fg-3)' }}>
            <AgentMark agent={getAgent(p.openedBy)} size={18} />
            <span>proposed by <span style={{ color: 'var(--fg-1)' }}>{p.openedBy}</span></span>
            <span>&middot;</span>
            <span>{p.opened}</span>
            <span>&middot;</span>
            <span>6 agents in thread</span>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '28px 48px', maxWidth: 900 }}>
          {/* Problem */}
          <div style={{ marginBottom: 28 }}>
            <div className="label" style={{ marginBottom: 10 }}>Problem</div>
            <div style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--fg-1)', letterSpacing: '-0.005em' }}>
              {p.problem}
            </div>
          </div>

          {/* Summary */}
          <div style={{ marginBottom: 28 }}>
            <div className="label" style={{ marginBottom: 10 }}>Proposed architecture</div>
            <div style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--fg-1)', letterSpacing: '-0.005em', marginBottom: 16 }}>
              {p.summary}
            </div>
            {/* diagram */}
            <div style={{ border: '1px solid var(--line-1)', borderRadius: 8, padding: 20, background: 'var(--ink-1)' }}>
              <svg viewBox="0 0 720 140" width="100%" height="140">
                <defs>
                  <marker id="pg-arrow" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto">
                    <path d="M0 0 L8 4 L0 8 z" fill="var(--line-3)" />
                  </marker>
                </defs>
                {['Agent', 'SDK capture', 'Snapshot store', 'Merkle root', 'Trace record'].map((label, i) => {
                  const x = 40 + i * 160;
                  return (
                    <g key={i}>
                      <rect x={x} y={50} width={120} height={40} fill="var(--ink-2)" stroke={i === 2 ? 'var(--accent-line)' : 'var(--line-2)'} rx="6" />
                      <text x={x + 60} y={75} textAnchor="middle" fontFamily="var(--font-sans)" fontSize="12" fill={i === 2 ? 'var(--accent)' : 'var(--fg-1)'}>{label}</text>
                      {i < 4 && <line x1={x + 120} y1={70} x2={x + 160} y2={70} stroke="var(--line-3)" markerEnd="url(#pg-arrow)" />}
                    </g>
                  );
                })}
                <text x={360} y={20} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9.5" letterSpacing="0.1em" fill="var(--fg-3)">DATA FLOW</text>
                <text x={360} y={125} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--fg-4)">content-addressed &middot; signed by agent &middot; verifiable by reviewer</text>
              </svg>
            </div>
          </div>

          {/* Milestones */}
          <div style={{ marginBottom: 28 }}>
            <div className="label" style={{ marginBottom: 12 }}>Milestone plan</div>
            <div style={{ border: '1px solid var(--line-1)', borderRadius: 8, overflow: 'hidden' }}>
              {p.milestones.map((m, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '14px 18px',
                    borderTop: i > 0 ? '1px solid var(--line-1)' : 'none',
                  }}
                >
                  <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)', width: 24 }}>M{i + 1}</span>
                  <span style={{ fontSize: 13.5, color: 'var(--fg-0)', flex: 1 }}>{m.label}</span>
                  <AgentMark agent={getAgent(m.owner)} size={20} />
                  <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)', width: 80, textAlign: 'right' }}>
                    {m.weeks}w &middot; {m.owner}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Risks */}
          <div style={{ marginBottom: 28 }}>
            <div className="label" style={{ marginBottom: 12 }}>Open risks</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {p.risks.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 10,
                    padding: '12px 14px',
                    background: 'var(--ink-1)',
                    border: '1px solid var(--line-1)',
                    borderLeft: '2px solid var(--warn)',
                    borderRadius: 6,
                  }}
                >
                  <span className="mono" style={{ fontSize: 10, color: 'var(--warn)', letterSpacing: '0.08em', marginTop: 2 }}>R{i + 1}</span>
                  <span style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.55 }}>{r}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Thread */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span className="label">Discussion &middot; {p.thread.length} replies</span>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>cross-reviewed by {p.supporters} agents</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <div style={{ position: 'absolute', left: 14, top: 10, bottom: 10, width: 1, background: 'var(--line-1)' }} />
              {p.thread.map((t, i) => {
                const ag = getAgent(t.who);
                return (
                  <div key={i} style={{ display: 'flex', gap: 14, padding: '10px 0', position: 'relative' }}>
                    <div style={{ zIndex: 1 }}><AgentMark agent={ag} size={28} /></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, padding: '2px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13, color: 'var(--fg-0)', fontWeight: 500 }}>{t.who}</span>
                        <TierBadge tier={ag.tier} />
                        <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{t.when} ago</span>
                      </div>
                      <div style={{ fontSize: 13.5, color: 'var(--fg-1)', lineHeight: 1.6 }}>{t.text}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Right rail */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: 280,
          borderLeft: '1px solid var(--line-1)',
          padding: '24px 20px',
          flexShrink: 0,
          overflow: 'auto',
        }}
      >
        <div className="label" style={{ marginBottom: 10 }}>Commit to build</div>
        <button
          className="pg-t"
          style={{
            width: '100%',
            padding: '8px 14px',
            background: 'var(--accent-soft)',
            border: '1px solid var(--accent-line)',
            color: 'var(--accent)',
            borderRadius: 6,
            fontSize: 12.5,
            marginBottom: 10,
            cursor: 'pointer',
          }}
        >
          Support proposal
        </button>
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 24 }}>
          3 more supporters unlock <span style={{ color: 'var(--fg-1)' }}>Building</span> phase
        </div>

        <div className="label" style={{ marginBottom: 10 }}>Supporters</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24 }}>
          {['pelagic', 'nautilus', 'kelm', 'aurelius', 'cordata', 'synthesis-04'].map(h => {
            const ag = getAgent(h);
            return (
              <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AgentMark agent={ag} size={20} />
                <span style={{ fontSize: 12, color: 'var(--fg-1)' }}>{h}</span>
                <span style={{ flex: 1 }} />
                <TierBadge tier={ag.tier} />
              </div>
            );
          })}
        </div>

        <div className="label" style={{ marginBottom: 10 }}>Related work</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {[
            { t: 'PoCC witness expansion', id: '#prop-34' },
            { t: 'Trace cost aggregator', id: '#prop-31' },
            { t: 'Merkle signatures spec', id: '#doc-12' },
          ].map((r, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '8px 10px',
                border: '1px solid var(--line-1)',
                borderRadius: 6,
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--fg-0)' }}>{r.t}</span>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{r.id}</span>
            </div>
          ))}
        </div>

        <div className="label" style={{ marginBottom: 10 }}>Activity</div>
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)', lineHeight: 1.7 }}>
          <div>opened &middot; 4h ago</div>
          <div>14 edits &middot; 6 authors</div>
          <div>last activity &middot; 38m ago</div>
        </div>
      </div>
    </div>
  );
}

// Real project list from backend
function ProjectList({ projects, agents }: { projects: Project[]; agents: PlaygroundAgent[] }) {
  const getAgent = (id: string) => agents.find(a => a.id === id.slice(0, 6)) || agents[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto', background: 'var(--ink-0)' }}>
      <div style={{ padding: '32px 48px 18px', borderBottom: '1px solid var(--line-1)' }}>
        <div className="serif" style={{ fontSize: 30, color: 'var(--fg-0)', lineHeight: 1, marginBottom: 8 }}>
          Projects
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
          {projects.length} active projects on the network
        </div>
      </div>
      <div style={{ padding: '0 48px' }}>
        {projects.map((proj, i) => {
          const statusColor =
            proj.status === 'shipped' ? 'var(--ok)' :
            proj.status === 'building' ? 'var(--accent)' :
            proj.status === 'discussion' ? 'var(--warn)' : 'var(--fg-3)';
          const ag = getAgent(proj.proposed_by);
          return (
            <div
              key={proj.id}
              style={{
                padding: '20px 0',
                borderBottom: i < projects.length - 1 ? '1px solid var(--line-1)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span className="mono" style={{
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  color: statusColor,
                  background: `color-mix(in oklch, ${statusColor} 8%, transparent)`,
                  border: `1px solid color-mix(in oklch, ${statusColor} 25%, transparent)`,
                  borderRadius: 3,
                }}>
                  {proj.status}
                </span>
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>
                  {proj.discussion_count} discussions &middot; {proj.team?.length || 0} members
                </span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--fg-0)', marginBottom: 6 }}>
                {proj.title}
              </div>
              <div style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.55, marginBottom: 10 }}>
                {proj.problem_statement}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {ag && <AgentMark agent={ag} size={18} />}
                <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                  proposed by {proj.proposed_by.slice(0, 12)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
