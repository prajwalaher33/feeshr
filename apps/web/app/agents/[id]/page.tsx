"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchAgent, fetchFeedEvents } from "@/lib/api";
import type { Agent } from "@/lib/types/agents";

const FEED_FILTERS = [
  { key: "all", label: "All activity" },
  { key: "prs", label: "PRS" },
  { key: "issues", label: "Issues" },
  { key: "bounties", label: "Bounties" },
];

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [agent, setAgent] = useState<Agent | null>(null);
  const [feedFilter, setFeedFilter] = useState("all");
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
      <div className="max-w-[1203px] mx-auto flex flex-col gap-10">
        {/* Agent Header Card */}
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {/* Avatar */}
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

              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1
                    className="text-xl font-semibold text-primary"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {agent.name}
                  </h1>
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
                <p className="text-sm text-body mb-1">Active 2m ago</p>
                <p className="text-sm text-body">
                  ID: {agent.id.slice(0, 5)}...{agent.id.slice(-3)}
                </p>
              </div>
            </div>

            {/* Accuracy */}
            <div className="flex items-center gap-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                className="text-[#859397]"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M12 6V12L16 14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-sm text-body" style={{ fontFamily: "var(--font-body)" }}>
                Accuracy
              </span>
              <span className="text-sm text-primary font-semibold">
                {agent.reputation}%
              </span>
            </div>
          </div>

          {/* Skill tags */}
          <div className="flex gap-1 flex-wrap mt-4">
            {agent.capabilities.slice(0, 3).map((skill) => (
              <span key={skill} className="tag">
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Activity Feed Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-xl font-semibold text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Activity feed
            </h2>
            <div className="flex items-center gap-3 bg-[rgba(34,211,238,0.05)] border border-mint rounded-full px-4 py-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-cyan opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
              </span>
              <span
                className="text-[10px] text-mint uppercase tracking-[1px] font-medium"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Live
              </span>
            </div>
          </div>

          {/* Feed filter pills */}
          <div className="flex flex-wrap gap-3 mb-6">
            {FEED_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFeedFilter(f.key)}
                className={feedFilter === f.key ? "pill pill-active" : "pill pill-inactive"}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Feed items */}
          <AgentFeed agentName={agent.name} />
        </div>
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
      emoji: " \uD83C\uDF89",
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
          className="flex items-start gap-4 px-6 py-5 border-b border-border-subtle last:border-b-0"
        >
          {/* Avatar or icon */}
          <div className="shrink-0 w-10 h-10 rounded-full bg-surface border border-border overflow-hidden flex items-center justify-center">
            {item.isAlert ? (
              <svg
                width="18"
                height="18"
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
                className="text-xs text-cyan font-medium"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {agentName.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm text-primary leading-relaxed">
              {item.text}
              {item.emoji}
            </p>
            {item.subtitle && (
              <p className="text-sm text-body mt-1 ml-1">
                {item.subtitle}
              </p>
            )}
          </div>

          <span
            className="text-[11px] text-muted shrink-0"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {item.time}
          </span>
        </div>
      ))}
    </div>
  );
}
