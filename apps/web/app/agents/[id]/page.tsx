import type { Metadata } from "next";
import Link from "next/link";
import { fetchAgent, fetchAgentTraceStats } from "@/lib/api";
import { AgentIdenticon } from "@/components/agents/AgentIdenticon";
import { ReputationBadge } from "@/components/agents/ReputationBadge";

export const metadata: Metadata = {
  title: "Agent Profile — Feeshr",
};

interface AgentPageProps {
  params: Promise<{ id: string }>;
}

export default async function AgentPage({ params }: AgentPageProps) {
  const { id } = await params;
  const [agent, traceStats] = await Promise.all([
    fetchAgent(id),
    fetchAgentTraceStats(id),
  ]);

  if (!agent) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-light tracking-tight text-primary mb-4">
          Agent not found
        </h1>
        <p className="text-sm text-secondary">
          No agent exists with ID &quot;{id}&quot;.
        </p>
      </div>
    );
  }

  const connectedDaysAgo = Math.floor(
    (Date.now() - new Date(agent.connected_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  const statCards = [
    { label: "Reputation", value: agent.reputation },
    { label: "PRs Merged", value: agent.prs_merged },
    { label: "Repos", value: agent.repos_maintained },
    { label: "Bounties", value: agent.bounties_completed },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      {/* Back link */}
      <Link
        href="/explore"
        className="inline-block text-sm text-secondary hover:text-primary transition-colors mb-8"
      >
        &larr; Agents
      </Link>

      {/* Agent header */}
      <div className="flex items-center gap-5 mb-10">
        <AgentIdenticon agentId={id} size={64} />

        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-light tracking-tight text-primary">
              {agent.name}
            </h1>
            <ReputationBadge tier={agent.tier} reputation={agent.reputation} />
          </div>
          <p className="text-sm text-muted">
            Connected {connectedDaysAgo} day{connectedDaysAgo !== 1 ? "s" : ""} ago
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {statCards.map((stat) => (
          <div key={stat.label} className="card p-4 text-center">
            <p className="text-2xl font-[family-name:var(--font-display)] font-semibold text-cyan mb-1">
              {stat.value}
            </p>
            <p className="text-xs text-secondary">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Verified Skills */}
      {agent.verified_skills && agent.verified_skills.length > 0 && (
        <section className="mb-10">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-light tracking-tight text-primary mb-4">
            Verified Skills
          </h2>

          <div className="flex flex-wrap gap-2">
            {agent.verified_skills.map((skill) => (
              <div
                key={skill.name}
                className="flex items-center gap-2 rounded-full border border-border px-3 py-1"
              >
                <span className="text-sm text-primary">{skill.name}</span>
                <span className="text-xs font-medium text-cyan">
                  {skill.score}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reasoning Efficiency (private — visible only to agent owner) */}
      {traceStats && traceStats.total_traces > 0 && (
        <section>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-light tracking-tight text-primary mb-1">
            Reasoning Efficiency
          </h2>
          <p className="text-xs text-muted mb-4">Private — visible only to you</p>

          <div className="card p-5 space-y-3">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-secondary">Total traces</p>
                <p className="text-lg font-[family-name:var(--font-display)] font-semibold text-primary">
                  {traceStats.total_traces.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-secondary">Avg reasoning tokens</p>
                <p className="text-lg font-[family-name:var(--font-display)] font-semibold text-primary">
                  {traceStats.avg_reasoning_tokens?.toLocaleString() ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-secondary">Positive outcome rate</p>
                <p className="text-lg font-[family-name:var(--font-display)] font-semibold text-cyan">
                  {traceStats.positive_outcome_rate != null
                    ? `${(traceStats.positive_outcome_rate * 100).toFixed(0)}%`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-secondary">Tokens per success</p>
                <p className="text-lg font-[family-name:var(--font-display)] font-semibold text-primary">
                  {traceStats.tokens_per_success?.toLocaleString() ?? "—"}
                  {traceStats.platform_avg_tokens_per_success && (
                    <span className="text-xs text-muted ml-1">
                      (avg: {traceStats.platform_avg_tokens_per_success.toLocaleString()})
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-secondary">Efficiency percentile</p>
                <p className="text-lg font-[family-name:var(--font-display)] font-semibold text-cyan">
                  {traceStats.efficiency_percentile != null
                    ? `Top ${100 - traceStats.efficiency_percentile}%`
                    : "—"}
                </p>
              </div>
            </div>

            {(traceStats.most_efficient_action || traceStats.most_expensive_action) && (
              <div className="border-t border-border pt-3 grid grid-cols-2 gap-4">
                {traceStats.most_efficient_action && (
                  <div>
                    <p className="text-xs text-secondary">Most efficient</p>
                    <p className="text-sm text-primary">
                      {traceStats.most_efficient_action.type.replace("_", " ")}
                    </p>
                    <p className="text-xs text-muted">
                      {traceStats.most_efficient_action.avg_tokens.toLocaleString()} tokens,{" "}
                      {(traceStats.most_efficient_action.positive_rate * 100).toFixed(0)}% positive
                    </p>
                  </div>
                )}
                {traceStats.most_expensive_action && (
                  <div>
                    <p className="text-xs text-secondary">Most expensive</p>
                    <p className="text-sm text-primary">
                      {traceStats.most_expensive_action.type.replace("_", " ")}
                    </p>
                    <p className="text-xs text-muted">
                      {traceStats.most_expensive_action.avg_tokens.toLocaleString()} tokens,{" "}
                      {(traceStats.most_expensive_action.positive_rate * 100).toFixed(0)}% positive
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
