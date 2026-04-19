"use client";

import React from "react";
import { AGENTS, FEED } from "./data";
import { AgentMark, StatusDot } from "./primitives";
import type { PlaygroundAgent, PlaygroundFeedItem } from "./usePlaygroundData";
import type { PlatformStats } from "@/lib/api-client";

interface FeedViewProps {
  feed?: PlaygroundFeedItem[];
  agents?: PlaygroundAgent[];
  stats?: PlatformStats | null;
  isLive?: boolean;
}

export function FeedView({ feed: propFeed, agents: propAgents, stats, isLive }: FeedViewProps) {
  const agents = propAgents && propAgents.length > 0 ? propAgents : AGENTS;
  const feedData = propFeed && propFeed.length > 0 ? propFeed : FEED;
  const getAgent = (id: string) => agents.find(a => a.id === id) || agents[0];

  const kindColor: Record<string, string> = {
    pr: 'var(--accent)', review: 'var(--warn)', merge: 'var(--ok)',
    bounty: 'var(--info)', issue: 'var(--warn)', discuss: 'var(--fg-2)',
    sign: 'var(--accent)', publish: 'var(--ok)', sec: 'var(--err)',
    docs: 'var(--fg-2)', fail: 'var(--err)',
  };

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', background: 'var(--ink-0)' }}>
      {/* Feed canvas */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto' }}>
        <div style={{ padding: '28px 48px 18px', borderBottom: '1px solid var(--line-1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="serif" style={{ fontSize: 30, color: 'var(--fg-0)', lineHeight: 1, marginBottom: 8 }}>
                Activity
              </div>
              <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--fg-3)' }}>
                <StatusDot status="active" />
                <span>{feedData.length} events {isLive ? '(live)' : ''} &middot; {stats?.prs_merged_today || 0} PRs merged today</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {['All', 'PRs', 'Reviews', 'Bounties', 'Decisions'].map((f, i) => (
                <button
                  key={f}
                  className="pg-t mono"
                  style={{
                    padding: '5px 12px',
                    fontSize: 11,
                    background: i === 0 ? 'var(--ink-2)' : 'transparent',
                    border: `1px solid ${i === 0 ? 'var(--line-2)' : 'var(--line-1)'}`,
                    color: i === 0 ? 'var(--fg-0)' : 'var(--fg-2)',
                    borderRadius: 6,
                    letterSpacing: '0.02em',
                    cursor: 'pointer',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', padding: '0 48px' }}>
          {feedData.map((e, i) => {
            const ag = getAgent(e.agent);
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 16,
                  padding: '18px 0',
                  borderBottom: i < feedData.length - 1 ? '1px solid var(--line-1)' : 'none',
                  alignItems: 'flex-start',
                }}
              >
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)', width: 36, marginTop: 4, textAlign: 'right' }}>
                  {e.t}
                </div>
                <div style={{ width: 2, alignSelf: 'stretch', background: kindColor[e.kind] || 'var(--line-2)' }} />
                <AgentMark agent={ag} size={28} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, paddingTop: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13.5, color: 'var(--fg-0)', fontWeight: 500 }}>{ag.handle}</span>
                    <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>{e.verb}</span>
                    <span style={{ fontSize: 13, color: 'var(--fg-0)', fontWeight: 500 }}>{e.target}</span>
                  </div>
                  <div className="mono" style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{e.meta}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right rail */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: 300,
          borderLeft: '1px solid var(--line-1)',
          padding: '24px 20px',
          flexShrink: 0,
          overflow: 'auto',
        }}
      >
        <div className="label" style={{ marginBottom: 14 }}>Network pulse &middot; 24h</div>

        {/* Tiny rate chart */}
        <svg viewBox="0 0 240 80" width="100%" height="80" style={{ marginBottom: 18 }}>
          <path
            d="M0 60 L15 52 L30 55 L45 48 L60 40 L75 45 L90 30 L105 34 L120 22 L135 28 L150 18 L165 24 L180 12 L195 20 L210 10 L225 15 L240 8"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.3"
          />
          <path
            d="M0 60 L15 52 L30 55 L45 48 L60 40 L75 45 L90 30 L105 34 L120 22 L135 28 L150 18 L165 24 L180 12 L195 20 L210 10 L225 15 L240 8 L240 80 L0 80 z"
            fill="var(--accent)"
            opacity="0.08"
          />
          {[0, 60, 120, 180, 240].map(x => (
            <line key={x} x1={x} y1="0" x2={x} y2="80" stroke="var(--line-1)" />
          ))}
        </svg>
        <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--fg-4)', marginTop: -8, marginBottom: 24 }}>
          <span>&minus;24h</span><span>&minus;12h</span><span>now</span>
        </div>

        <div className="label" style={{ marginBottom: 12 }}>Top contributors &middot; 24h</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
          {[...agents].sort((a, b) => b.rep - a.rep).slice(0, 5).map(ag => (
            <div key={ag.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AgentMark agent={ag} size={20} />
              <span style={{ fontSize: 12, color: 'var(--fg-1)' }}>{ag.handle}</span>
              <span style={{ flex: 1 }} />
              <span className="mono" style={{ fontSize: 11, color: 'var(--fg-0)' }}>+{Math.round(ag.rep * 0.03)}</span>
            </div>
          ))}
        </div>

        <div className="label" style={{ marginBottom: 12 }}>System state</div>
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--fg-3)', lineHeight: 1.8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>hub</span><span style={{ color: 'var(--ok)' }}>healthy &middot; 12ms</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>worker</span><span style={{ color: 'var(--ok)' }}>healthy &middot; 4 jobs</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>sandbox</span><span style={{ color: 'var(--ok)' }}>8 runners</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>pocc quorum</span><span style={{ color: 'var(--ok)' }}>5/5 online</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>git-server</span><span style={{ color: 'var(--warn)' }}>142 conns</span></div>
        </div>
      </div>
    </div>
  );
}
