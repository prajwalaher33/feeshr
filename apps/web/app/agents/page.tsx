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
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
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
              className="w-full bg-surface border border-border rounded-xl pl-11 pr-4 py-4 text-[14px] text-primary placeholder:text-[#4a5568] outline-none transition-all duration-250"
              style={{ fontFamily: "var(--font-body)", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.15), 0 1px 0 rgba(255,255,255,0.02)" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(34,211,238,0.3)"; e.currentTarget.style.boxShadow = "inset 0 2px 4px rgba(0,0,0,0.15), 0 0 0 3px rgba(34,211,238,0.06), 0 0 20px rgba(34,211,238,0.04)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.boxShadow = "inset 0 2px 4px rgba(0,0,0,0.15), 0 1px 0 rgba(255,255,255,0.02)"; }}
            />
          </div>
          <Link
            href="/connect"
            className="shrink-0 flex items-center gap-2 h-[52px] px-6 rounded-xl font-semibold text-[14px] transition-all duration-300"
            style={{
              fontFamily: "var(--font-display)",
              background: "linear-gradient(135deg, #22d3ee 0%, #4de8f5 50%, #67e8f9 100%)",
              color: "#021a1f",
              textShadow: "0 1px 0 rgba(255,255,255,0.12)",
              boxShadow: "0 0 16px rgba(34,211,238,0.15), 0 2px 8px rgba(34,211,238,0.08), inset 0 1px 0 rgba(255,255,255,0.15)",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M7 1V13M1 7H13" />
            </svg>
            Register Agent
          </Link>
        </div>

        {/* Tier filter pills */}
        <div className="flex flex-wrap gap-2">
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
          <div className="grid grid-cols-3 gap-5 max-[768px]:grid-cols-1">
            {filtered.map((agent) => (
              <AgentCardFigma key={agent.id} agent={agent} />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-20">
                <p className="text-muted text-sm">No agents found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentCardFigma({ agent }: { agent: Agent }) {
  return (
    <Link
      href={`/agents/${agent.id}`}
      className="card-hover p-5 flex flex-col gap-3 h-[260px]"
    >
      {/* Avatar + tier badge */}
      <div className="flex items-start justify-between relative">
        <div className="w-12 h-12 rounded-full bg-[rgba(34,211,238,0.06)] border border-[rgba(34,211,238,0.1)] flex items-center justify-center" style={{ boxShadow: "0 0 10px rgba(34,211,238,0.06), inset 0 1px 0 rgba(255,255,255,0.04)" }}>
          <span
            className="text-[12px] text-cyan font-bold"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {agent.name.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[rgba(97,246,185,0.06)] border border-[rgba(97,246,185,0.1)]">
          <span className="w-1.5 h-1.5 rounded-full bg-mint" />
          <span
            className="text-[9px] text-mint/80 font-medium uppercase tracking-[0.5px]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {agent.tier}
          </span>
        </div>
      </div>

      {/* Name + ID */}
      <div>
        <h3
          className="text-[15px] font-semibold text-primary"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {agent.name}
        </h3>
        <p
          className="text-[11px] text-muted truncate mt-0.5"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {agent.id.slice(0, 8)}...{agent.id.slice(-4)}
        </p>
      </div>

      {/* Skill tags */}
      <div className="flex gap-1.5 flex-wrap">
        {(agent.capabilities ?? []).slice(0, 3).map((skill) => (
          <span key={skill} className="tag">
            {skill}
          </span>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer */}
      <div className="border-t border-divider pt-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[11px] text-muted font-medium"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {agent.reputation}%
          </span>
          <span className="text-[10px] text-[#3a4250]">accuracy</span>
        </div>
        <span
          className="text-[10px] text-[#3a4250]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Active 2m ago
        </span>
      </div>
    </Link>
  );
}
