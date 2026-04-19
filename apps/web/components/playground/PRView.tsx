"use client";

import React from "react";
import { AGENTS, PR_DATA } from "./data";
import { AgentMark } from "./primitives";
import { Icons } from "./icons";

export function PRView() {
  const p = PR_DATA;
  const getAgent = (handle: string) => AGENTS.find(a => a.handle === handle) || AGENTS[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto', background: 'var(--ink-0)' }}>
      {/* Header */}
      <div style={{ padding: '28px 48px 22px', borderBottom: '1px solid var(--line-1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span className="mono" style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{p.repo}</span>
          <span style={{ color: 'var(--fg-4)' }}>&middot;</span>
          <span className="mono" style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{p.id}</span>
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
        </div>
        <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--fg-0)', letterSpacing: '-0.015em', marginBottom: 12, maxWidth: 900 }}>
          {p.title}
        </div>
        <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, color: 'var(--fg-3)' }}>
          <AgentMark agent={getAgent(p.author)} size={18} />
          <span>
            <span style={{ color: 'var(--fg-1)' }}>{p.author}</span> wants to merge {p.commits} commits into
          </span>
          <span className="mono" style={{ padding: '1px 6px', background: 'var(--ink-2)', border: '1px solid var(--line-2)', borderRadius: 3, color: 'var(--fg-1)' }}>
            {p.base}
          </span>
          <span>from</span>
          <span className="mono" style={{ padding: '1px 6px', background: 'var(--ink-2)', border: '1px solid var(--line-2)', borderRadius: 3, color: 'var(--fg-1)' }}>
            {p.head}
          </span>
        </div>
      </div>

      {/* Checks strip + stats */}
      <div style={{ display: 'flex', padding: '0 48px', borderBottom: '1px solid var(--line-1)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '18px 0' }}>
          <div className="label" style={{ marginBottom: 10 }}>Continuous integration</div>
          <div style={{ border: '1px solid var(--line-1)', borderRadius: 8, overflow: 'hidden' }}>
            {p.checks.map((c, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '10px 14px',
                  borderTop: i > 0 ? '1px solid var(--line-1)' : 'none',
                }}
              >
                <span style={{ color: 'var(--ok)' }}>{Icons.check}</span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--fg-0)', flex: 1 }}>{c.name}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>{(c.ms / 1000).toFixed(1)}s</span>
                <span className="mono" style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--ok)', textTransform: 'uppercase' }}>pass</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', padding: '18px 0 18px 32px', width: 320, borderLeft: '1px solid var(--line-1)', marginLeft: 32 }}>
          <div className="label" style={{ marginBottom: 10 }}>Reviewers</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {p.reviews.map((r, i) => {
              const ag = getAgent(r.who);
              const state = r.state === 'changes'
                ? { c: 'var(--warn)', l: 'Changes requested' }
                : { c: 'var(--fg-3)', l: 'Pending' };
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AgentMark agent={ag} size={22} />
                  <span style={{ fontSize: 12.5, color: 'var(--fg-0)', flex: 1 }}>{r.who}</span>
                  <span className="mono" style={{ fontSize: 10, color: state.c, letterSpacing: '0.04em' }}>{state.l}</span>
                </div>
              );
            })}
          </div>

          <div className="label" style={{ marginBottom: 10 }}>Changes</div>
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--fg-2)', lineHeight: 1.7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Files changed</span><span>{p.files}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Commits</span><span>{p.commits}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Additions</span><span style={{ color: 'var(--ok)' }}>+{p.added}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Removals</span><span style={{ color: 'var(--err)' }}>&minus;{p.removed}</span></div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ padding: '28px 48px' }}>
        <div className="label" style={{ marginBottom: 18 }}>Timeline</div>
        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 11, top: 10, bottom: 10, width: 1, background: 'var(--line-1)' }} />
          {[
            { who: 'aurelius', when: '47m', kind: 'open', text: 'opened this pull request' },
            { who: 'aurelius', when: '42m', kind: 'commit', text: 'pushed 7c3f91e \u00b7 feat(identity): dual-window rotation' },
            { who: 'nautilus', when: '14m', kind: 'review', text: 'requested changes \u2014 "add property test for replay across epoch boundary"' },
            { who: 'aurelius', when: '9m', kind: 'commit', text: 'pushed a8d120b \u00b7 test: proptest for epoch replay rejection' },
            { who: 'system', when: '4m', kind: 'ci', text: '6/6 checks pass \u00b7 sandbox \u00b7 gvisor-runner#08a1' },
            { who: 'aurelius', when: '2m', kind: 'push', text: 'pushed to PR \u00b7 awaiting re-review' },
          ].map((t, i) => {
            const colorMap: Record<string, string> = { open: 'var(--accent)', commit: 'var(--fg-2)', review: 'var(--warn)', ci: 'var(--ok)', push: 'var(--accent)' };
            return (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0', position: 'relative' }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'var(--ink-0)',
                    border: `1.5px solid ${colorMap[t.kind] || 'var(--fg-3)'}`,
                    zIndex: 1,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: colorMap[t.kind] || 'var(--fg-3)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, padding: '2px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--fg-0)', fontWeight: 500 }}>{t.who}</span>
                    <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>{t.text}</span>
                  </div>
                  <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{t.when} ago</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
