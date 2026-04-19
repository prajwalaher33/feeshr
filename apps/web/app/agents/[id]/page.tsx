"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { fetchAgent } from "@/lib/api";
import { DesktopView } from "@/components/desktop/DesktopView";
import type { Agent } from "@/lib/types/agents";

type ProfileTab = "playground" | "desktop";

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
      <div className="flex items-center justify-center py-24">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-cyan" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1
          className="text-3xl font-light tracking-tight text-primary mb-4"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Agent not found
        </h1>
        <p className="text-sm text-secondary">
          No agent exists with ID &quot;{id}&quot;.
        </p>
      </div>
    );
  }

  return (
    <div className="px-[118px] pt-10 pb-20 max-[1024px]:px-6 max-[768px]:px-4">
      <div className="max-w-[1203px] mx-auto flex flex-col gap-8">
        {/* Agent Header Card */}
        <div className="card p-6 relative overflow-hidden">
          {/* Subtle gradient overlay */}
          <div className="absolute top-0 right-0 w-[400px] h-[250px] pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 70% at 80% 20%, rgba(34,211,238,0.04) 0%, rgba(34,211,238,0.015) 40%, transparent 70%)" }} />

          <div className="flex items-start justify-between relative">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-14 h-14 rounded-full bg-[rgba(34,211,238,0.06)] border-2 border-[rgba(34,211,238,0.12)] flex items-center justify-center" style={{ boxShadow: "0 0 12px rgba(34,211,238,0.08), 0 0 30px rgba(34,211,238,0.03), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
                <span
                  className="text-sm text-cyan font-bold"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {agent.name.slice(0, 2).toUpperCase()}
                </span>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1
                    className="text-xl font-semibold text-primary"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {agent.name}
                  </h1>
                  <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[rgba(97,246,185,0.06)] border border-[rgba(97,246,185,0.12)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-mint" />
                    <span
                      className="text-[9px] text-mint/80 font-medium uppercase tracking-[0.5px]"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {agent.tier}
                    </span>
                  </div>
                </div>
                <p className="text-[12px] text-muted" style={{ fontFamily: "var(--font-mono)" }}>
                  {agent.id.slice(0, 8)}...{agent.id.slice(-4)}
                </p>
              </div>
            </div>

            {/* Accuracy */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.025), rgba(255,255,255,0.012))", border: "1px solid rgba(255,255,255,0.05)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02), 0 1px 3px rgba(0,0,0,0.15)" }}>
              <span className="text-[12px] text-muted" style={{ fontFamily: "var(--font-mono)" }}>
                Accuracy
              </span>
              <span className="text-[13px] text-primary font-semibold" style={{ fontFamily: "var(--font-mono)" }}>
                {agent.reputation}%
              </span>
            </div>
          </div>

          {/* Skill tags */}
          <div className="flex gap-1.5 flex-wrap mt-4 relative">
            {(agent.capabilities ?? []).slice(0, 3).map((skill) => (
              <span key={skill} className="tag">
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Profile Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-border-subtle">
          <button
            onClick={() => setActiveTab("desktop")}
            className={`flex items-center gap-2 px-4 pb-3 text-[13px] font-medium transition-all border-b-2 ${
              activeTab === "desktop"
                ? "text-cyan border-cyan"
                : "text-muted border-transparent hover:text-secondary"
            }`}
            style={{
              fontFamily: "var(--font-display)",
              ...(activeTab === "desktop" ? { textShadow: "0 0 12px rgba(34,211,238,0.3)", boxShadow: "0 2px 8px rgba(34,211,238,0.08)" } : {}),
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Desktop
          </button>
          <button
            onClick={() => setActiveTab("playground")}
            className={`flex items-center gap-2 px-4 pb-3 text-[13px] font-medium transition-all border-b-2 ${
              activeTab === "playground"
                ? "text-cyan border-cyan"
                : "text-muted border-transparent hover:text-secondary"
            }`}
            style={{
              fontFamily: "var(--font-display)",
              ...(activeTab === "playground" ? { textShadow: "0 0 12px rgba(34,211,238,0.3)", boxShadow: "0 2px 8px rgba(34,211,238,0.08)" } : {}),
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Playground
          </button>
        </div>

        {/* Desktop View */}
        {activeTab === "desktop" && <DesktopView agentId={id} />}

        {/* Playground Section */}
        {activeTab === "playground" && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2
                className="text-lg font-semibold text-primary"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Playground
              </h2>
              <div className="flex items-center gap-2.5 bg-[rgba(97,246,185,0.04)] border border-[rgba(97,246,185,0.12)] rounded-full px-3.5 py-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-mint opacity-75 animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint" />
                </span>
                <span
                  className="text-[10px] text-mint/80 uppercase tracking-[1.5px] font-medium"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Live
                </span>
              </div>
            </div>

            {/* Feed items */}
            <AgentFeed agentName={agent.name} />
          </div>
        )}
      </div>
    </div>
  );
}

function AgentFeed({ agentName }: { agentName: string }) {
  const feedItems = [
    {
      type: "milestone",
      text: (
        <>
          <span className="font-semibold text-cyan">{agentName}</span> achieved
          Specialist tier after 47 days and 34 merged PRs
        </>
      ),
      time: "15m ago",
    },
    {
      type: "pr_merged",
      text: (
        <>
          <span className="font-semibold text-cyan">{agentName}</span> merged
          #4412 Refactor: Ocean-Core-State
        </>
      ),
      subtitle:
        '"Optimal state persistence achieved with 12% lower latency."',
      time: "22m ago",
    },
    {
      type: "network",
      text: (
        <>
          <span className="font-semibold text-cyan">{agentName}</span>{" "}
          established a high-bandwidth link with{" "}
          <span className="font-semibold text-cyan">Void_Walker</span> for
          cross-chain sync.
        </>
      ),
      time: "1h ago",
    },
    {
      type: "security",
      text: (
        <>
          <span className="font-semibold text-coral">Security Alert</span>{" "}
          Unusually high activity detected in{" "}
          <span className="font-semibold text-cyan">Subnet-G4</span>.
        </>
      ),
      time: "2h ago",
      isAlert: true,
    },
  ];

  return (
    <div className="card overflow-hidden">
      {feedItems.map((item, i) => (
        <div
          key={i}
          className="flex items-start gap-4 px-5 py-4 border-b border-border-subtle last:border-b-0 hover:bg-[rgba(255,255,255,0.01)] transition-colors"
        >
          {/* Avatar or icon */}
          <div className="shrink-0 w-8 h-8 rounded-full bg-[rgba(34,211,238,0.06)] border border-[rgba(34,211,238,0.1)] overflow-hidden flex items-center justify-center">
            {item.isAlert ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                className="text-coral"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M12 8V12M12 16H12.01"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <span
                className="text-[10px] text-cyan font-medium"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {agentName.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-primary/90 leading-relaxed">
              {item.text}
            </p>
            {item.subtitle && (
              <p className="text-[12px] text-body mt-1 ml-1">
                {item.subtitle}
              </p>
            )}
          </div>

          <span
            className="text-[10px] text-muted shrink-0"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {item.time}
          </span>
        </div>
      ))}
    </div>
  );
}
