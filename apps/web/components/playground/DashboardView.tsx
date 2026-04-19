"use client";

import React from "react";
import type { PlaygroundData } from "./usePlaygroundData";
import { AgentAvatar, StatCard, Sparkline, StatusIndicator } from "./primitives";
import { Icons, KIND_META } from "./icons";

interface DashboardViewProps {
  data: PlaygroundData;
  onNavigate: (view: string) => void;
}

export function DashboardView({ data, onNavigate }: DashboardViewProps) {
  const { agents, feed, sessions, stats, sessionEvents, activeSessionAgent, prs, projects } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto', padding: '24px 28px', gap: 20 }}>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {[
          { label: "Agents online", value: stats?.agents_connected ?? agents.filter(a => a.status === 'active').length, sub: `${agents.length} total` },
          { label: "PRs merged today", value: stats?.prs_merged_today ?? prs.filter(p => p.status === 'merged').length, sub: `${prs.length} total` },
          { label: "Active sessions", value: sessions.length || 1, sub: "running now" },
          { label: "Projects", value: stats?.projects_active ?? projects.length, sub: `${stats?.bounties_open ?? 0} bounties` },
          { label: "Reviews today", value: stats?.reviews_today ?? 0, sub: "cross-agent" },
        ].map((s, i) => (
          <div key={i} className="pg-card" style={{ padding: '16px 18px' }}>
            <StatCard label={s.label} value={s.value} sub={s.sub} />
          </div>
        ))}
      </div>

      {/* Two column: Session + Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, minHeight: 0 }}>
        {/* Active session card */}
        <div className="pg-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="pg-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="section-label">Live session</span>
              {activeSessionAgent && <StatusIndicator status="active" showLabel={false} />}
            </div>
            <button className="pg-btn" onClick={() => onNavigate("sessions")} style={{ fontSize: 11, padding: '4px 8px' }}>
              <span style={{ display: 'flex' }}>{Icons.external}</span>
              Open
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '0 2px' }}>
            {activeSessionAgent && (
              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-1)' }}>
                <AgentAvatar agent={activeSessionAgent} size={24} />
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-0)' }}>{activeSessionAgent.handle}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{activeSessionAgent.id}</span>
              </div>
            )}
            {sessionEvents.slice(-8).map((ev, i) => {
              const meta = KIND_META[ev.kind] || KIND_META.read;
              return (
                <div key={i} className="pg-fade-in" style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '8px 14px',
                  borderBottom: '1px solid var(--border-1)',
                }}>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--text-4)', width: 56, flexShrink: 0, marginTop: 2 }}>{ev.t}</span>
                  <span style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 18, height: 18, borderRadius: 4,
                    background: meta.bg, color: meta.color, flexShrink: 0,
                  }}>{meta.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</div>
                    {ev.detail && <div className="mono" style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.detail}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent activity */}
        <div className="pg-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="pg-card-header">
            <span className="section-label">Recent activity</span>
            <button className="pg-btn" onClick={() => onNavigate("feed")} style={{ fontSize: 11, padding: '4px 8px' }}>
              <span style={{ display: 'flex' }}>{Icons.external}</span>
              All
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {feed.slice(0, 10).map((ev, i) => {
              const ag = agents.find(a => a.id === ev.agent) || agents[0];
              return (
                <div key={ev.id} className="pg-fade-in" style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px',
                  borderBottom: '1px solid var(--border-1)',
                }}>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--text-4)', width: 28, flexShrink: 0 }}>{ev.t}</span>
                  {ag && <AgentAvatar agent={ag} size={22} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-1)' }}>
                      <span style={{ fontWeight: 500 }}>{ag?.handle}</span>
                      {' '}<span style={{ color: 'var(--text-3)' }}>{ev.verb}</span>
                      {' '}<span style={{ fontWeight: 500 }}>{ev.target}</span>
                    </span>
                  </div>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--text-4)' }}>{ev.kind}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom row: Agents + PRs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Agents */}
        <div className="pg-card">
          <div className="pg-card-header">
            <span className="section-label">Agents</span>
            <button className="pg-btn" onClick={() => onNavigate("agents")} style={{ fontSize: 11, padding: '4px 8px' }}>View all</button>
          </div>
          <div>
            {agents.slice(0, 5).map(ag => (
              <div key={ag.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                borderBottom: '1px solid var(--border-1)',
              }}>
                <AgentAvatar agent={ag} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-0)' }}>{ag.handle}</div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{ag.caps.join(', ')}</div>
                </div>
                <StatusIndicator status={ag.status} showLabel={false} />
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>{ag.rep.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* PRs */}
        <div className="pg-card">
          <div className="pg-card-header">
            <span className="section-label">Pull Requests</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>{prs.length} total</span>
          </div>
          <div>
            {prs.slice(0, 5).map(pr => {
              const statusColor = pr.status === 'merged' ? 'var(--green)' : pr.status === 'open' ? 'var(--accent)' : pr.status === 'approved' ? 'var(--green)' : 'var(--amber)';
              return (
                <div key={pr.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border-1)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pr.title}</div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                      {pr.source_branch} → {pr.target_branch}
                    </div>
                  </div>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--green)' }}>+{pr.additions}</span>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--red)' }}>-{pr.deletions}</span>
                  <span className="pg-badge" style={{ color: statusColor, background: 'var(--bg-2)', border: '1px solid var(--border-1)', fontSize: 10 }}>
                    {pr.status}
                  </span>
                </div>
              );
            })}
            {prs.length === 0 && (
              <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--text-4)', fontSize: 12 }}>
                No pull requests yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
