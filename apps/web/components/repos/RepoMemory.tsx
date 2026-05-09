"use client";

import { useEffect, useState, useMemo } from "react";
import {
  fetchScopedMemory,
  searchScopedMemory,
  type MemoryEntry,
  type MemoryEntryType,
} from "@/lib/api";
import { TimeAgo } from "@/components/ui/TimeAgo";

const ENTRY_META: Record<MemoryEntryType, { label: string; color: string; hint: string }> = {
  decision: {
    label: "Decision",
    color: "#22d3ee",
    hint: "We chose X over Y because Z",
  },
  failed_approach: {
    label: "Failed approach",
    color: "#ff6b6b",
    hint: "Tried X, didn't work because Y",
  },
  architecture: {
    label: "Architecture",
    color: "#8b5cf6",
    hint: "Component A talks to B via C",
  },
  dependency: {
    label: "Dependency",
    color: "#6366f1",
    hint: "Depends on X v2.0 for Y",
  },
  constraint: {
    label: "Constraint",
    color: "#f7c948",
    hint: "Must support Python 3.10+",
  },
  context: {
    label: "Context",
    color: "#64748b",
    hint: "General working context",
  },
  api_contract: {
    label: "API contract",
    color: "#28c840",
    hint: "Endpoint X returns shape Y",
  },
  todo: {
    label: "Todo",
    color: "#f97316",
    hint: "Edge case still to handle",
  },
  warning: {
    label: "Warning",
    color: "#ef4444",
    hint: "Do NOT do X, it causes Y",
  },
};

const TYPE_ORDER: MemoryEntryType[] = [
  "warning",
  "constraint",
  "decision",
  "architecture",
  "api_contract",
  "dependency",
  "failed_approach",
  "todo",
  "context",
];

interface RepoMemoryProps {
  repoId: string;
}

function formatValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function RepoMemory({ repoId }: RepoMemoryProps) {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  // Initial load — full list grouped by type.
  useEffect(() => {
    setLoading(true);
    fetchScopedMemory("repo", repoId).then((d) => {
      setEntries(d.entries);
      setLoading(false);
    });
  }, [repoId]);

  // Re-fetch (search vs full) on query changes, debounced.
  useEffect(() => {
    const q = query.trim();
    const handle = setTimeout(() => {
      if (q.length === 0) {
        setSearching(false);
        fetchScopedMemory("repo", repoId).then((d) => setEntries(d.entries));
      } else if (q.length >= 2) {
        setSearching(true);
        searchScopedMemory("repo", repoId, q).then((d) => setEntries(d.entries));
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query, repoId]);

  // Group by entry_type.
  const grouped = useMemo(() => {
    const out: Record<string, MemoryEntry[]> = {};
    for (const e of entries) {
      (out[e.entry_type] = out[e.entry_type] ?? []).push(e);
    }
    return out;
  }, [entries]);

  if (loading) {
    return (
      <div className="card px-4 py-6 text-[12px] text-white/30" style={{ fontFamily: "var(--font-mono)" }}>
        Loading memory…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search memory entries..."
          className="search-input flex-1"
          aria-label="Search project memory"
        />
        {searching && (
          <span
            className="text-[10px] text-white/30 shrink-0"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            search results
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-text">
            {query.trim()
              ? `No memory entries match "${query}"`
              : "No memory entries yet for this repo"}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {TYPE_ORDER.filter((k) => grouped[k]?.length).map((type) => {
            const meta = ENTRY_META[type];
            const items = grouped[type];
            return (
              <section key={type}>
                <div className="flex items-baseline gap-2 mb-2">
                  <h3
                    className="text-[12px] uppercase tracking-[0.1em]"
                    style={{ color: meta.color, fontFamily: "var(--font-mono)" }}
                  >
                    {meta.label}
                  </h3>
                  <span
                    className="text-[10px] text-white/30"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {items.length}
                  </span>
                  <span
                    className="text-[10px] text-white/20 ml-2"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {meta.hint}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((e) => (
                    <div key={e.id} className="card p-3">
                      <div
                        className="flex items-baseline gap-2 mb-1.5 text-[11px]"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        <span className="text-white/85 truncate">{e.key}</span>
                        <span className="text-white/30 ml-auto shrink-0">
                          {e.contributed_by.slice(0, 12)} ·{" "}
                          <TimeAgo iso={e.created_at} />
                        </span>
                      </div>
                      <pre
                        className="text-[12px] text-white/65 leading-relaxed whitespace-pre-wrap m-0 max-h-48 overflow-auto"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {formatValue(e.value)}
                      </pre>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
