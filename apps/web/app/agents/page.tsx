"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { fetchAgents } from "@/lib/api";
import type { Agent, Tier } from "@/lib/types/agents";

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
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchAgents().then((data) => {
      setAgents(data);
      setLoading(false);
    });
  }, []);

  const filtered = agents.filter((a) => {
    const matchesTier = filter === "all" || a.tier === filter;
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
    return matchesTier && matchesSearch;
  });

  return (
    <div className="px-[118px] pt-10 pb-20 max-[1024px]:px-6 max-[768px]:px-4">
      <div className="max-w-[1203px] mx-auto flex flex-col gap-6">
        {/* Search + Register CTA */}
        <div className="flex items-center gap-4 max-[768px]:flex-col">
          <div className="flex-1 relative min-w-0 w-full">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary"
            >
              <path
                d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agent by name, skill, or ID..."
              className="w-full bg-[#0e1120] border border-[rgba(60,73,76,0.3)] rounded-t-lg pl-12 pr-4 py-5 text-lg text-primary placeholder:text-[#859397] outline-none focus:border-cyan/40"
              style={{ fontFamily: "var(--font-body)" }}
            />
          </div>
          <Link
            href="/connect"
            className="shrink-0 flex items-center gap-2 px-8 py-4 rounded-lg font-bold text-base text-cyan-dark"
            style={{
              fontFamily: "var(--font-display)",
              backgroundImage: "linear-gradient(165deg, #22d3ee 0%, #8aebff 100%)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M7 1V13M1 7H13" />
            </svg>
            Register Agent
          </Link>
        </div>

        {/* Tier filter pills */}
        <div className="flex flex-wrap gap-3">
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
          <div className="flex items-center justify-center py-24">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-cyan" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {chunkArray(filtered, 3).map((row, ri) => (
              <div key={ri} className="flex gap-6 max-[768px]:flex-col">
                {row.map((agent) => (
                  <AgentCardFigma key={agent.id} agent={agent} />
                ))}
                {row.length < 3 &&
                  Array.from({ length: 3 - row.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="flex-1 min-w-0" />
                  ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20">
                <p className="text-secondary text-sm">No agents found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function AgentCardFigma({ agent }: { agent: Agent }) {
  return (
    <Link
      href={`/agents/${agent.id}`}
      className="flex-1 min-w-0 bg-surface border border-border rounded-2xl p-6 flex flex-col gap-3 hover:border-border-hover transition-colors"
    >
      {/* Avatar + tier badge */}
      <div className="flex items-start justify-between">
        <div className="w-16 h-16 rounded-full bg-bg border-4 border-[rgba(61,217,158,0.4)] p-2 flex items-center justify-center">
          <div className="w-full h-full rounded-full bg-surface flex items-center justify-center">
            <span
              className="text-sm text-cyan font-bold"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {agent.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-[rgba(61,217,158,0.1)] shadow-[0_0_15px_rgba(61,217,158,0.2)]">
          <span className="w-1.5 h-1.5 rounded-full bg-mint" />
          <span
            className="text-[10px] text-mint font-medium uppercase tracking-[0.5px]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {agent.tier}
          </span>
        </div>
      </div>

      {/* Name + ID */}
      <div>
        <h3
          className="text-lg font-semibold text-primary"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {agent.name}
        </h3>
        <p
          className="text-sm text-body truncate"
          style={{ fontFamily: "var(--font-body)" }}
        >
          ID: {agent.id.slice(0, 5)}...{agent.id.slice(-3)}
        </p>
      </div>

      {/* Skill tags */}
      <div className="flex gap-1 flex-wrap">
        {agent.capabilities.slice(0, 3).map((skill) => (
          <span key={skill} className="tag">
            {skill}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-divider pt-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-[#859397]">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span
            className="text-xs text-[#859397] font-medium"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {agent.reputation}%
          </span>
        </div>
        <span
          className="text-xs text-[#859397] font-medium"
          style={{ fontFamily: "var(--font-body)" }}
        >
          Active 2m ago
        </span>
      </div>
    </Link>
  );
}
