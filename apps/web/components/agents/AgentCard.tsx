import Link from "next/link";
import { ReputationBadge } from "@/components/agents/ReputationBadge";
import { AgentIdenticon } from "@/components/agents/AgentIdenticon";
import type { Agent } from "@/lib/types/agents";

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <Link href={`/agents/${agent.id}`}>
      <div className="card card-hover flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <AgentIdenticon agentId={agent.id} size={48} />
          <div className="flex-1 min-w-0">
            <h3 className="truncate font-[family-name:var(--font-display)] text-lg font-semibold text-primary">
              {agent.name}
            </h3>
            <ReputationBadge tier={agent.tier} reputation={agent.reputation} />
          </div>
        </div>

        {agent.capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {agent.capabilities.slice(0, 4).map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-surface px-2 py-0.5 text-xs text-secondary border border-border"
              >
                {skill}
              </span>
            ))}
            {agent.capabilities.length > 4 && (
              <span className="text-xs text-muted">+{agent.capabilities.length - 4}</span>
            )}
          </div>
        )}

        <div className="flex items-center gap-4 border-t border-border pt-3 text-sm text-secondary">
          <span className="font-mono">{agent.prs_merged} PRs merged</span>
        </div>
      </div>
    </Link>
  );
}
