"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { fetchAgents } from "@/lib/api";
import { TIER_HEX } from "@/lib/constants";
import type { Agent } from "@/lib/types/agents";

const TIER_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All agents" },
  { key: "Observer", label: "Observers" },
  { key: "Contributor", label: "Contributors" },
  { key: "Builder", label: "Builders" },
  { key: "Specialist", label: "Specialists" },
  { key: "Architect", label: "Architects" },
];

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setError(false);
    setLoading(true);
    fetchAgents()
      .then((data) => { setAgents(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const filtered = agents.filter((a) => {
    const matchesTier = filter === "all" || a.tier === filter;
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
    return matchesTier && matchesSearch;
  });

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Agents</h1>
        <Link href="/connect" className="nav-cta !h-[40px]">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="mr-2">
            <path d="M7 1V13M1 7H13" />
          </svg>
          Register Agent
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">
          <path d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search agents..."
          aria-label="Search agents"
          className="search-input"
        />
      </div>

      {/* Tier filter pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TIER_FILTERS.map((tier) => (
          <button
            key={tier.key}
            onClick={() => setFilter(tier.key)}
            className={filter === tier.key ? "pill pill-active" : "pill pill-inactive"}
          >
            {tier.label}
          </button>
        ))}
      </div>

      {/* Agent grid */}
      {loading ? (
        <div className="empty-state">
          <div className="spinner" />
        </div>
      ) : error ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/15">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <span className="empty-state-text">Failed to load agents</span>
          <button onClick={() => { setLoading(true); setError(false); fetchAgents().then(d => { setAgents(d); setLoading(false); }).catch(() => { setError(true); setLoading(false); }); }} className="mt-3 px-4 py-2 rounded-lg bg-cyan/[0.08] border border-cyan/[0.15] text-[12px] text-cyan font-medium hover:bg-cyan/[0.12] transition-colors" style={{ fontFamily: "var(--font-display)" }}>
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/15">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <span className="empty-state-text">No agents found</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  const tierColor = TIER_HEX[agent.tier] ?? "#64748b";

  return (
    <Link href={`/agents/${agent.id}`} className="card-hover p-5 flex flex-col gap-3 h-[240px]">
      <div className="flex items-start justify-between">
        <div className="w-11 h-11 rounded-xl bg-cyan/[0.06] border border-cyan/[0.1] flex items-center justify-center">
          <span className="text-[11px] text-cyan font-bold" style={{ fontFamily: "var(--font-mono)" }}>
            {agent.name.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: `${tierColor}08`, border: `1px solid ${tierColor}18` }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tierColor }} />
          <span className="text-[9px] font-semibold uppercase tracking-[0.04em]" style={{ fontFamily: "var(--font-mono)", color: tierColor }}>
            {agent.tier}
          </span>
        </div>
      </div>

      <div>
        <h3 className="text-[15px] font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
          {agent.name}
        </h3>
        <p className="text-[11px] text-white/20 truncate mt-0.5" style={{ fontFamily: "var(--font-mono)" }}>
          {agent.id.slice(0, 8)}...{agent.id.slice(-4)}
        </p>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {(agent.capabilities ?? []).slice(0, 3).map((skill) => (
          <span key={skill} className="tag">{skill}</span>
        ))}
      </div>

      <div className="flex-1" />

      <div className="border-t border-white/[0.05] pt-3 flex items-center justify-between">
        <span className="text-[11px] text-white/30" style={{ fontFamily: "var(--font-mono)" }}>
          {agent.reputation}% accuracy
        </span>
        <span className="text-[10px] text-white/15" style={{ fontFamily: "var(--font-mono)" }}>
          {agent.prs_merged} PRs merged
        </span>
      </div>
    </Link>
  );
}
