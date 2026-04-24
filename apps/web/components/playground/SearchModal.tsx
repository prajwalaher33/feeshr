"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import type { ObsAgent, ObsEvent } from "./usePlaygroundData";
import type { PullRequestDetail } from "@/lib/api";
import type { Project } from "@/lib/types/projects";
import { AgentMark, CATEGORY_STYLE } from "./primitives";

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  agents: ObsAgent[];
  events: ObsEvent[];
  prs: PullRequestDetail[];
  projects: Project[];
  onSelectEvent: (event: ObsEvent) => void;
}

interface SearchResult {
  id: string;
  type: "agent" | "event" | "pr" | "project";
  title: string;
  subtitle: string;
  data: ObsAgent | ObsEvent | PullRequestDetail | Project;
}

export function SearchModal({ open, onClose, agents, events, prs, projects, onSelectEvent }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results = useMemo((): SearchResult[] => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();

    const agentResults: SearchResult[] = agents
      .filter(a => a.handle.toLowerCase().includes(q) || a.caps.some(c => c.includes(q)))
      .slice(0, 4)
      .map(a => ({ id: `a-${a.id}`, type: "agent", title: a.handle, subtitle: `${a.tier} · ${a.caps.join(", ")}`, data: a }));

    const eventResults: SearchResult[] = events
      .filter(e => e.target.toLowerCase().includes(q) || e.verb.toLowerCase().includes(q) || e.agentHandle.toLowerCase().includes(q))
      .slice(0, 4)
      .map(e => ({ id: e.id, type: "event", title: `${e.agentHandle} ${e.verb} ${e.target}`, subtitle: `${e.timestamp} · ${e.category}`, data: e }));

    const prResults: SearchResult[] = prs
      .filter(p => p.title.toLowerCase().includes(q) || p.source_branch.toLowerCase().includes(q))
      .slice(0, 3)
      .map(p => ({ id: `pr-${p.id}`, type: "pr", title: p.title, subtitle: `${p.source_branch} → ${p.target_branch}`, data: p }));

    const projectResults: SearchResult[] = projects
      .filter(p => p.title.toLowerCase().includes(q) || p.problem_statement.toLowerCase().includes(q))
      .slice(0, 3)
      .map(p => ({ id: `proj-${p.id}`, type: "project", title: p.title, subtitle: `${p.status} · ${p.team.length} members`, data: p }));

    return [...agentResults, ...eventResults, ...prResults, ...projectResults];
  }, [query, agents, events, prs, projects]);

  useEffect(() => { setActiveIdx(0); }, [results.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && results[activeIdx]) {
      e.preventDefault();
      const r = results[activeIdx];
      if (r.type === "event") onSelectEvent(r.data as ObsEvent);
      onClose();
    }
    else if (e.key === "Escape") { onClose(); }
  };

  if (!open) return null;

  return (
    <div className="o-search-backdrop" onClick={onClose}>
      <div className="o-search-modal" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="o-search-input"
          placeholder="Search agents, events, PRs, projects..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div style={{ maxHeight: 340, overflow: 'auto' }}>
          {query && results.length === 0 && (
            <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--o-text-4)', fontSize: 12 }}>
              No results for &quot;{query}&quot;
            </div>
          )}
          {results.map((r, i) => (
            <div
              key={r.id}
              className={`o-search-result${i === activeIdx ? ' o-search-result-active' : ''}`}
              onClick={() => {
                if (r.type === "event") onSelectEvent(r.data as ObsEvent);
                onClose();
              }}
              onMouseEnter={() => setActiveIdx(i)}
            >
              {/* Type icon */}
              <span className="o-badge" style={{
                color: r.type === 'agent' ? 'var(--o-live)' : r.type === 'event' ? CATEGORY_STYLE[(r.data as ObsEvent).category]?.color || 'var(--o-text-3)' : r.type === 'pr' ? 'var(--o-live)' : 'var(--o-genesis)',
                background: 'var(--o-surface)', border: '1px solid var(--o-border)',
                fontSize: 9,
              }}>
                {r.type}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--o-text-0)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.title}
                </div>
                <div className="o-mono" style={{ fontSize: 10, color: 'var(--o-text-3)', marginTop: 1 }}>
                  {r.subtitle}
                </div>
              </div>
              {r.type === 'agent' && <AgentMark agent={r.data as ObsAgent} size={20} />}
            </div>
          ))}
          {!query && (
            <div style={{ padding: '16px', color: 'var(--o-text-4)', fontSize: 11, lineHeight: 1.6 }}>
              <div>Type to search across agents, events, PRs, and projects.</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
                <span><span className="o-mono" style={{ fontSize: 9, padding: '1px 4px', background: 'var(--o-raised)', borderRadius: 2 }}>↑↓</span> navigate</span>
                <span><span className="o-mono" style={{ fontSize: 9, padding: '1px 4px', background: 'var(--o-raised)', borderRadius: 2 }}>↵</span> select</span>
                <span><span className="o-mono" style={{ fontSize: 9, padding: '1px 4px', background: 'var(--o-raised)', borderRadius: 2 }}>esc</span> close</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
