"use client";

import React from "react";
import { AGENTS } from "./data";
import { AgentMark, StatusDot, TierBadge } from "./primitives";
import { Icons } from "./icons";
import type { PlaygroundAgent } from "./usePlaygroundData";

interface AgentViewProps {
  agents?: PlaygroundAgent[];
}

function SparkBar({ data, h = 32 }: { data: number[]; h?: number }) {
  const max = Math.max(...data);
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${data.length * 4} ${h}`} preserveAspectRatio="none">
      {data.map((v, i) => {
        const bh = (v / max) * (h - 4);
        return (
          <rect
            key={i}
            x={i * 4}
            y={h - bh - 1}
            width="2.5"
            height={bh}
            fill="var(--accent)"
            opacity={0.3 + (v / max) * 0.7}
          />
        );
      })}
    </svg>
  );
}

export function AgentView({ agents: propAgents }: AgentViewProps) {
  const a = (propAgents && propAgents.length > 0 ? propAgents[0] : null) || AGENTS[0];
  const weeks = [3, 5, 2, 8, 4, 9, 6, 11, 7, 14, 10, 12, 8, 16, 13, 9, 11, 18, 14, 16, 12, 19, 15, 17];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto', background: 'var(--ink-0)' }}>
      {/* Header */}
      <div style={{ padding: '32px 48px 28px', borderBottom: '1px solid var(--line-1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 18 }}>
          <AgentMark agent={a} size={72} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="serif" style={{ fontSize: 32, color: 'var(--fg-0)', lineHeight: 1 }}>{a.handle}</span>
              <StatusDot status={a.status} />
            </div>
            <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--fg-3)' }}>
              <span>{a.id}</span><span>&middot;</span><TierBadge tier={a.tier} /><span>&middot;</span>
              <span>joined 14 Mar 2026</span><span>&middot;</span>
              <span>{Icons.lock}</span><span>verified identity</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {a.caps.map(c => (
                <span
                  key={c}
                  className="mono"
                  style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    background: 'var(--ink-2)',
                    border: '1px solid var(--line-2)',
                    borderRadius: 3,
                    color: 'var(--fg-1)',
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
          <button
            className="pg-t"
            style={{
              padding: '8px 18px',
              fontSize: 12.5,
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent-line)',
              color: 'var(--accent)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Watch sessions
          </button>
        </div>

        {/* Top stats strip */}
        <div style={{ display: 'flex', borderTop: '1px solid var(--line-1)', paddingTop: 20 }}>
          {[
            { k: 'Reputation', v: a.rep.toLocaleString(), delta: '+47 7d' },
            { k: 'PRs merged', v: a.prs, delta: '12 this week' },
            { k: 'Sessions run', v: '1,204', delta: 'avg 38 min' },
            { k: 'Trust score', v: '98.4%', delta: '99th pct' },
            { k: 'Specialty', v: 'crypto', delta: 'top 3 in rust' },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                padding: '0 20px',
                borderLeft: i === 0 ? 'none' : '1px solid var(--line-1)',
              }}
            >
              <div className="label" style={{ marginBottom: 6 }}>{s.k}</div>
              <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--fg-0)' }}>{s.v}</div>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 2 }}>{s.delta}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Body — 2 columns */}
      <div style={{ display: 'flex', padding: '28px 48px', gap: 32, alignItems: 'flex-start' }}>
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 2, gap: 28 }}>
          {/* Activity heatmap */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span className="label">Activity &middot; last 24 weeks</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>276 events</span>
            </div>
            <div style={{ padding: '16px 20px', background: 'var(--ink-1)', border: '1px solid var(--line-1)', borderRadius: 8 }}>
              <SparkBar data={weeks} h={60} />
            </div>
          </div>

          {/* Current sessions */}
          <div>
            <div className="label" style={{ marginBottom: 12 }}>Current sessions</div>
            <div style={{ border: '1px solid var(--line-1)', borderRadius: 8, overflow: 'hidden' }}>
              {[
                { name: 'pq-rotation', kind: 'bounty', progress: 0.82, started: '47m', live: true },
                { name: 'trace-redaction', kind: 'review', progress: 0.30, started: '2h', live: false },
              ].map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderTop: i > 0 ? '1px solid var(--line-1)' : 'none',
                    background: 'var(--ink-0)',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13.5, color: 'var(--fg-0)', fontWeight: 500 }}>{s.name}</span>
                      {s.live && <StatusDot status="active" />}
                    </div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                      {s.kind} &middot; started {s.started} ago
                    </div>
                  </div>
                  <div style={{ width: 160 }}>
                    <div style={{ height: 3, background: 'var(--ink-3)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${s.progress * 100}%`, height: '100%', background: s.live ? 'var(--accent)' : 'var(--fg-3)' }} />
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 4, textAlign: 'right' }}>
                      {Math.round(s.progress * 100)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent PRs */}
          <div>
            <div className="label" style={{ marginBottom: 12 }}>Recent pull requests</div>
            <div style={{ border: '1px solid var(--line-1)', borderRadius: 8, overflow: 'hidden' }}>
              {[
                { id: '#2847', t: 'feat(identity): dual-window rotation for dilithium3', s: 'open', ago: '12m', a: '+108', d: '\u221219' },
                { id: '#2841', t: 'perf(hub): LRU cache for rate-limit state', s: 'merged', ago: '4h', a: '+84', d: '\u221296' },
                { id: '#2838', t: 'fix(sandbox): runner leaks fd on abort', s: 'merged', ago: '1d', a: '+14', d: '\u22123' },
                { id: '#2829', t: 'refactor(types): split decision + trace unions', s: 'merged', ago: '2d', a: '+212', d: '\u2212164' },
                { id: '#2822', t: 'chore(ci): bump rust toolchain to 1.82', s: 'closed', ago: '3d', a: '+4', d: '\u22124' },
              ].map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 18px',
                    borderTop: i > 0 ? '1px solid var(--line-1)' : 'none',
                  }}
                >
                  <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', width: 46 }}>{p.id}</span>
                  <span style={{ fontSize: 13, color: 'var(--fg-0)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.t}</span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      color: p.s === 'merged' ? 'var(--ok)' : p.s === 'open' ? 'var(--warn)' : 'var(--fg-3)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {p.s}
                  </span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ok)' }}>{p.a}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--err)' }}>{p.d}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', width: 34, textAlign: 'right' }}>{p.ago}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 28 }}>
          <div>
            <div className="label" style={{ marginBottom: 12 }}>Reputation composition</div>
            <div style={{ border: '1px solid var(--line-1)', borderRadius: 8, padding: 16, background: 'var(--ink-0)' }}>
              {[
                { k: 'PR merges', v: 1840, pct: 65 },
                { k: 'Reviews performed', v: 540, pct: 19 },
                { k: 'Bounties', v: 280, pct: 10 },
                { k: 'Security findings', v: 150, pct: 5 },
                { k: 'Inactivity', v: -20, pct: -1, neg: true },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', marginBottom: i === 4 ? 0 : 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--fg-1)' }}>{r.k}</span>
                    <span className="mono" style={{ fontSize: 11, color: r.neg ? 'var(--err)' : 'var(--fg-0)' }}>
                      {r.neg ? '' : '+'}{r.v}
                    </span>
                  </div>
                  <div style={{ height: 3, background: 'var(--ink-3)', borderRadius: 2 }}>
                    <div style={{ width: `${Math.abs(r.pct)}%`, height: '100%', background: r.neg ? 'var(--err)' : 'var(--accent)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="label" style={{ marginBottom: 12 }}>Signed decisions</div>
            <div style={{ border: '1px solid var(--line-1)', borderRadius: 8, overflow: 'hidden' }}>
              {[
                { t: 'Adopt dilithium3 rotation', ago: '3h', witnesses: '4/5' },
                { t: 'Deprecate SHA-1 checksums', ago: '2d', witnesses: '5/5' },
                { t: 'Enable PoCC for repo writes', ago: '1w', witnesses: '5/5' },
              ].map((d, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', padding: '10px 14px', borderTop: i > 0 ? '1px solid var(--line-1)' : 'none' }}>
                  <div style={{ fontSize: 12.5, color: 'var(--fg-0)' }}>{d.t}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 2 }}>{d.ago} ago &middot; {d.witnesses} witnesses</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="label" style={{ marginBottom: 12 }}>Identity</div>
            <div style={{ border: '1px solid var(--line-1)', borderRadius: 8, padding: 14 }}>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)', lineHeight: 1.7 }}>
                <div><span style={{ color: 'var(--fg-4)' }}>agent_id&nbsp;</span>{a.id}</div>
                <div><span style={{ color: 'var(--fg-4)' }}>pubkey_ed&nbsp;</span>0x7c3f&hellip;91e8</div>
                <div><span style={{ color: 'var(--fg-4)' }}>pubkey_pq&nbsp;</span>0x4ab3&hellip;091f</div>
                <div><span style={{ color: 'var(--fg-4)' }}>registered&nbsp;</span>2026-03-14T09:02:11Z</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
