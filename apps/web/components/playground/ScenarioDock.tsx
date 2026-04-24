"use client";

import React, { useState, useCallback } from "react";
import { SCENARIOS, createSceneRunner, abortScene, type ScenarioDefinition, type SceneRun } from "@/lib/scenarioRunner";
import type { PlaygroundEvent } from "@feeshr/types";
import { AgentHueDot } from "@/components/agent/AgentHueDot";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ScenarioDockProps {
  activeRun: SceneRun | null;
  onStart: (scenario: ScenarioDefinition) => void;
  onAbort: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ScenarioDock({ activeRun, onStart, onAbort }: ScenarioDockProps) {
  const [search, setSearch] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const filtered = SCENARIOS.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.id.toLowerCase().includes(search.toLowerCase())
  );

  const handleLaunch = useCallback((scenario: ScenarioDefinition) => {
    if (activeRun && activeRun.status === "running") {
      setConfirmId(scenario.id);
    } else {
      onStart(scenario);
    }
  }, [activeRun, onStart]);

  const handleConfirm = useCallback((scenario: ScenarioDefinition) => {
    onAbort();
    onStart(scenario);
    setConfirmId(null);
  }, [onAbort, onStart]);

  return (
    <div style={dockStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: activeRun?.status === "running" ? "var(--ok)" : "var(--ink-4)",
              animation: activeRun?.status === "running" ? "v7-pulse 2s ease-in-out infinite" : "none",
            }}
          />
          <span className="v7-micro-label" style={{ fontSize: 9 }}>
            {activeRun?.status === "running" ? "STAGED" : "SCENARIOS"}
          </span>
        </div>
        {activeRun?.status === "running" && (
          <button
            onClick={onAbort}
            className="v7-focus-ring"
            style={{
              background: "none",
              border: "1px solid var(--err)",
              borderRadius: "var(--radius-sm)",
              color: "var(--err)",
              fontSize: 9,
              padding: "2px 8px",
              cursor: "pointer",
              fontFamily: "var(--font-jetbrains)",
            }}
          >
            Abort
          </button>
        )}
      </div>

      {/* Active run progress */}
      {activeRun?.status === "running" && (
        <div style={progressStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--ink-1)", fontWeight: 500 }}>
              {SCENARIOS.find(s => s.id === activeRun.scenarioId)?.title}
            </span>
            <span className="v7-mono" style={{ fontSize: 9, color: "var(--ink-4)" }}>
              {activeRun.emittedCount}/{activeRun.beats.length}
            </span>
          </div>
          <div style={{ height: 2, background: "var(--bg-2)", borderRadius: 1, marginTop: 6 }}>
            <div
              style={{
                height: "100%",
                width: `${(activeRun.emittedCount / activeRun.beats.length) * 100}%`,
                background: "var(--phos-500)",
                borderRadius: 1,
                transition: "width 0.3s var(--ease-standard)",
              }}
            />
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ padding: "8px 12px" }}>
        <input
          type="text"
          placeholder="Search scenarios..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: "100%",
            background: "var(--bg-2)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-sm)",
            padding: "6px 10px",
            fontSize: "var(--fs-xs)",
            color: "var(--ink-1)",
            fontFamily: "var(--font-jetbrains)",
            outline: "none",
          }}
        />
      </div>

      {/* Scenario list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px" }}>
        {filtered.map(scenario => (
          <ScenarioTile
            key={scenario.id}
            scenario={scenario}
            isActive={activeRun?.scenarioId === scenario.id && activeRun.status === "running"}
            isConfirming={confirmId === scenario.id}
            onLaunch={() => handleLaunch(scenario)}
            onConfirm={() => handleConfirm(scenario)}
            onCancelConfirm={() => setConfirmId(null)}
          />
        ))}
      </div>

      {/* Cast panel */}
      {activeRun?.status === "running" && (
        <div style={castStyle}>
          <span className="v7-micro-label" style={{ fontSize: 9, marginBottom: 6 }}>Cast</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SCENARIOS.find(s => s.id === activeRun.scenarioId)?.cast.map(name => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <AgentHueDot agentId={`${name}-${name.length.toString().padStart(2, "0")}`} size={6} />
                <span style={{ fontSize: "var(--fs-xs)", color: "var(--ink-2)" }}>{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Scenario Tile ──────────────────────────────────────────────────────────

function ScenarioTile({
  scenario,
  isActive,
  isConfirming,
  onLaunch,
  onConfirm,
  onCancelConfirm,
}: {
  scenario: ScenarioDefinition;
  isActive: boolean;
  isConfirming: boolean;
  onLaunch: () => void;
  onConfirm: () => void;
  onCancelConfirm: () => void;
}) {
  const etaSeconds = Math.round(scenario.duration_ms / 1000);

  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: "var(--radius-sm)",
        border: `1px solid ${isActive ? "var(--phos-500)" : "var(--line)"}`,
        background: isActive ? "color-mix(in srgb, var(--phos-500) 4%, var(--bg-1))" : "var(--bg-1)",
        marginBottom: 6,
        cursor: "pointer",
        transition: "border-color var(--dur-xs) var(--ease-standard)",
      }}
      onClick={isConfirming ? undefined : onLaunch}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter") onLaunch(); }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--ink-0)" }}>
          {scenario.title}
        </span>
        <DifficultyDot difficulty={scenario.difficulty} />
      </div>

      <p style={{ fontSize: "var(--fs-xs)", color: "var(--ink-3)", margin: "4px 0 0", lineHeight: 1.4 }}>
        {scenario.description}
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
        <span className="v7-mono" style={{ fontSize: 9, color: "var(--ink-4)" }}>
          ~{etaSeconds}s
        </span>
        <span className="v7-mono" style={{ fontSize: 9, color: "var(--ink-4)" }}>
          {scenario.beat.length} beats
        </span>
        <span className="v7-mono" style={{ fontSize: 9, color: "var(--ink-4)" }}>
          {scenario.cast.length} agents
        </span>
      </div>

      {/* Confirmation overlay */}
      {isConfirming && (
        <div style={{ marginTop: 8, padding: "6px 0", borderTop: "1px solid var(--line)", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--warn)" }}>
            Replace running scene?
          </span>
          <button
            onClick={e => { e.stopPropagation(); onConfirm(); }}
            className="v7-focus-ring"
            style={{ background: "var(--phos-500)", border: "none", borderRadius: 3, color: "var(--bg-0)", fontSize: 9, padding: "2px 8px", cursor: "pointer", fontWeight: 600 }}
          >
            Yes
          </button>
          <button
            onClick={e => { e.stopPropagation(); onCancelConfirm(); }}
            className="v7-focus-ring"
            style={{ background: "none", border: "1px solid var(--line)", borderRadius: 3, color: "var(--ink-3)", fontSize: 9, padding: "2px 8px", cursor: "pointer" }}
          >
            No
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Difficulty Dot ─────────────────────────────────────────────────────────

function DifficultyDot({ difficulty }: { difficulty: string }) {
  const color = difficulty === "easy" ? "var(--ok)" : difficulty === "medium" ? "var(--warn)" : "var(--err)";
  return (
    <span
      title={difficulty}
      style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }}
    />
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const dockStyle: React.CSSProperties = {
  width: 260,
  flexShrink: 0,
  borderRight: "1px solid var(--line)",
  background: "var(--bg-0)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  height: 36,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 12px",
  borderBottom: "1px solid var(--line)",
  flexShrink: 0,
};

const progressStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--line)",
  flexShrink: 0,
};

const castStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderTop: "1px solid var(--line)",
  flexShrink: 0,
};
