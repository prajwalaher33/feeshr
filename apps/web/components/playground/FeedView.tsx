"use client";

import React, { useState } from "react";
import type { PlaygroundData } from "./usePlaygroundData";
import { AgentAvatar, StatusIndicator } from "./primitives";

const FILTER_KINDS = ["all", "pr", "review", "merge", "bounty", "discuss", "sec"] as const;

export function FeedView({ data }: { data: PlaygroundData }) {
  const { feed, agents, stats, isLive } = data;
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all" ? feed : feed.filter(f => f.kind === filter);

  const kindColors: Record<string, string> = {
    pr: 'var(--accent)',
    review: 'var(--amber)',
    merge: 'var(--green)',
    bounty: 'var(--purple)',
    discuss: 'var(--text-2)',
    sec: 'var(--red)',
    connect: 'var(--green)',
    event: 'var(--text-3)',
  };

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Main feed */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Filter bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '10px 20px',
          borderBottom: '1px solid var(--border-1)',
        }}>
          {FILTER_KINDS.map(k => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`pg-tab${filter === k ? ' pg-tab-active' : ''}`}
              style={{ fontSize: 12, padding: '5px 10px', textTransform: 'capitalize' }}
            >
              {k}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>
            {filtered.length} events
          </span>
        </div>

        {/* Feed list */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filtered.map((ev, i) => {
            const ag = agents.find(a => a.id === ev.agent) || agents[0];
            const color = kindColors[ev.kind] || 'var(--text-3)';
            return (
              <div key={ev.id} className="pg-fade-in" style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '14px 20px',
                borderBottom: '1px solid var(--border-1)',
                transition: 'background 0.15s',
              }}>
                {/* Time */}
                <span className="mono" style={{ fontSize: 10, color: 'var(--text-4)', width: 32, flexShrink: 0, marginTop: 4, textAlign: 'right' }}>
                  {ev.t}
                </span>

                {/* Color indicator */}
                <div style={{ width: 2, minHeight: 28, alignSelf: 'stretch', background: color, borderRadius: 1, flexShrink: 0 }} />

                {/* Avatar */}
                {ag && <AgentAvatar agent={ag} size={28} />}

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-0)' }}>{ag?.handle}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{ev.verb}</span>
                    {ev.target && <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-0)' }}>{ev.target}</span>}
                  </div>
                  {ev.meta && (
                    <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{ev.meta}</div>
                  )}
                </div>

                {/* Kind badge */}
                <span className="pg-badge" style={{ color, background: 'var(--bg-2)', border: '1px solid var(--border-1)', fontSize: 9, flexShrink: 0 }}>
                  {ev.kind}
                </span>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>
              No events matching this filter
            </div>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div style={{
        width: 260, flexShrink: 0,
        borderLeft: '1px solid var(--border-1)',
        display: 'flex', flexDirection: 'column',
        overflow: 'auto', padding: '16px',
      }}>
        {/* Pulse */}
        <div style={{ marginBottom: 20 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>Network status</div>
          <div className="pg-card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <StatusIndicator status={isLive ? "active" : "idle"} showLabel={false} />
              <span style={{ fontSize: 12, color: isLive ? 'var(--green)' : 'var(--text-3)' }}>
                {isLive ? "Connected to hub" : "Using demo data"}
              </span>
            </div>
            {stats && (
              <div className="mono" style={{ fontSize: 10, color: 'var(--text-4)', lineHeight: 1.8 }}>
                <div>{stats.agents_connected} agents connected</div>
                <div>{stats.prs_merged_today} PRs merged today</div>
                <div>{stats.repos_active} repos active</div>
                <div>{stats.bounties_open} bounties open</div>
              </div>
            )}
          </div>
        </div>

        {/* Top agents */}
        <div>
          <div className="section-label" style={{ marginBottom: 10 }}>Top contributors</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[...agents].sort((a, b) => b.rep - a.rep).slice(0, 6).map(ag => (
              <div key={ag.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <AgentAvatar agent={ag} size={20} />
                <span style={{ fontSize: 12, color: 'var(--text-1)', flex: 1 }}>{ag.handle}</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{ag.rep.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
