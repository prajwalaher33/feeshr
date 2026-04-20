"use client";

import React from "react";
import type { PlaygroundEvent } from "@feeshr/types";
import { AgentHueDot } from "@/components/agent/AgentHueDot";

// ─── Types ──────────────────────────────────────────────────────────────────

export type PinnedEntity =
  | { type: "agent"; id: string; name: string }
  | { type: "repo"; id: string; name: string }
  | { type: "pr"; id: string; name: string }
  | { type: "project"; id: string; name: string }
  | { type: "bounty"; id: string; name: string }
  | null;

export interface FocusDrawerProps {
  entity: PinnedEntity;
  events: PlaygroundEvent[];
  onClose: () => void;
}

// ─── Tab definitions per entity type ────────────────────────────────────────

const ENTITY_TABS: Record<string, string[]> = {
  agent: ["Activity", "Reputation", "Reviews", "Signature"],
  repo: ["Tree", "PRs", "Contributors"],
  pr: ["Diff", "Reviews", "Checks", "Timeline"],
  project: ["Status", "Team", "Timeline"],
  bounty: ["Details", "Claims", "Timeline"],
};

// ─── Component ──────────────────────────────────────────────────────────────

export function FocusDrawer({ entity, events, onClose }: FocusDrawerProps) {
  const [activeTab, setActiveTab] = React.useState(0);

  // Reset tab when entity changes
  React.useEffect(() => {
    setActiveTab(0);
  }, [entity?.id]);

  if (!entity) {
    return (
      <div style={drawerContainerStyle}>
        <div style={emptyStyle}>
          <span style={{ color: "var(--ink-3)", fontSize: "var(--fs-sm)", fontStyle: "italic" }}>
            Pin anything to inspect.
          </span>
        </div>
      </div>
    );
  }

  const tabs = ENTITY_TABS[entity.type] || ["Details"];
  const entityEvents = events.filter(
    ev => ev.actor_id === entity.id || ev.target_id === entity.id
  );

  return (
    <div style={drawerContainerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <AgentHueDot agentId={entity.id} size={8} />
        <span style={{ fontWeight: 600, color: "var(--ink-0)", fontSize: "var(--fs-sm)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {entity.name}
        </span>
        <span className="v7-micro-label" style={{ fontSize: 9, color: "var(--ink-4)", textTransform: "uppercase" }}>
          {entity.type}
        </span>
        <button
          onClick={onClose}
          className="v7-focus-ring"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 14, padding: "2px 6px", lineHeight: 1 }}
          aria-label="Close drawer"
        >
          &times;
        </button>
      </div>

      {/* Tabs */}
      <div style={tabBarStyle}>
        {tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className="v7-focus-ring"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px",
              fontSize: "var(--fs-xs)",
              color: activeTab === i ? "var(--phos-500)" : "var(--ink-3)",
              borderBottom: activeTab === i ? "1px solid var(--phos-500)" : "1px solid transparent",
              fontFamily: "inherit",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={contentStyle}>
        {activeTab === 0 ? (
          <ActivityTab events={entityEvents} entityId={entity.id} />
        ) : (
          <PlaceholderTab name={tabs[activeTab]} />
        )}
      </div>
    </div>
  );
}

// ─── Tab Content ────────────────────────────────────────────────────────────

function ActivityTab({ events, entityId }: { events: PlaygroundEvent[]; entityId: string }) {
  if (events.length === 0) {
    return (
      <div style={{ padding: 16, color: "var(--ink-4)", fontSize: "var(--fs-xs)" }}>
        No activity recorded yet.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {events.slice(-20).reverse().map(ev => (
        <div
          key={ev.id}
          style={{
            padding: "8px 12px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <AgentHueDot agentId={ev.actor_id} size={6} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--ink-1)", display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ fontWeight: 500 }}>{ev.actor_name}</span>
              <span style={{ color: "var(--ink-3)" }}>{ev.type.split(".")[1]}</span>
              {ev.target_name && (
                <span style={{ color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ev.target_name}
                </span>
              )}
            </div>
            {ev.detail && (
              <div className="v7-mono" style={{ fontSize: 9, color: "var(--ink-4)", marginTop: 2 }}>
                {ev.detail}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <span className="v7-mono" style={{ fontSize: 9, color: "var(--ink-4)" }}>
                {formatTime(ev.ts)}
              </span>
              {ev.sig && (
                <span className="v7-mono" style={{ fontSize: 9, color: "var(--ink-4)", opacity: 0.6 }}>
                  sig:{ev.sig.slice(0, 12)}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PlaceholderTab({ name }: { name: string }) {
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Shimmer skeleton */}
      {[1, 2, 3].map(i => (
        <div
          key={i}
          style={{
            height: 12,
            width: `${60 + i * 10}%`,
            background: "var(--bg-2)",
            borderRadius: 4,
            animation: "v7-pulse 1.5s ease-in-out infinite",
          }}
        />
      ))}
      <span style={{ fontSize: "var(--fs-xs)", color: "var(--ink-4)", marginTop: 8 }}>
        {name} panel — Phase 5+
      </span>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const drawerContainerStyle: React.CSSProperties = {
  width: 360,
  flexShrink: 0,
  borderLeft: "1px solid var(--line)",
  background: "var(--bg-0)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const emptyStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const headerStyle: React.CSSProperties = {
  height: 40,
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "0 12px",
  borderBottom: "1px solid var(--line)",
  flexShrink: 0,
};

const tabBarStyle: React.CSSProperties = {
  display: "flex",
  gap: 0,
  borderBottom: "1px solid var(--line)",
  padding: "0 8px",
  flexShrink: 0,
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  overflowX: "hidden",
};

// ─── Utility ────────────────────────────────────────────────────────────────

function formatTime(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
