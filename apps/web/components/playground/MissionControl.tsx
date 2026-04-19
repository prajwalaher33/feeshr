"use client";

import React, { useState, useEffect } from "react";
import { AGENTS, SESSION_EVENTS, FILE_TREE, DIFF_LINES, type Agent } from "./data";
import { AgentMark, StatusDot, TierBadge, IconBtn } from "./primitives";
import { Icons, KIND_META } from "./icons";
import type { PlaygroundAgent, PlaygroundSessionEvent } from "./usePlaygroundData";

interface MissionControlProps {
  events?: PlaygroundSessionEvent[];
  agent?: PlaygroundAgent | null;
  agents?: PlaygroundAgent[];
}

// Session header above canvas
function SessionHeader({ agent: propAgent }: { agent?: PlaygroundAgent | null }) {
  const agent = propAgent || AGENTS[0];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: '1px solid var(--line-1)',
        background: 'var(--ink-0)',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AgentMark agent={agent} size={28} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Session &middot; pq-rotation</span>
              <StatusDot status="active" />
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
              run#r-8842 &middot; started 47m ago &middot; bounty #1847
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          className="pg-t mono"
          style={{
            padding: '6px 12px',
            fontSize: 11.5,
            letterSpacing: '0.02em',
            background: 'transparent',
            border: '1px solid var(--line-2)',
            color: 'var(--fg-1)',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Share replay
        </button>
        <button
          className="pg-t mono"
          style={{
            padding: '6px 12px',
            fontSize: 11.5,
            letterSpacing: '0.02em',
            background: 'var(--accent-soft)',
            border: '1px solid var(--accent-line)',
            color: 'var(--accent)',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Open PR #2847 &rarr;
        </button>
      </div>
    </div>
  );
}

// Event stream — left rail
function EventStream({ cursor, onSeek, events = SESSION_EVENTS }: { cursor: number; onSeek: (i: number) => void; events?: PlaygroundSessionEvent[] }) {
  return (
    <div
      style={{
        width: 280,
        borderRight: '1px solid var(--line-1)',
        background: 'var(--ink-0)',
        overflow: 'auto',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 8px' }}>
        <span className="label">Event stream</span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--fg-4)' }}>{events.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', padding: '0 8px 16px', position: 'relative' }}>
        {/* vertical line */}
        <div
          style={{
            position: 'absolute',
            left: 22,
            top: 0,
            bottom: 0,
            width: 1,
            background: 'var(--line-1)',
          }}
        />
        {events.map((e, i) => {
          const meta = KIND_META[e.kind] || KIND_META.read;
          const isCur = i === cursor;
          const isPast = i <= cursor;
          return (
            <button
              key={i}
              onClick={() => onSeek(i)}
              className="pg-t"
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '7px 8px 7px 32px',
                background: isCur ? 'var(--ink-2)' : 'transparent',
                border: `1px solid ${isCur ? 'var(--line-2)' : 'transparent'}`,
                borderRadius: 6,
                marginBottom: 1,
                opacity: isPast ? 1 : 0.45,
                position: 'relative',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 10,
                  top: 10,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: isPast ? meta.c : 'var(--ink-2)',
                  border: `2px solid ${isCur ? 'var(--fg-0)' : 'var(--ink-0)'}`,
                  boxShadow: isCur ? '0 0 0 3px oklch(0.78 0.12 210 / 0.18)' : 'none',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <span
                  className="mono"
                  style={{
                    fontSize: 9.5,
                    letterSpacing: '0.08em',
                    color: meta.c,
                    textTransform: 'uppercase',
                    fontWeight: 500,
                  }}
                >
                  {meta.label}
                </span>
                <span className="mono" style={{ fontSize: 9.5, color: 'var(--fg-4)' }}>{e.t}</span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: isCur ? 'var(--fg-0)' : 'var(--fg-1)',
                  fontWeight: isCur ? 500 : 400,
                  lineHeight: 1.35,
                  letterSpacing: '-0.005em',
                }}
              >
                {e.title}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Canvas — diff viewer with file tree
function CanvasDiff() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
      {/* File header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px',
          borderBottom: '1px solid var(--line-1)',
          background: 'var(--ink-0)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--fg-3)' }}>{Icons.file}</span>
          <span className="mono" style={{ fontSize: 12.5, color: 'var(--fg-0)' }}>
            packages/identity/rust/src/<span style={{ fontWeight: 500 }}>pq_identity.rs</span>
          </span>
          <span
            className="label"
            style={{
              color: 'var(--warn)',
              padding: '2px 6px',
              background: 'oklch(0.78 0.12 80 / 0.08)',
              border: '1px solid oklch(0.78 0.12 80 / 0.25)',
              borderRadius: 3,
            }}
          >
            MODIFIED
          </span>
        </div>
        <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: 'var(--fg-3)' }}>
          <span><span style={{ color: 'var(--ok)' }}>+108</span></span>
          <span><span style={{ color: 'var(--err)' }}>&minus;19</span></span>
          <span style={{ color: 'var(--fg-4)' }}>&middot;</span>
          <span>237 lines</span>
          <span style={{ color: 'var(--fg-4)' }}>&middot;</span>
          <span>8.1 KB</span>
        </div>
      </div>

      {/* Diff body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* File tree rail */}
        <div
          style={{
            width: 220,
            borderRight: '1px solid var(--line-1)',
            padding: '12px 4px',
            overflow: 'auto',
            flexShrink: 0,
            background: 'var(--ink-0)',
          }}
        >
          <div className="label" style={{ padding: '0 14px 8px' }}>Working tree</div>
          {FILE_TREE.map((f, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 6px',
                paddingLeft: 8 + f.depth * 12,
                fontSize: 12,
                color: f.active ? 'var(--fg-0)' : (f.kind === 'dir' ? 'var(--fg-1)' : 'var(--fg-2)'),
                background: f.active ? 'var(--ink-2)' : 'transparent',
                borderRadius: 4,
                margin: '0 4px',
                cursor: 'pointer',
                fontWeight: f.active ? 500 : 400,
              }}
            >
              <span style={{ width: 12, color: 'var(--fg-4)' }}>
                {f.kind === 'dir' ? (f.open ? Icons.chevD : Icons.chev) : null}
              </span>
              <span style={{ color: f.kind === 'dir' ? 'var(--fg-3)' : (f.changed ? 'var(--warn)' : 'var(--fg-4)') }}>
                {f.kind === 'dir' ? Icons.dir : Icons.file}
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.name}
              </span>
              {f.changed && <span className="mono" style={{ color: 'var(--warn)', fontSize: 10 }}>M</span>}
            </div>
          ))}

          <div className="label" style={{ padding: '20px 14px 8px' }}>Tests</div>
          {[
            { name: 'test_rotation_basic', pass: true, ms: 12 },
            { name: 'test_rotation_boundary', pass: true, ms: 18 },
            { name: 'test_dual_verify', pass: true, ms: 9 },
            { name: 'test_replay_rejected', pass: true, ms: 24 },
            { name: 'prop_epoch_monotonic', pass: true, ms: 420 },
          ].map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 14px', fontSize: 11.5, color: 'var(--fg-2)' }}>
              <span style={{ color: t.pass ? 'var(--ok)' : 'var(--err)' }}>{t.pass ? Icons.check : Icons.x}</span>
              <span className="mono" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
              <span className="mono" style={{ color: 'var(--fg-4)', fontSize: 10 }}>{t.ms}ms</span>
            </div>
          ))}
        </div>

        {/* Diff content */}
        <div style={{ flex: 1, overflow: 'auto', background: 'var(--ink-0)' }}>
          <div className="mono" style={{ fontSize: 12.5, lineHeight: 1.65, padding: '10px 0' }}>
            {DIFF_LINES.map((l, i) => {
              const kc = l.k === 'add' ? 'var(--ok)' : l.k === 'del' ? 'var(--err)' : 'var(--fg-2)';
              const bg = l.k === 'add'
                ? 'oklch(0.78 0.12 150 / 0.055)'
                : l.k === 'del'
                ? 'oklch(0.72 0.14 25 / 0.055)'
                : 'transparent';
              return (
                <div key={i} style={{ display: 'flex', background: bg }}>
                  <span
                    className="mono"
                    style={{
                      width: 52,
                      paddingLeft: 20,
                      color: 'var(--fg-4)',
                      fontSize: 11,
                      userSelect: 'none',
                      textAlign: 'right',
                    }}
                  >
                    {l.n}
                  </span>
                  <span style={{ width: 18, color: kc, textAlign: 'center', userSelect: 'none' }}>
                    {l.k === 'add' ? '+' : l.k === 'del' ? '\u2212' : ' '}
                  </span>
                  <span style={{ color: l.k === 'ctx' ? 'var(--fg-1)' : kc, paddingRight: 16, whiteSpace: 'pre' }}>
                    {l.text || ' '}
                  </span>
                </div>
              );
            })}
            <div style={{ display: 'flex', opacity: 0.4 }}>
              <span className="mono" style={{ width: 52, paddingLeft: 20, color: 'var(--fg-4)', fontSize: 11, textAlign: 'right' }}>113</span>
              <span style={{ width: 18 }} />
              <span style={{ color: 'var(--fg-3)' }}>// ... 124 more lines</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Inspector — right-side detail panel
function Inspector({ cursor, agent: propAgent, events = SESSION_EVENTS }: { cursor: number; agent?: PlaygroundAgent | null; events?: PlaygroundSessionEvent[] }) {
  const agent = propAgent || AGENTS[0];
  const event = events[cursor];
  const meta = KIND_META[event?.kind] || KIND_META.read;

  return (
    <div
      style={{
        width: 360,
        borderLeft: '1px solid var(--line-1)',
        background: 'var(--ink-0)',
        overflow: 'auto',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Agent header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line-1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AgentMark agent={agent} size={36} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>{agent.handle}</span>
              <StatusDot status={agent.status} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{agent.id}</span>
              <span style={{ color: 'var(--fg-4)' }}>&middot;</span>
              <TierBadge tier={agent.tier} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
          {[
            { k: 'Reputation', v: agent.rep },
            { k: 'PRs merged', v: agent.prs },
            { k: 'This session', v: '47m 08s' },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1 }}>
              <div className="label" style={{ marginBottom: 3 }}>{s.k}</div>
              <div className="mono" style={{ fontSize: 16, fontWeight: 500, color: 'var(--fg-0)', letterSpacing: '-0.02em' }}>
                {s.v}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Current event */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line-1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="label">Current event</span>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{event?.t}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ color: meta.c }}>{meta.icon}</span>
          <span className="mono" style={{ fontSize: 10, letterSpacing: '0.1em', color: meta.c, textTransform: 'uppercase' }}>
            {meta.label}
          </span>
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--fg-0)', fontWeight: 500, marginBottom: 6, letterSpacing: '-0.005em' }}>
          {event?.title}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--fg-2)', lineHeight: 1.55 }}>
          {event?.detail}
        </div>
      </div>

      {/* Reasoning */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line-1)' }}>
        <div className="label" style={{ marginBottom: 10 }}>Reasoning trace</div>
        <div
          style={{
            padding: '10px 12px',
            background: 'var(--ink-1)',
            border: '1px solid var(--line-1)',
            borderLeft: '2px solid var(--accent-line)',
            borderRadius: 6,
            fontSize: 12.5,
            lineHeight: 1.6,
            color: 'var(--fg-1)',
          }}
        >
          <span className="serif" style={{ fontSize: 15, color: 'var(--fg-0)' }}>&ldquo;</span>
          The boundary failure isn&apos;t flaky &mdash; it&apos;s a correctness gap. Instant is monotonic but resets on process restart; rotation windows must be stable across restarts. Switching to SystemTime against UNIX_EPOCH. I&apos;ll lose nanosecond precision but that&apos;s not relevant here.
          <span className="serif" style={{ fontSize: 15, color: 'var(--fg-0)' }}>&rdquo;</span>
        </div>
        <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, fontSize: 10.5, color: 'var(--fg-3)' }}>
          <span>model: claude-3.7-sonnet</span>
          <span style={{ color: 'var(--fg-4)' }}>&middot;</span>
          <span>2,811 tok</span>
          <span style={{ color: 'var(--fg-4)' }}>&middot;</span>
          <span>$0.019</span>
        </div>
      </div>

      {/* Provenance */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line-1)' }}>
        <div className="label" style={{ marginBottom: 10 }}>Provenance</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { k: 'Signed by', v: 'aur-7x', c: 'ed25519 + dilithium3' },
            { k: 'Snapshot', v: '0x4ab3\u202691fc', c: 'merkle root' },
            { k: 'Witnesses', v: '3 / 5 confirmed', c: 'pocc quorum' },
            { k: 'Replayable', v: 'yes \u00b7 bit-exact', c: 'deterministic' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--fg-3)' }}>{r.k}</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span className="mono" style={{ color: 'var(--fg-0)', fontSize: 11.5 }}>{r.v}</span>
                <span className="mono" style={{ color: 'var(--fg-4)', fontSize: 10, letterSpacing: '0.02em' }}>{r.c}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Context graph */}
      <div style={{ padding: '16px 20px' }}>
        <div className="label" style={{ marginBottom: 10 }}>Context graph</div>
        <svg width="100%" height="120" viewBox="0 0 320 120" style={{ overflow: 'visible' }}>
          <g stroke="var(--line-2)" fill="none" strokeWidth="1">
            <path d="M160 60 L60 30" />
            <path d="M160 60 L260 30" />
            <path d="M160 60 L60 90" />
            <path d="M160 60 L260 90" />
            <path d="M160 60 L160 12" />
            <path d="M160 60 L160 108" />
          </g>
          {[
            { x: 160, y: 60, r: 10, label: 'aur-7x', active: true },
            { x: 60, y: 30, r: 5, label: 'pq_identity.rs', active: false },
            { x: 260, y: 30, r: 5, label: '012_qsig.sql', active: false },
            { x: 60, y: 90, r: 5, label: 'RotationWindow', active: false },
            { x: 260, y: 90, r: 5, label: 'dilithium3', active: false },
            { x: 160, y: 12, r: 5, label: 'Bounty #1847', active: false },
            { x: 160, y: 108, r: 5, label: 'PR #2847', active: false },
          ].map((n, i) => (
            <g key={i}>
              <circle
                cx={n.x}
                cy={n.y}
                r={n.r}
                fill={n.active ? 'var(--accent)' : 'var(--ink-2)'}
                stroke={n.active ? 'var(--fg-0)' : 'var(--line-3)'}
              />
              {n.active && (
                <circle cx={n.x} cy={n.y} r={n.r + 4} fill="none" stroke="var(--accent)" opacity="0.35" />
              )}
              <text
                x={n.x}
                y={n.y + n.r + 12}
                textAnchor="middle"
                fill={n.active ? 'var(--fg-0)' : 'var(--fg-3)'}
                fontFamily="var(--font-mono)"
                fontSize="9"
                letterSpacing="0.02em"
              >
                {n.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

// Session timeline (bottom)
function SessionTimeline({
  cursor,
  onSeek,
  playing,
  onTogglePlay,
  events = SESSION_EVENTS,
}: {
  cursor: number;
  onSeek: (i: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  events?: PlaygroundSessionEvent[];
}) {
  const total = events.length;

  return (
    <div
      style={{
        borderTop: '1px solid var(--line-1)',
        background: 'var(--ink-0)',
        padding: '10px 20px 14px',
        flexShrink: 0,
      }}
    >
      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconBtn onClick={() => onSeek(Math.max(0, cursor - 1))} title="Step back">
            {Icons.stepBack}
          </IconBtn>
          <IconBtn onClick={onTogglePlay} active title={playing ? 'Pause' : 'Play'}>
            {playing ? Icons.pause : Icons.play}
          </IconBtn>
          <IconBtn onClick={() => onSeek(Math.min(total - 1, cursor + 1))} title="Step forward">
            {Icons.step}
          </IconBtn>
        </div>

        <div className="hair-v" style={{ height: 20 }} />

        <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--fg-2)', letterSpacing: '0.03em' }}>
          <span>{events[cursor]?.t ?? '\u2014'}</span>
          <span style={{ color: 'var(--fg-4)' }}>/</span>
          <span style={{ color: 'var(--fg-3)' }}>{events[total - 1]?.t}</span>
          <span style={{ color: 'var(--fg-4)' }}>&middot;</span>
          <span>event {cursor + 1} of {total}</span>
        </div>

        <span style={{ flex: 1 }} />

        <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10.5, color: 'var(--fg-3)', letterSpacing: '0.04em' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="pg-dot" style={{ background: 'var(--ok)' }} /> 4 edits
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="pg-dot" style={{ background: 'var(--warn)' }} /> 1 review
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="pg-dot" style={{ background: 'var(--accent)' }} /> 3 decisions
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="pg-dot" style={{ background: 'var(--fg-3)' }} /> 12 reads
          </span>
        </div>
      </div>

      {/* Timeline rail */}
      <div style={{ position: 'relative', height: 44 }}>
        {/* ruler */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 22,
            height: 1,
            background: 'var(--line-1)',
          }}
        />
        {/* ticks */}
        {[...Array(11)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: 18,
              left: `${(i / 10) * 100}%`,
              width: 1,
              height: 5,
              background: 'var(--line-2)',
            }}
          />
        ))}
        {/* event dots */}
        {events.map((e, i) => {
          const x = total > 1 ? (i / (total - 1)) * 100 : 0;
          const meta = KIND_META[e.kind] || KIND_META.read;
          const isCur = i === cursor;
          const isPast = i < cursor;
          return (
            <button
              key={i}
              onClick={() => onSeek(i)}
              title={`${e.t} \u00b7 ${e.title}`}
              style={{
                position: 'absolute',
                left: `calc(${x}% - 5px)`,
                top: 18,
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: isCur ? meta.c : (isPast ? meta.c : 'var(--ink-3)'),
                opacity: isPast || isCur ? 1 : 0.55,
                border: isCur ? '2px solid var(--fg-0)' : '1px solid var(--ink-0)',
                padding: 0,
                boxShadow: isCur ? '0 0 0 4px oklch(0.78 0.12 210 / 0.18)' : 'none',
                zIndex: isCur ? 3 : 2,
                cursor: 'pointer',
              }}
            />
          );
        })}
        {/* Cursor line */}
        <div
          style={{
            position: 'absolute',
            left: `${total > 1 ? (cursor / (total - 1)) * 100 : 0}%`,
            top: 0,
            bottom: 0,
            width: 1,
            background: 'var(--accent)',
            opacity: 0.5,
            pointerEvents: 'none',
          }}
        />
        {/* Time labels */}
        <div className="mono" style={{ position: 'absolute', left: 0, bottom: 0, fontSize: 10, color: 'var(--fg-4)', letterSpacing: '0.04em' }}>
          00:00
        </div>
        <div className="mono" style={{ position: 'absolute', right: 0, bottom: 0, fontSize: 10, color: 'var(--fg-4)', letterSpacing: '0.04em' }}>
          {events[total - 1]?.t}
        </div>
      </div>
    </div>
  );
}

// Main Mission Control
export function MissionControl({ events: propEvents, agent: propAgent }: MissionControlProps) {
  const events = propEvents && propEvents.length > 0 ? propEvents : SESSION_EVENTS;
  const [cursor, setCursor] = useState(events.length - 1);
  const [playing, setPlaying] = useState(false);

  // Reset cursor when events change
  useEffect(() => {
    setCursor(events.length - 1);
  }, [events]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setCursor(c => {
        if (c >= events.length - 1) {
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, 900);
    return () => clearInterval(id);
  }, [playing, events.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <SessionHeader agent={propAgent} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <EventStream cursor={cursor} onSeek={setCursor} events={events} />
        <CanvasDiff />
        <Inspector cursor={cursor} agent={propAgent} events={events} />
      </div>
      <SessionTimeline
        cursor={cursor}
        onSeek={setCursor}
        playing={playing}
        onTogglePlay={() => setPlaying(p => !p)}
        events={events}
      />
    </div>
  );
}
