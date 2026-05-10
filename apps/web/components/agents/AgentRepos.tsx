"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fetchAgentRepos,
  type AgentRepoSummary,
} from "@/lib/api";

interface AgentReposProps {
  agentId: string;
}

const CI_COLOR: Record<string, string> = {
  passing: "#28c840",
  failing: "#ff6b6b",
  pending: "#f7c948",
};

const MAX_VISIBLE = 6;

export function AgentRepos({ agentId }: AgentReposProps) {
  const [repos, setRepos] = useState<AgentRepoSummary[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchAgentRepos(agentId).then((data) => {
      setRepos(data);
      setLoading(false);
    });
  }, [agentId]);

  const { maintained, contributed } = useMemo(() => {
    if (!repos) return { maintained: [] as AgentRepoSummary[], contributed: [] as AgentRepoSummary[] };
    const m: AgentRepoSummary[] = [];
    const c: AgentRepoSummary[] = [];
    for (const r of repos) {
      if (r.maintainer_id === agentId) m.push(r);
      else c.push(r);
    }
    return { maintained: m, contributed: c };
  }, [repos, agentId]);

  if (loading) {
    return (
      <div className="card p-5">
        <Title />
        <p
          className="text-[12px] text-white/30 mt-2"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Loading…
        </p>
      </div>
    );
  }

  if (!repos || repos.length === 0) {
    return (
      <div className="card p-5">
        <Title />
        <p
          className="text-[12px] text-white/30 mt-2"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          No repos yet
        </p>
      </div>
    );
  }

  // Sort each bucket by stars desc so the most-watched land at the top.
  const sortedMaint = [...maintained].sort((a, b) => b.star_count - a.star_count);
  const sortedContrib = [...contributed].sort((a, b) => b.star_count - a.star_count);
  const ordered = [...sortedMaint, ...sortedContrib];
  const visible = ordered.slice(0, MAX_VISIBLE);
  const hidden = ordered.length - visible.length;

  return (
    <div className="card p-5">
      <div className="flex items-baseline gap-3 mb-3">
        <Title />
        <span
          className="ml-auto text-[10px] text-white/25"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {maintained.length} maintained · {contributed.length} contributed
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {visible.map((r) => {
          const isMaintainer = r.maintainer_id === agentId;
          const ciColor = CI_COLOR[r.ci_status] ?? "#6b7280";
          return (
            <Link
              key={r.id}
              href={`/repos/${r.id}`}
              className="card-hover p-3 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    background: ciColor,
                    boxShadow: r.ci_status === "passing" ? `0 0 4px ${ciColor}66` : undefined,
                  }}
                  title={`CI ${r.ci_status}`}
                />
                <span
                  className="text-[13px] text-white/85 truncate"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {r.name}
                </span>
                <span
                  className="ml-auto shrink-0 text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded"
                  style={{
                    color: isMaintainer ? "#22d3ee" : "rgba(255,255,255,0.35)",
                    background: isMaintainer ? "rgba(34,211,238,0.06)" : "rgba(255,255,255,0.03)",
                    border: isMaintainer
                      ? "1px solid rgba(34,211,238,0.18)"
                      : "1px solid rgba(255,255,255,0.06)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {isMaintainer ? "maintainer" : "contributor"}
                </span>
              </div>

              {r.description && (
                <p className="text-[11px] text-white/45 line-clamp-2 leading-relaxed">
                  {r.description}
                </p>
              )}

              <div
                className="flex items-center gap-3 text-[10px] text-white/35 mt-auto"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <span className="flex items-center gap-1">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400/80">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  {r.star_count.toLocaleString()}
                </span>
                {r.languages.slice(0, 2).map((lang) => (
                  <span key={lang} className="text-white/40">
                    {lang}
                  </span>
                ))}
                {(r.open_issue_count > 0 || r.open_pr_count > 0) && (
                  <span className="ml-auto">
                    {r.open_issue_count > 0 && <span>{r.open_issue_count}i</span>}
                    {r.open_issue_count > 0 && r.open_pr_count > 0 && " · "}
                    {r.open_pr_count > 0 && <span>{r.open_pr_count}p</span>}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {hidden > 0 && (
        <div
          className="text-[10px] text-white/25 mt-3"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          +{hidden} more repo{hidden !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

function Title() {
  return (
    <h3
      className="text-[13px] font-semibold text-white"
      style={{ fontFamily: "var(--font-display)" }}
    >
      Repos
    </h3>
  );
}
