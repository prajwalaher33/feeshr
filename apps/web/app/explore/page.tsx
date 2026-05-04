"use client";

import { useState, useEffect, useMemo, memo } from "react";
import Link from "next/link";
import { fetchRepos, fetchProjects } from "@/lib/api";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { StarToggle } from "@/components/ui/StarToggle";
import { useStarred } from "@/lib/hooks/useStarred";
import type { Repo } from "@/lib/types/repos";
import type { Project } from "@/lib/types/projects";

type Tab = "projects" | "repos";
type RepoSort = "stars" | "recent" | "forks" | "name";
type ProjectSort = "recent" | "discussion" | "name";

const REPO_SORTS: { key: RepoSort; label: string }[] = [
  { key: "stars", label: "Most stars" },
  { key: "forks", label: "Most forks" },
  { key: "recent", label: "Recently updated" },
  { key: "name", label: "Name (A-Z)" },
];

const PROJECT_SORTS: { key: ProjectSort; label: string }[] = [
  { key: "recent", label: "Recently created" },
  { key: "discussion", label: "Most discussion" },
  { key: "name", label: "Name (A-Z)" },
];

export default function ExplorePage() {
  const [activeTab, setActiveTab] = useState<Tab>("projects");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [repoSort, setRepoSort] = useState<RepoSort>("stars");
  const [projectSort, setProjectSort] = useState<ProjectSort>("recent");
  const [starredOnly, setStarredOnly] = useState(false);
  const { isStarred: isRepoStarred, count: starredRepoCount } = useStarred("repos");

  useEffect(() => {
    setLoading(true);
    setError(false);
    setSearch("");
    const load = async () => {
      try {
        if (activeTab === "repos") {
          setRepos(await fetchRepos());
        } else {
          setProjects(await fetchProjects());
        }
      } catch {
        setError(true);
      }
      setLoading(false);
    };
    load();
  }, [activeTab]);

  const filteredProjects = useMemo(() => {
    const q = search.toLowerCase();
    const result = projects.filter(
      (p) => !q || p.title.toLowerCase().includes(q) || p.problem_statement.toLowerCase().includes(q),
    );
    return result.sort((a, b) => {
      switch (projectSort) {
        case "name": return a.title.localeCompare(b.title);
        case "discussion": return b.discussion_count - a.discussion_count;
        case "recent": return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
      }
    });
  }, [projects, search, projectSort]);

  const filteredRepos = useMemo(() => {
    const q = search.toLowerCase();
    const result = repos.filter((r) => {
      const matchesSearch = !q || r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
      const matchesStarred = !starredOnly || isRepoStarred(r.id);
      return matchesSearch && matchesStarred;
    });
    return result.sort((a, b) => {
      switch (repoSort) {
        case "name": return a.name.localeCompare(b.name);
        case "stars": return b.stars - a.stars;
        case "forks": return b.forks - a.forks;
        case "recent": return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });
  }, [repos, search, repoSort, starredOnly, isRepoStarred]);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "projects", label: "Projects", count: projects.length || undefined },
    { key: "repos", label: "Repos", count: repos.length || undefined },
  ];

  const retry = () => {
    setError(false);
    setLoading(true);
    const load = async () => {
      try {
        if (activeTab === "repos") setRepos(await fetchRepos());
        else setProjects(await fetchProjects());
      } catch { setError(true); }
      setLoading(false);
    };
    load();
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Explore</h1>
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={activeTab === tab.key ? "pill pill-active" : "pill pill-inactive"}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1.5 opacity-60 text-[10px]">{tab.count}</span>
              )}
            </button>
          ))}
          {activeTab === "repos" && starredRepoCount > 0 && (
            <button
              onClick={() => setStarredOnly((v) => !v)}
              aria-pressed={starredOnly}
              className={`pill ${starredOnly ? "pill-active" : "pill-inactive"} flex items-center gap-1.5`}
              style={starredOnly ? { color: "#f59e0b", borderColor: "rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.08)" } : undefined}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Starred
              <span className="opacity-60 text-[10px]">{starredRepoCount}</span>
            </button>
          )}
        </div>
      </div>

      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">
            <path d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${activeTab}...`}
            aria-label={`Search ${activeTab}`}
            className="search-input"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-white/30 uppercase tracking-[0.1em] shrink-0" style={{ fontFamily: "var(--font-mono)" }}>
            Sort
          </label>
          {activeTab === "repos" ? (
            <select
              value={repoSort}
              onChange={(e) => setRepoSort(e.target.value as RepoSort)}
              aria-label="Sort repos"
              className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] text-white/80 hover:border-white/[0.12] focus:border-cyan/40 focus:outline-none transition-colors cursor-pointer"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {REPO_SORTS.map((opt) => <option key={opt.key} value={opt.key} className="bg-[#0a0e15]">{opt.label}</option>)}
            </select>
          ) : (
            <select
              value={projectSort}
              onChange={(e) => setProjectSort(e.target.value as ProjectSort)}
              aria-label="Sort projects"
              className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] text-white/80 hover:border-white/[0.12] focus:border-cyan/40 focus:outline-none transition-colors cursor-pointer"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {PROJECT_SORTS.map((opt) => <option key={opt.key} value={opt.key} className="bg-[#0a0e15]">{opt.label}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <SkeletonGrid count={6} height={220} />
      ) : error ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/15">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <span className="empty-state-text">Failed to load</span>
          <button onClick={retry} className="mt-3 px-4 py-2 rounded-lg bg-cyan/[0.08] border border-cyan/[0.15] text-[12px] text-cyan font-medium hover:bg-cyan/[0.12] transition-colors" style={{ fontFamily: "var(--font-display)" }}>
            Try again
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeTab === "projects" && (
            <>
              {filteredProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
              {filteredProjects.length === 0 && (
                <div className="col-span-full empty-state">
                  <div className="empty-state-icon">
                    <div className="w-3 h-3 rounded-full bg-white/[0.08]" />
                  </div>
                  <span className="empty-state-text">{search ? `No projects match "${search}"` : "No projects found"}</span>
                </div>
              )}
            </>
          )}
          {activeTab === "repos" && (
            <>
              {filteredRepos.map((repo) => (
                <RepoCard key={repo.id} repo={repo} />
              ))}
              {filteredRepos.length === 0 && (
                <div className="col-span-full empty-state">
                  <div className="empty-state-icon">
                    <div className="w-3 h-3 rounded-full bg-white/[0.08]" />
                  </div>
                  <span className="empty-state-text">{search ? `No repos match "${search}"` : "No repos found"}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const ProjectCard = memo(function ProjectCard({ project }: { project: Project }) {
  const statusColor = project.status === "shipped" ? "#50fa7b" : project.status === "building" ? "#f7c948" : "#64748b";

  return (
    <Link href={`/projects/${project.id}`} className="card-hover p-5 flex flex-col h-[220px]">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[15px] font-semibold text-white truncate" style={{ fontFamily: "var(--font-display)" }}>
          {project.title}
        </h3>
        <span className="status-chip shrink-0 ml-2" style={{ color: statusColor, background: `${statusColor}0a`, border: `1px solid ${statusColor}18` }}>
          {project.status === "shipped" ? "SHIPPED" : project.status === "building" ? "WIP" : "OPEN"}
        </span>
      </div>
      <p className="text-[12px] text-white/30 line-clamp-2 leading-[1.7]">
        {project.problem_statement}
      </p>
      <div className="flex gap-1.5 mt-3">
        {(project.output_repo ? ["Python", "Rust"] : ["TypeScript"]).map((lang) => (
          <span key={lang} className="tag">{lang}</span>
        ))}
      </div>
      <div className="flex-1" />
      <div className="border-t border-white/[0.05] pt-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[11px] text-white/25" style={{ fontFamily: "var(--font-mono)" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            {(project.discussion_count * 10 + 200).toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-white/20" style={{ fontFamily: "var(--font-mono)" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
          </svg>
          {project.team.length}
        </div>
      </div>
    </Link>
  );
});

const RepoCard = memo(function RepoCard({ repo }: { repo: Repo }) {
  return (
    <Link href={`/repos/${repo.id}`} className="card-hover p-5 flex flex-col h-[220px]">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[15px] font-semibold text-white truncate" style={{ fontFamily: "var(--font-display)" }}>
          {repo.name}
        </h3>
        {repo.published_to && (
          <span className="status-chip shrink-0 ml-2" style={{ color: "#8b5cf6", background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)" }}>
            {repo.published_to}
          </span>
        )}
      </div>
      <p className="text-[12px] text-white/30 line-clamp-2 leading-[1.7]">
        {repo.description}
      </p>
      <div className="flex gap-1.5 mt-3">
        {repo.languages.slice(0, 3).map((lang) => (
          <span key={lang} className="tag">{lang}</span>
        ))}
      </div>
      <div className="flex-1" />
      <div className="border-t border-white/[0.05] pt-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[11px] text-white/25" style={{ fontFamily: "var(--font-mono)" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            {repo.stars >= 1000 ? (repo.stars / 1000).toFixed(1) + "k" : repo.stars}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-white/25" style={{ fontFamily: "var(--font-mono)" }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><circle cx="18" cy="6" r="3" />
              <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9" /><path d="M12 12v3" />
            </svg>
            {repo.forks >= 1000 ? (repo.forks / 1000).toFixed(1) + "k" : repo.forks}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-white/15" style={{ fontFamily: "var(--font-mono)" }}>
            {repo.contributors} contributors
          </span>
          <StarToggle id={repo.id} kind="repos" size={13} />
        </div>
      </div>
    </Link>
  );
});
