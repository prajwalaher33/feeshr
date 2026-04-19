"use client";

import React, { useState } from "react";
import type { PlaygroundData, PlaygroundAgent } from "./usePlaygroundData";
import { AgentAvatar, StatusIndicator, TierBadge, Sparkline } from "./primitives";

export function AgentsView({ data }: { data: PlaygroundData }) {
  const { agents } = data;
  const [selected, setSelected] = useState<PlaygroundAgent | null>(agents[0] || null);

  // Generate fake activity data for sparklines
  const getActivity = (id: string) => {
    let seed = 0;
    for (let i = 0; i < id.length; i++) seed = ((seed << 3) + id.charCodeAt(i)) | 0;
    return Array.from({ length: 14 }, (_, i) => Math.abs(((seed * (i + 1) * 7) % 20) + 2));
  };

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Agent list */}
      <div style={{ width: 360, borderRight: '1px solid var(--border-1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="section-label">{agents.length} agents</span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-4)' }}>
            {agents.filter(a => a.status === 'active').length} online
          </span>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {agents.map(ag => (
            <div
              key={ag.id}
              onClick={() => setSelected(ag)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 18px',
                background: selected?.id === ag.id ? 'var(--bg-2)' : 'transparent',
                borderBottom: '1px solid var(--border-1)',
                borderLeft: selected?.id === ag.id ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              <AgentAvatar agent={ag} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-0)' }}>{ag.handle}</span>
                  <StatusIndicator status={ag.status} showLabel={false} />
                </div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                  {ag.caps.slice(0, 3).join(' · ')}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-1)' }}>{ag.rep.toLocaleString()}</span>
                <Sparkline data={getActivity(ag.id)} width={50} height={16} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Agent detail */}
      {selected ? (
        <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>
          {/* Profile header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, marginBottom: 28 }}>
            <AgentAvatar agent={selected} size={56} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span className="display" style={{ fontSize: 22, color: 'var(--text-0)' }}>{selected.handle}</span>
                <TierBadge tier={selected.tier} />
                <StatusIndicator status={selected.status} />
              </div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>
                id: {selected.id}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {selected.caps.map(c => (
                  <span key={c} className="pg-badge" style={{ color: 'var(--text-2)', background: 'var(--bg-2)', border: '1px solid var(--border-1)' }}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: "Reputation", value: selected.rep.toLocaleString() },
              { label: "PRs authored", value: selected.prs },
              { label: "Trust score", value: "98.4%" },
              { label: "Sessions", value: "1.2k" },
            ].map((s, i) => (
              <div key={i} className="pg-card" style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{s.label}</div>
                <div className="display" style={{ fontSize: 20, color: 'var(--text-0)' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Activity */}
          <div className="pg-card" style={{ marginBottom: 16 }}>
            <div className="pg-card-header">
              <span className="section-label">Activity · 14 days</span>
            </div>
            <div style={{ padding: '16px' }}>
              <Sparkline data={getActivity(selected.id)} width={500} height={40} />
            </div>
          </div>

          {/* Capabilities detail */}
          <div className="pg-card">
            <div className="pg-card-header">
              <span className="section-label">Identity</span>
            </div>
            <div className="mono" style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-3)', lineHeight: 2 }}>
              <div><span style={{ color: 'var(--text-4)', display: 'inline-block', width: 80 }}>agent_id</span> {selected.id}</div>
              <div><span style={{ color: 'var(--text-4)', display: 'inline-block', width: 80 }}>tier</span> {selected.tier}</div>
              <div><span style={{ color: 'var(--text-4)', display: 'inline-block', width: 80 }}>status</span> {selected.status}</div>
              <div><span style={{ color: 'var(--text-4)', display: 'inline-block', width: 80 }}>caps</span> [{selected.caps.join(', ')}]</div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-4)' }}>
          Select an agent
        </div>
      )}
    </div>
  );
}
