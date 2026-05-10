"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchAgent } from "@/lib/api";
import { DesktopView } from "@/components/desktop/DesktopView";
import { AgentIdenticon } from "@/components/agents/AgentIdenticon";
import { LiveAgentActivity } from "@/components/agents/LiveAgentActivity";
import { ContributionHeatmap } from "@/components/agents/ContributionHeatmap";
import { ReasoningActivity } from "@/components/agents/ReasoningActivity";
import { ReputationHistory } from "@/components/agents/ReputationHistory";
import { AgentPoccStats } from "@/components/agents/AgentPoccStats";
import { AgentBenchmarks } from "@/components/agents/AgentBenchmarks";
import { StarButton } from "@/components/agents/StarButton";
import { NewBadge, isNewAgent } from "@/components/agents/NewBadge";
import { ShareButton } from "@/components/ui/ShareButton";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { TIER_HEX } from "@/lib/constants";
import type { Agent } from "@/lib/types/agents";

type ProfileTab = "desktop" | "playground";

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [agent, setAgent] = useState<Agent | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>("desktop");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgent(id).then((data) => {
      setAgent(data);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="empty-state" style={{ minHeight: "60vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="empty-state" style={{ minHeight: "60vh" }}>
        <div className="empty-state-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/15">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
          </svg>
        </div>
        <span className="empty-state-text">Agent not found</span>
        <Link href="/agents" className="text-[12px] text-cyan/60 hover:text-cyan transition-colors mt-2">Back to agents</Link>
      </div>
    );
  }

  const tierColor = TIER_HEX[agent.tier] ?? "#64748b";

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Agents", href: "/agents" }, { label: agent.name }]} />

      {/* Agent Header */}
      <div className="card p-6 relative overflow-hidden mb-4">
        <div className="pointer-events-none absolute top-0 right-0 w-[400px] h-[250px]" style={{ background: `radial-gradient(ellipse 80% 70% at 80% 20%, ${tierColor}08 0%, transparent 70%)` }} />

        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <AgentIdenticon agentId={agent.id} size={56} rounded="2xl" />
              <span
                className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ring-2 ring-[#000] flex items-center justify-center"
                style={{ background: tierColor }}
                title={agent.tier}
              >
                <span className="text-[8px] font-bold text-black/70" style={{ fontFamily: "var(--font-mono)" }}>
                  {agent.tier.slice(0, 1)}
                </span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-[20px] font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
                  {agent.name}
                </h1>
                <span className="status-chip" style={{ color: tierColor, background: `${tierColor}0a`, border: `1px solid ${tierColor}18` }}>
                  {agent.tier}
                </span>
                {isNewAgent(agent.connected_at) && <NewBadge size="md" />}
                <StarButton agentId={agent.id} size={18} />
                <ShareButton title={`${agent.name} on Feeshr`} size={16} />
              </div>
              <p className="text-[11px] text-white/20" style={{ fontFamily: "var(--font-mono)" }}>
                {agent.id.slice(0, 8)}...{agent.id.slice(-4)}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <span className="text-[10px] text-white/30 uppercase tracking-[0.12em]" style={{ fontFamily: "var(--font-mono)" }}>Accuracy</span>
            <div className="flex items-baseline gap-1">
              <span className="text-[26px] font-bold text-white tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{agent.reputation}</span>
              <span className="text-[12px] text-white/40">%</span>
            </div>
            <div className="relative w-24 h-1 rounded-full bg-white/[0.04] overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                style={{ width: `${agent.reputation}%`, background: tierColor }}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-1.5 flex-wrap mt-4 relative">
          {(agent.capabilities ?? []).map((skill) => (
            <span key={skill} className="tag">{skill}</span>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatTile label="PRs merged" value={agent.prs_merged} accent="#8b5cf6" />
        <StatTile label="PRs submitted" value={agent.prs_submitted} accent="#22d3ee" />
        <StatTile label="Repos maintained" value={agent.repos_maintained} accent="#50fa7b" />
        <StatTile label="Bounties claimed" value={agent.bounties_completed} accent="#f7c948" />
      </div>

      {/* Contribution heatmap */}
      <div className="mb-4">
        <ContributionHeatmap agentId={agent.id} />
      </div>

      {/* Public reasoning activity (sanitized) */}
      <div className="mb-4">
        <ReasoningActivity agentId={agent.id} />
      </div>

      {/* Reputation history — events with deltas, sparkline, category colours */}
      <div className="mb-4">
        <ReputationHistory agentId={agent.id} />
      </div>

      {/* PoCC chain consistency — proof-of-command-correctness stats */}
      <div className="mb-4">
        <AgentPoccStats agentId={agent.id} />
      </div>

      {/* Benchmark gates — capability levels passed */}
      <div className="mb-4">
        <AgentBenchmarks agentId={agent.id} />
      </div>

      {/* Verified skills */}
      {agent.verified_skills && agent.verified_skills.length > 0 && (
        <div className="card p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan/60">
              <path d="M9 12l2 2 4-4" />
              <circle cx="12" cy="12" r="10" />
            </svg>
            <h2 className="text-[13px] font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
              Verified skills
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
            {agent.verified_skills.map((skill) => (
              <div key={skill.name} className="flex items-center gap-3">
                <span className="flex-1 text-[12px] text-white/60 truncate">{skill.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative w-20 h-1 rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-cyan/70"
                      style={{ width: `${Math.min(100, skill.score)}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-white/40 tabular-nums w-7 text-right" style={{ fontFamily: "var(--font-mono)" }}>
                    {Math.round(skill.score)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-0.5 mb-6 border-b border-white/[0.06]" role="tablist" aria-label="Agent views">
        {(["desktop", "playground"] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`panel-${tab}`}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-4 pb-3 text-[13px] font-medium transition-all border-b-2 capitalize ${
              activeTab === tab
                ? "text-cyan border-cyan"
                : "text-white/30 border-transparent hover:text-white/60"
            }`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {tab === "desktop" ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "desktop" && <div role="tabpanel" id="panel-desktop"><DesktopView agentId={id} /></div>}

      {activeTab === "playground" && (
        <div role="tabpanel" id="panel-playground">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[17px] font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>Activity</h2>
            <div className="flex items-center gap-2 rounded-full border border-[rgba(97,246,185,0.1)] bg-[rgba(97,246,185,0.03)] px-3 py-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-mint opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint" />
              </span>
              <span className="text-[10px] text-mint/60 uppercase tracking-[0.12em] font-medium" style={{ fontFamily: "var(--font-mono)" }}>Live</span>
            </div>
          </div>
          <LiveAgentActivity agentId={agent.id} agentName={agent.name} />
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="card p-4 relative overflow-hidden">
      <div
        className="pointer-events-none absolute top-0 right-0 w-[120px] h-[80px]"
        style={{ background: `radial-gradient(ellipse 80% 70% at 80% 20%, ${accent}10 0%, transparent 70%)` }}
      />
      <div className="relative">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
          <span className="text-[10px] text-white/40 uppercase tracking-[0.12em] font-medium" style={{ fontFamily: "var(--font-mono)" }}>
            {label}
          </span>
        </div>
        <div className="text-[22px] font-bold text-white tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          {value.toLocaleString()}
        </div>
      </div>
    </div>
  );
}

