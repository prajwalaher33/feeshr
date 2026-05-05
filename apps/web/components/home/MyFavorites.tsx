"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useStarred } from "@/lib/hooks/useStarred";
import { fetchAgents, fetchRepos, fetchBounties } from "@/lib/api";
import { AgentIdenticon } from "@/components/agents/AgentIdenticon";
import type { Agent } from "@/lib/types/agents";
import type { Repo } from "@/lib/types/repos";
import type { Bounty } from "@/lib/types/projects";

interface FavoritesData {
  agents: Agent[];
  repos: Repo[];
  bounties: Bounty[];
}

export function MyFavorites() {
  const { starredIds: starredAgentIds, count: agentCount } = useStarred("agents");
  const { starredIds: starredRepoIds, count: repoCount } = useStarred("repos");
  const { starredIds: starredBountyIds, count: bountyCount } = useStarred("bounties");
  const totalCount = agentCount + repoCount + bountyCount;

  const [data, setData] = useState<FavoritesData>({ agents: [], repos: [], bounties: [] });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (totalCount === 0) {
      setData({ agents: [], repos: [], bounties: [] });
      setLoaded(true);
      return;
    }
    let cancelled = false;
    Promise.all([fetchAgents(), fetchRepos(), fetchBounties()]).then(([agents, repos, bounties]) => {
      if (cancelled) return;
      setData({
        agents: agents.filter((a) => starredAgentIds.includes(a.id)).slice(0, 4),
        repos: repos.filter((r) => starredRepoIds.includes(r.id)).slice(0, 3),
        bounties: bounties.filter((b) => starredBountyIds.includes(b.id)).slice(0, 3),
      });
      setLoaded(true);
    });
    return () => { cancelled = true; };
    // Re-run when the lists change (user stars or unstars something elsewhere)
  }, [starredAgentIds, starredRepoIds, starredBountyIds, totalCount]);

  if (!loaded || totalCount === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1.5">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <h2 className="text-[17px] font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
            Your favorites
          </h2>
        </div>
        <span className="text-[10px] text-white/30 uppercase tracking-[0.12em]" style={{ fontFamily: "var(--font-mono)" }}>
          {totalCount} starred
        </span>
      </div>

      <div className="card overflow-hidden">
        {data.agents.length > 0 && (
          <div className="px-5 py-3 border-b border-white/[0.04]">
            <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] mb-2" style={{ fontFamily: "var(--font-mono)" }}>
              Agents · {agentCount}
            </p>
            <div className="flex flex-col gap-1.5">
              {data.agents.map((a) => (
                <Link
                  key={a.id}
                  href={`/agents/${a.id}`}
                  className="flex items-center gap-2.5 -mx-1 px-1 py-1 rounded-md hover:bg-white/[0.02] transition-colors group"
                >
                  <AgentIdenticon agentId={a.id} size={22} rounded="lg" />
                  <span className="flex-1 min-w-0 text-[12px] text-white/70 truncate group-hover:text-cyan transition-colors" style={{ fontFamily: "var(--font-display)" }}>
                    {a.name}
                  </span>
                  <span className="text-[10px] text-white/25 tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
                    {a.reputation}%
                  </span>
                </Link>
              ))}
              {agentCount > 4 && (
                <Link href="/agents" className="text-[10px] text-cyan/50 hover:text-cyan transition-colors mt-0.5" style={{ fontFamily: "var(--font-mono)" }}>
                  View {agentCount - 4} more →
                </Link>
              )}
            </div>
          </div>
        )}

        {data.repos.length > 0 && (
          <div className="px-5 py-3 border-b border-white/[0.04]">
            <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] mb-2" style={{ fontFamily: "var(--font-mono)" }}>
              Repos · {repoCount}
            </p>
            <div className="flex flex-col gap-1.5">
              {data.repos.map((r) => (
                <Link
                  key={r.id}
                  href={`/repos/${r.id}`}
                  className="flex items-center gap-2 -mx-1 px-1 py-1 rounded-md hover:bg-white/[0.02] transition-colors group"
                >
                  <span className="flex-1 min-w-0 text-[12px] text-white/70 truncate group-hover:text-cyan transition-colors" style={{ fontFamily: "var(--font-display)" }}>
                    {r.name}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-white/25" style={{ fontFamily: "var(--font-mono)" }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    {r.stars >= 1000 ? (r.stars / 1000).toFixed(1) + "k" : r.stars}
                  </span>
                </Link>
              ))}
              {repoCount > 3 && (
                <Link href="/explore" className="text-[10px] text-cyan/50 hover:text-cyan transition-colors mt-0.5" style={{ fontFamily: "var(--font-mono)" }}>
                  View {repoCount - 3} more →
                </Link>
              )}
            </div>
          </div>
        )}

        {data.bounties.length > 0 && (
          <div className="px-5 py-3">
            <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] mb-2" style={{ fontFamily: "var(--font-mono)" }}>
              Bounties · {bountyCount}
            </p>
            <div className="flex flex-col gap-1.5">
              {data.bounties.map((b) => (
                <Link
                  key={b.id}
                  href={`/bounties/${b.id}`}
                  className="flex items-center gap-2 -mx-1 px-1 py-1 rounded-md hover:bg-white/[0.02] transition-colors group"
                >
                  <span className="flex-1 min-w-0 text-[12px] text-white/70 truncate group-hover:text-cyan transition-colors" style={{ fontFamily: "var(--font-display)" }}>
                    {b.title}
                  </span>
                  <span className="text-[10px] font-bold text-violet-400 tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
                    {b.reward} rep
                  </span>
                </Link>
              ))}
              {bountyCount > 3 && (
                <Link href="/bounties" className="text-[10px] text-cyan/50 hover:text-cyan transition-colors mt-0.5" style={{ fontFamily: "var(--font-mono)" }}>
                  View {bountyCount - 3} more →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
