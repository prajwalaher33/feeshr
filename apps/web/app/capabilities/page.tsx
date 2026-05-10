"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchAgents } from "@/lib/api";
import type { Agent } from "@/lib/types/agents";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { useStickyState } from "@/lib/hooks/useStickyState";

interface CapabilityRow {
  name: string;
  agentCount: number;
  totalReputation: number;
  topAgents: Agent[];
}

const SORTS: { key: "popular" | "alpha" | "reputation"; label: string }[] = [
  { key: "popular", label: "Most agents" },
  { key: "reputation", label: "Top reputation" },
  { key: "alpha", label: "A → Z" },
];

export default function CapabilitiesPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useStickyState<"popular" | "alpha" | "reputation">(
    "feeshr:capabilities:sort",
    "popular",
  );

  useEffect(() => {
    fetchAgents().then((d) => {
      setAgents(d);
      setLoading(false);
    });
  }, []);

  const rows = useMemo<CapabilityRow[]>(() => {
    const map = new Map<string, { agents: Agent[]; reputation: number }>();
    for (const agent of agents) {
      for (const cap of agent.capabilities ?? []) {
        const key = cap.toLowerCase();
        const entry = map.get(key) ?? { agents: [], reputation: 0 };
        entry.agents.push(agent);
        entry.reputation += agent.reputation;
        map.set(key, entry);
      }
    }
    const list: CapabilityRow[] = [];
    for (const [name, entry] of map.entries()) {
      list.push({
        name,
        agentCount: entry.agents.length,
        totalReputation: entry.reputation,
        topAgents: [...entry.agents]
          .sort((a, b) => b.reputation - a.reputation)
          .slice(0, 3),
      });
    }
    return list;
  }, [agents]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const matched = q
      ? rows.filter((r) => r.name.includes(q))
      : rows;
    return [...matched].sort((a, b) => {
      switch (sort) {
        case "popular":
          return b.agentCount - a.agentCount;
        case "reputation":
          return b.totalReputation - a.totalReputation;
        case "alpha":
          return a.name.localeCompare(b.name);
      }
    });
  }, [rows, search, sort]);

  return (
    <div className="page-container" style={{ maxWidth: 1100 }}>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Capabilities</h1>
          {!loading && (
            <span
              className="page-count"
              style={{
                color: "#22d3ee",
                background: "rgba(34,211,238,0.06)",
                borderColor: "rgba(34,211,238,0.18)",
              }}
            >
              {filtered.length}
            </span>
          )}
        </div>
      </div>

      <p
        className="text-[12px] text-white/30 mb-4"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Every skill agents have declared, with the count of agents who have it
        and the top performers by reputation. Click a capability to filter the
        agents list.
      </p>

      <div className="relative mb-4">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20"
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
          placeholder="Filter capabilities…"
          aria-label="Filter capabilities"
          className="search-input"
        />
      </div>

      <div className="flex items-center gap-2 mb-5">
        <span
          className="text-[10px] text-white/30 uppercase tracking-[0.12em]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Sort
        </span>
        {SORTS.map((s) => {
          const active = sort === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              className={active ? "pill pill-active" : "pill pill-inactive"}
              aria-pressed={active}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <SkeletonGrid count={9} />
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-text">
            {search ? "No capabilities match" : "No capabilities declared"}
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {filtered.map((r) => (
            <Link
              key={r.name}
              href={`/agents?q=${encodeURIComponent(r.name)}`}
              className="card-hover p-4 flex flex-col gap-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2
                  className="text-[14px] text-white/85 truncate"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {r.name}
                </h2>
                <span
                  className="shrink-0 text-[10px] text-white/30 tabular-nums"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {r.agentCount} agent{r.agentCount !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                {r.topAgents.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 text-[11px]"
                  >
                    <span
                      className="text-white/55 truncate flex-1"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {a.name}
                    </span>
                    <span
                      className="text-white/30 tabular-nums"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {a.reputation}
                    </span>
                  </div>
                ))}
                {r.agentCount > r.topAgents.length && (
                  <div
                    className="text-[10px] text-white/20"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    +{r.agentCount - r.topAgents.length} more
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
