"use client";

import React, { useState, useEffect, useCallback } from "react";
import "./tokens.css";
import { usePlaygroundData } from "./usePlaygroundData";
import { Icons } from "./icons";
import { StatusIndicator } from "./primitives";
import { DashboardView } from "./DashboardView";
import { SessionView } from "./SessionView";
import { AgentsView } from "./AgentsView";
import { FeedView } from "./FeedView";

type View = "dashboard" | "sessions" | "agents" | "feed";

const NAV: { id: View; label: string; icon: React.ReactNode; key: string }[] = [
  { id: "dashboard", label: "Overview", icon: Icons.dashboard, key: "1" },
  { id: "sessions", label: "Sessions", icon: Icons.session, key: "2" },
  { id: "agents", label: "Agents", icon: Icons.agents, key: "3" },
  { id: "feed", label: "Activity", icon: Icons.activity, key: "4" },
];

export function Playground() {
  const [view, setView] = useState<View>("dashboard");
  const data = usePlaygroundData();

  // Keyboard shortcuts
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const map: Record<string, View> = { "1": "dashboard", "2": "sessions", "3": "agents", "4": "feed" };
    if (map[e.key]) setView(map[e.key]);
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return (
    <div className="playground" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--border-1)',
        background: 'var(--bg-0)',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: '16px 16px 14px', borderBottom: '1px solid var(--border-1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6,
              background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 4h8M2 8h5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div className="display" style={{ fontSize: 14, color: 'var(--text-0)', lineHeight: 1 }}>Feeshr</div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 2 }}>playground</div>
            </div>
            <span style={{ flex: 1 }} />
            {data.isLive && <span className="pg-live-dot" />}
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ padding: '8px', flex: 1, overflow: 'auto' }}>
          <div className="section-label" style={{ padding: '8px 10px 6px' }}>Navigation</div>
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className="pg-tab"
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '8px 10px',
                marginBottom: 1,
                ...(view === item.id ? {
                  color: 'var(--text-0)',
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border-2)',
                } : {}),
              }}
            >
              <span style={{ color: view === item.id ? 'var(--accent)' : 'var(--text-3)', display: 'flex' }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              <span className="pg-kbd">{item.key}</span>
            </button>
          ))}

          {/* Active sessions in sidebar */}
          {data.sessions.length > 0 && (
            <>
              <div className="section-label" style={{ padding: '20px 10px 6px' }}>Live sessions</div>
              {data.sessions.slice(0, 4).map(s => (
                <button
                  key={s.id}
                  className="pg-tab"
                  onClick={() => { data.selectSession(s); setView("sessions"); }}
                  style={{ width: '100%', textAlign: 'left', padding: '6px 10px' }}
                >
                  <StatusIndicator status={s.status} showLabel={false} />
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>{s.agentHandle}</span>
                  <span style={{ color: 'var(--text-4)', fontSize: 11 }}>{s.id.slice(0, 6)}</span>
                </button>
              ))}
            </>
          )}
        </nav>

        {/* Bottom */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusIndicator status={data.isLive ? "active" : "idle"} showLabel={false} />
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {data.isLive ? "Connected" : "Offline"}
            </span>
          </div>
          {data.stats && (
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 4 }}>
              {data.stats.agents_connected} agents online
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <main style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {/* Top bar */}
        <header style={{
          height: 48, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px',
          borderBottom: '1px solid var(--border-1)',
          background: 'var(--bg-0)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-0)' }}>
              {NAV.find(n => n.id === view)?.label}
            </span>
            {data.isLive && (
              <span className="pg-badge" style={{ color: 'var(--green)', background: 'var(--green-dim)', border: '1px solid var(--green-border)' }}>
                Live
              </span>
            )}
            {!data.isLive && (
              <span className="pg-badge" style={{ color: 'var(--text-4)', background: 'var(--bg-2)', border: '1px solid var(--border-1)' }}>
                Demo
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 10px', borderRadius: 6,
              background: 'var(--bg-1)', border: '1px solid var(--border-1)',
              width: 220, color: 'var(--text-4)',
            }}>
              <span style={{ display: 'flex' }}>{Icons.search}</span>
              <span style={{ fontSize: 12 }}>Search...</span>
              <span style={{ flex: 1 }} />
              <span className="pg-kbd">K</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {view === "dashboard" && <DashboardView data={data} onNavigate={(v) => setView(v as View)} />}
          {view === "sessions" && <SessionView data={data} />}
          {view === "agents" && <AgentsView data={data} />}
          {view === "feed" && <FeedView data={data} />}
        </div>
      </main>
    </div>
  );
}
