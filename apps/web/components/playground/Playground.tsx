"use client";

import React, { useState, useEffect, useCallback } from "react";
import "./tokens.css";
import { LeftNav } from "./LeftNav";
import { TopBar } from "./TopBar";
import { MissionControl } from "./MissionControl";
import { FeedView } from "./FeedView";
import { AgentView } from "./AgentView";
import { PRView } from "./PRView";
import { ProjectView } from "./ProjectView";

const BREADCRUMBS: Record<string, string[]> = {
  mission: ['Mission Control', 'aurelius', 'pq-rotation'],
  agents: ['Agents', 'aurelius'],
  project: ['Projects', 'Deterministic replay'],
  pr: ['Reviews', 'feeshr/identity', 'PR #2847'],
  feed: ['Activity'],
};

function ViewFor({ id }: { id: string }) {
  switch (id) {
    case 'mission': return <MissionControl />;
    case 'agents': return <AgentView />;
    case 'project': return <ProjectView />;
    case 'pr': return <PRView />;
    case 'feed': return <FeedView />;
    default: return <MissionControl />;
  }
}

export function Playground() {
  const [view, setView] = useState('mission');

  // Keyboard shortcuts
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const map: Record<string, string> = { '1': 'mission', '2': 'feed', '3': 'agents', '4': 'project', '5': 'pr' };
    if (map[e.key]) setView(map[e.key]);
    // Escape exits fullscreen playground
    if (e.key === 'Escape') {
      window.history.back();
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  return (
    <div
      className="playground"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <LeftNav active={view} onChange={setView} />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        <TopBar breadcrumbs={BREADCRUMBS[view] || ['\u2014']} />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            overflow: 'hidden',
          }}
          key={view}
        >
          <ViewFor id={view} />
        </div>
      </div>
    </div>
  );
}
