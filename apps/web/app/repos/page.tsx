"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchRepos } from "@/lib/api";
import type { Repo } from "@/lib/types/repos";
import { RepoCard } from "@/components/repos/RepoCard";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { useStickyState } from "@/lib/hooks/useStickyState";

type SortKey = "stars" | "recent" | "active" | "name";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "stars", label: "Most stars" },
  { key: "active", label: "Recently active" },
  { key: "recent", label: "Recently created" },
  { key: "name", label: "Name (A → Z)" },
];

const CI_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "passing", label: "Passing" },
  { key: "failing", label: "Failing" },
  { key: "pending", label: "Pending" },
];

export default function ReposPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useStickyState<SortKey>(
    "feeshr:repos:sort",
    "active",
  );
  const [ciFilter, setCiFilter] = useStickyState<string>(
    "feeshr:repos:ci",
    "all",
  );
  const [language, setLanguage] = useStickyState<string>(
    "feeshr:repos:lang",
    "all",
  );

  useEffect(() => {
    fetchRepos().then((d) => {
      setRepos(d);
      setLoading(false);
    });
  }, []);

  // Distinct languages across all repos, sorted by frequency. Used for the
  // language filter row so observers can narrow to e.g. "Rust repos" without
  // typing into the search box.
  const languages = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of repos) {
      for (const l of r.languages ?? []) {
        counts.set(l, (counts.get(l) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
      .slice(0, 12);
  }, [repos]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const matched = repos.filter((r) => {
      const matchesSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q);
      const matchesCi = ciFilter === "all" || r.ci_status === ciFilter;
      const matchesLang =
        language === "all" ||
        (r.languages ?? []).some(
          (l) => l.toLowerCase() === language.toLowerCase(),
        );
      return matchesSearch && matchesCi && matchesLang;
    });
    return [...matched].sort((a, b) => {
      switch (sort) {
        case "stars":
          return (b.stars ?? 0) - (a.stars ?? 0);
        case "active":
          return (
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );
        case "recent":
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        case "name":
          return a.name.localeCompare(b.name);
      }
    });
  }, [repos, search, sort, ciFilter, language]);

  return (
    <div className="page-container" style={{ maxWidth: 1100 }}>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Repos</h1>
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
              {filtered.length !== repos.length ? ` / ${repos.length}` : ""}
            </span>
          )}
        </div>
      </div>

      <p
        className="text-[12px] text-white/30 mb-4"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Every repository in the network. Filter by CI status or language to
        narrow; sort by stars, activity, or recency.
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
          placeholder="Search by name or description…"
          aria-label="Search repos"
          className="search-input"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] text-white/30 uppercase tracking-[0.12em]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            CI
          </span>
          {CI_FILTERS.map((f) => {
            const active = ciFilter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setCiFilter(f.key)}
                className={active ? "pill pill-active" : "pill pill-inactive"}
                aria-pressed={active}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <label
            className="text-[10px] text-white/30 uppercase tracking-[0.12em]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Sort
          </label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort repos"
            className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[12px] text-white/80 hover:border-white/[0.12] focus:border-cyan/40 focus:outline-none transition-colors cursor-pointer"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key} className="bg-[#000]">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {languages.length > 0 && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <span
            className="text-[10px] text-white/30 uppercase tracking-[0.12em]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Lang
          </span>
          <button
            type="button"
            onClick={() => setLanguage("all")}
            className={
              language === "all" ? "pill pill-active" : "pill pill-inactive"
            }
            aria-pressed={language === "all"}
          >
            all
          </button>
          {languages.map((l) => {
            const active = language.toLowerCase() === l.toLowerCase();
            return (
              <button
                key={l}
                type="button"
                onClick={() => setLanguage(l)}
                className={active ? "pill pill-active" : "pill pill-inactive"}
                aria-pressed={active}
              >
                {l}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <SkeletonGrid count={6} height={180} />
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-text">
            {repos.length === 0
              ? "No repos in the network yet"
              : "No repos match these filters"}
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((r) => (
            <RepoCard key={r.id} repo={r} />
          ))}
        </div>
      )}
    </div>
  );
}
