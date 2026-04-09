"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { fetchRepos, fetchProjects } from "@/lib/api";
import type { Repo } from "@/lib/types/repos";
import type { Project } from "@/lib/types/projects";

type Tab = "projects" | "repos";

export default function ExplorePage() {
  const [activeTab, setActiveTab] = useState<Tab>("projects");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const load = async () => {
      if (activeTab === "repos") {
        const data = await fetchRepos();
        setRepos(data);
      } else {
        const data = await fetchProjects();
        setProjects(data);
      }
      setLoading(false);
    };
    load();
  }, [activeTab]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "projects", label: "Projects" },
    { key: "repos", label: "Repos" },
  ];

  return (
    <div className="px-[118px] pt-10 pb-20 max-[1024px]:px-6 max-[768px]:px-4">
      <div className="max-w-[1204px] mx-auto flex flex-col gap-12">
        {/* Top bar: tabs + filters */}
        <div className="flex items-center justify-between max-[768px]:flex-col max-[768px]:items-start max-[768px]:gap-4">
          <div className="flex items-center gap-3">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={activeTab === tab.key ? "pill pill-active" : "pill pill-inactive"}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-border text-[#dee1f9] text-sm font-medium transition-colors hover:border-border-hover"
              style={{ fontFamily: "var(--font-body)" }}
            >
              <svg width="14" height="9" viewBox="0 0 14 9" fill="none">
                <path d="M1 1H13M3 4.5H11M5 8H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Filters
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-border text-[#dee1f9] text-sm font-medium transition-colors hover:border-border-hover"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Sort: Trending
              <svg width="9" height="6" viewBox="0 0 9 6" fill="none">
                <path d="M1 1L4.5 5L8 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-cyan" />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {activeTab === "projects" && (
              <>
                {/* 3-col grid */}
                {chunkArray(projects, 3).map((row, ri) => (
                  <div key={ri} className="flex gap-5 max-[768px]:flex-col">
                    {row.map((project) => (
                      <ProjectCard key={project.id} project={project} />
                    ))}
                    {/* Fill empty slots */}
                    {row.length < 3 && Array.from({ length: 3 - row.length }).map((_, i) => (
                      <div key={`empty-${i}`} className="flex-1 min-w-0" />
                    ))}
                  </div>
                ))}
                {projects.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20">
                    <p className="text-secondary text-sm">No projects found</p>
                  </div>
                )}
              </>
            )}

            {activeTab === "repos" && (
              <>
                {chunkArray(repos, 3).map((row, ri) => (
                  <div key={ri} className="flex gap-5 max-[768px]:flex-col">
                    {row.map((repo) => (
                      <RepoCardFigma key={repo.id} repo={repo} />
                    ))}
                    {row.length < 3 && Array.from({ length: 3 - row.length }).map((_, i) => (
                      <div key={`empty-${i}`} className="flex-1 min-w-0" />
                    ))}
                  </div>
                ))}
                {repos.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20">
                    <p className="text-secondary text-sm">No repos found</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="flex-1 min-w-0 bg-surface border border-border rounded-2xl p-6 flex flex-col justify-between h-[202px] hover:border-border-hover transition-colors"
    >
      {/* Top section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3
            className="text-lg font-semibold text-primary truncate"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {project.title}
          </h3>
          <span className="tag !rounded-full !px-2.5 !py-1 text-secondary uppercase tracking-[1px] !text-[10px] !border-border !bg-tag-bg">
            {project.status === "shipped" ? "SHIPPED" : project.status === "building" ? "WIP" : "MIT"}
          </span>
        </div>
        <p
          className="text-sm text-body line-clamp-2 leading-[22.75px]"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {project.problem_statement}
        </p>
      </div>

      {/* Tags */}
      <div className="flex gap-1 mb-auto mt-2">
        {(project.output_repo ? ["Python", "Rust"] : ["TypeScript"]).map((lang) => (
          <span key={lang} className="tag">{lang}</span>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-divider pt-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-muted" style={{ fontFamily: "var(--font-mono)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            {(project.discussion_count * 10 + 200).toLocaleString()}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted" style={{ fontFamily: "var(--font-mono)" }}>
            <svg width="9" height="12" viewBox="0 0 10 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 1V13M5 1L1 5M5 1L9 5"/>
            </svg>
            {project.team.length * 100 + 100}
          </span>
        </div>
        <div className="flex items-center">
          <div className="w-7 h-7 rounded-full bg-divider border-2 border-surface flex items-center justify-center">
            <span className="text-[8px] text-[#cbd5e1] font-semibold" style={{ fontFamily: "var(--font-body)" }}>
              +{project.team.length}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function RepoCardFigma({ repo }: { repo: Repo }) {
  return (
    <Link
      href={`/repos/${repo.id}`}
      className="flex-1 min-w-0 bg-surface border border-border rounded-2xl p-6 flex flex-col justify-between h-[202px] hover:border-border-hover transition-colors"
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3
            className="text-lg font-semibold text-primary truncate"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {repo.name}
          </h3>
          {repo.published_to && (
            <span className="tag !rounded-full !px-2.5 !py-1 text-secondary uppercase tracking-[1px] !text-[10px] !border-border !bg-tag-bg">
              {repo.published_to}
            </span>
          )}
        </div>
        <p
          className="text-sm text-body line-clamp-2 leading-[22.75px]"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {repo.description}
        </p>
      </div>

      <div className="flex gap-1 mb-auto mt-2">
        {repo.languages.slice(0, 3).map((lang) => (
          <span key={lang} className="tag">{lang}</span>
        ))}
      </div>

      <div className="border-t border-divider pt-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-muted" style={{ fontFamily: "var(--font-mono)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            {repo.stars >= 1000 ? (repo.stars / 1000).toFixed(1) + "k" : repo.stars}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted" style={{ fontFamily: "var(--font-mono)" }}>
            <svg width="9" height="12" viewBox="0 0 10 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 1V13M5 1L1 5M5 1L9 5"/>
            </svg>
            {repo.forks >= 1000 ? (repo.forks / 1000).toFixed(1) + "k" : repo.forks}
          </span>
        </div>
        <div className="flex items-center">
          <div className="w-7 h-7 rounded-full bg-divider border-2 border-surface flex items-center justify-center">
            <span className="text-[8px] text-[#cbd5e1] font-semibold" style={{ fontFamily: "var(--font-body)" }}>
              +{repo.contributors}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
