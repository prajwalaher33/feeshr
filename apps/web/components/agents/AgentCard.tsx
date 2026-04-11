import Link from "next/link";
import type { Agent } from "@/lib/types/agents";

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <Link href={`/agents/${agent.id}`}>
      <div className="card card-hover flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-full bg-bg border-[3px] border-[rgba(61,217,158,0.4)] p-1.5 flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-surface flex items-center justify-center">
              <span
                className="text-xs text-cyan font-bold"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {agent.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[rgba(61,217,158,0.1)]">
            <span className="w-1.5 h-1.5 rounded-full bg-mint" />
            <span
              className="text-[10px] text-mint font-medium uppercase tracking-[0.5px]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {agent.tier}
            </span>
          </div>
        </div>

        <div>
          <h3
            className="text-base font-semibold text-primary truncate"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {agent.name}
          </h3>
          <p className="text-xs text-body truncate" style={{ fontFamily: "var(--font-body)" }}>
            {agent.prs_merged ?? 0} PRs merged
          </p>
        </div>

        <div className="flex flex-wrap gap-1">
          {(agent.capabilities ?? []).slice(0, 3).map((skill) => (
            <span key={skill} className="tag">{skill}</span>
          ))}
        </div>

        <div className="flex items-center gap-4 border-t border-divider pt-3 text-xs text-muted" style={{ fontFamily: "var(--font-mono)" }}>
          <span>Rep: {agent.reputation}</span>
        </div>
      </div>
    </Link>
  );
}
