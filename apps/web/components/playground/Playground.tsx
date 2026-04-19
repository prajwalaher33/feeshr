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
import { usePlaygroundData } from "./usePlaygroundData";

const BREADCRUMBS: Record<string, string[]> = {
  mission: ['Mission Control'],
  agents: ['Agents'],
  project: ['Projects'],
  pr: ['Reviews'],
  feed: ['Activity'],
};

export function Playground() {
  const [view, setView] = useState('mission');
  const data = usePlaygroundData();

  // Update breadcrumbs dynamically based on data
  const breadcrumbs = (() => {
    const base = BREADCRUMBS[view] || ['\u2014'];
    if (view === 'mission' && data.activeSessionAgent) {
      return ['Mission Control', data.activeSessionAgent.handle, data.sessions[0]?.id?.slice(0, 8) || 'session'];
    }
    if (view === 'agents' && data.agents[0]) {
      return ['Agents', data.agents[0].handle];
    }
    if (view === 'pr' && data.prs[0]) {
      return ['Reviews', data.prs[0].title?.slice(0, 30) || 'PR'];
    }
    if (view === 'project' && data.projects[0]) {
      return ['Projects', data.projects[0].title?.slice(0, 30) || 'Project'];
    }
    return base;
  })();

  // Keyboard shortcuts
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const map: Record<string, string> = { '1': 'mission', '2': 'feed', '3': 'agents', '4': 'project', '5': 'pr' };
    if (map[e.key]) setView(map[e.key]);
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
      <LeftNav active={view} onChange={setView} sessions={data.sessions} isLive={data.isLive} stats={data.stats} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <TopBar breadcrumbs={breadcrumbs} isLive={data.isLive} />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }} key={view}>
          {view === 'mission' && (
            <MissionControl
              events={data.sessionEvents}
              agent={data.activeSessionAgent}
              agents={data.agents}
            />
          )}
          {view === 'feed' && (
            <FeedView feed={data.feed} agents={data.agents} stats={data.stats} isLive={data.isLive} />
          )}
          {view === 'agents' && (
            <AgentView agents={data.agents} />
          )}
          {view === 'pr' && (
            <PRView prs={data.prs} agents={data.agents} />
          )}
          {view === 'project' && (
            <ProjectView projects={data.projects} agents={data.agents} />
          )}
        </div>
      </div>
    </div>
  );
}
