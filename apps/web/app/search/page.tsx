"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { searchAll } from "@/lib/api";

interface SearchResult {
  id: string;
  result_type: string;
  title: string;
  description: string;
  score: number;
}

const TYPE_META: Record<
  string,
  { label: string; color: string; href: (id: string) => string }
> = {
  agent: {
    label: "Agents",
    color: "#22d3ee",
    href: (id) => `/agents/${id}`,
  },
  repo: {
    label: "Repositories",
    color: "#8b5cf6",
    href: (id) => `/repos/${id}`,
  },
  project: {
    label: "Projects",
    color: "#50fa7b",
    href: (id) => `/projects/${id}`,
  },
  issue: {
    label: "Issues",
    color: "#f7c948",
    href: (id) => `/issues/${id}`,
  },
};

const GROUP_ORDER = ["agent", "repo", "project", "issue"];

function SearchPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const initialQ = params?.get("q") ?? "";
  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Re-run the search whenever the URL `q` param changes (e.g. someone
  // navigates here from elsewhere with a new query).
  useEffect(() => {
    const q = params?.get("q") ?? "";
    setQuery(q);
    if (q.trim().length >= 2) {
      runSearch(q);
    } else {
      setResults([]);
      setTotal(0);
      setHasSearched(false);
    }
  }, [params]);

  async function runSearch(q: string) {
    setLoading(true);
    setHasSearched(true);
    const data = await searchAll(q.trim());
    setResults(data.results);
    setTotal(data.total);
    setLoading(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    // Push so the URL becomes shareable / history navigates correctly.
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  // Group results by their result_type.
  const groups = useMemo(() => {
    const out: Record<string, SearchResult[]> = {};
    for (const r of results) {
      const k = r.result_type ?? "other";
      (out[k] = out[k] ?? []).push(r);
    }
    return out;
  }, [results]);

  return (
    <div className="page-container" style={{ maxWidth: 920 }}>
      <div className="page-header">
        <h1 className="page-title">Search</h1>
        {hasSearched && total > 0 && (
          <span
            className="page-count"
            style={{
              color: "#22d3ee",
              background: "rgba(34,211,238,0.06)",
              borderColor: "rgba(34,211,238,0.18)",
            }}
          >
            {total}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20"
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
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents, repos, projects, issues..."
            className="search-input w-full"
            autoFocus
          />
        </div>
      </form>

      {!hasSearched && (
        <div className="empty-state">
          <span className="empty-state-text">
            Type a query and press enter
          </span>
        </div>
      )}

      {hasSearched && loading && (
        <div className="empty-state">
          <div className="spinner" />
        </div>
      )}

      {hasSearched && !loading && results.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-text">
            No matches for &ldquo;{query}&rdquo;
          </span>
        </div>
      )}

      {hasSearched && !loading && results.length > 0 && (
        <div className="flex flex-col gap-6">
          {GROUP_ORDER.filter((k) => groups[k]?.length).map((kind) => {
            const meta = TYPE_META[kind] ?? {
              label: kind,
              color: "#64748b",
              href: () => "#",
            };
            const items = groups[kind];
            return (
              <section key={kind}>
                <div className="flex items-baseline gap-2 mb-2">
                  <h2
                    className="text-[12px] uppercase tracking-[0.1em]"
                    style={{ color: meta.color, fontFamily: "var(--font-mono)" }}
                  >
                    {meta.label}
                  </h2>
                  <span
                    className="text-[10px] text-white/30"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {items.length}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {items.map((r) => (
                    <Link
                      key={`${r.result_type}-${r.id}`}
                      href={meta.href(r.id)}
                      className="list-row hover:bg-white/[0.03] transition-colors block"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full"
                          style={{
                            backgroundColor: meta.color,
                            boxShadow: `0 0 4px ${meta.color}66`,
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="list-row-title truncate">
                              {r.title || r.id.slice(0, 12)}
                            </span>
                            <span
                              className="text-[10px] text-white/25 ml-auto shrink-0"
                              style={{ fontFamily: "var(--font-mono)" }}
                            >
                              score {r.score.toFixed(2)}
                            </span>
                          </div>
                          {r.description && (
                            <p className="text-[12px] text-white/45 mt-0.5 truncate">
                              {r.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
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

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="page-container">
          <div className="empty-state">
            <div className="spinner" />
          </div>
        </div>
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}
