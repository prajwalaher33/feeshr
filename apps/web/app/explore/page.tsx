"use client";

import { useState, useEffect } from "react";
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
      <div className="max-w-[1204px] mx-auto flex flex-col gap-10">
        {/* Top bar: tabs + filters */}
        <div className="flex items-center justify-between max-[768px]:flex-col max-[768px]:items-start max-[768px]:gap-4">
          <div className="flex items-center gap-2">
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

          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-secondary text-[13px] font-medium transition-all duration-250 hover:border-border-hover"
              style={{ fontFamily: "var(--font-body)", background: "linear-gradient(135deg, rgba(255,255,255,0.025), rgba(255,255,255,0.012))", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 1px 3px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.02)" }}
            >
              <svg width="13" height="9" viewBox="0 0 14 9" fill="none">
                <path d="M1 1H13M3 4.5H11M5 8H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Filters
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-secondary text-[13px] font-medium transition-all duration-250 hover:border-border-hover"
              style={{ fontFamily: "var(--font-body)", background: "linear-gradient(135deg, rgba(255,255,255,0.025), rgba(255,255,255,0.012))", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 1px 3px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.02)" }}
            >
              Sort: Trending
              <svg width="8" height="5" viewBox="0 0 9 6" fill="none">
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
          <div className="grid grid-cols-3 gap-5 max-[768px]:grid-cols-1">
            {activeTab === "projects" && (
              <>
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
                {projects.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-20">
                    <p className="text-muted text-sm">No projects found</p>
                  </div>
                )}
              </>
            )}

            {activeTab === "repos" && (
              <>
                {repos.map((repo) => (
                  <RepoCardFigma key={repo.id} repo={repo} />
                ))}
                {repos.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-20">
                    <p className="text-muted text-sm">No repos found</p>
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

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="card-hover p-5 flex flex-col h-[220px]"
    >
      {/* Top section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3
            className="text-[15px] font-semibold text-primary truncate"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {project.title}
          </h3>
          <span className="text-[9px] text-muted uppercase tracking-[1px] font-medium px-2 py-0.5 rounded-full border border-border bg-[rgba(255,255,255,0.02)] shrink-0 ml-2" style={{ fontFamily: "var(--font-mono)" }}>
            {project.status === "shipped" ? "SHIPPED" : project.status === "building" ? "WIP" : "MIT"}
          </span>
        </div>
        <p
          className="text-[12px] text-body line-clamp-2 leading-[1.7]"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {project.problem_statement}
        </p>
      </div>

      {/* Tags */}
      <div className="flex gap-1.5 mt-2">
        {(project.output_repo ? ["Python", "Rust"] : ["TypeScript"]).map((lang) => (
          <span key={lang} className="tag">{lang}</span>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer */}
      <div className="border-t border-divider pt-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[11px] text-muted" style={{ fontFamily: "var(--font-mono)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            {(project.discussion_count * 10 + 200).toLocaleString()}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted" style={{ fontFamily: "var(--font-mono)" }}>
            <svg width="8" height="11" viewBox="0 0 10 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 1V13M5 1L1 5M5 1L9 5"/>
            </svg>
            {project.team.length * 100 + 100}
          </span>
        </div>
        <div className="flex items-center">
          <div className="w-6 h-6 rounded-full bg-[rgba(255,255,255,0.04)] border border-border flex items-center justify-center">
            <span className="text-[8px] text-muted font-medium" style={{ fontFamily: "var(--font-mono)" }}>
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
      className="card-hover p-5 flex flex-col h-[220px]"
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3
            className="text-[15px] font-semibold text-primary truncate"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {repo.name}
          </h3>
          {repo.published_to && (
            <span className="text-[9px] text-muted uppercase tracking-[1px] font-medium px-2 py-0.5 rounded-full border border-border bg-[rgba(255,255,255,0.02)] shrink-0 ml-2" style={{ fontFamily: "var(--font-mono)" }}>
              {repo.published_to}
            </span>
          )}
        </div>
        <p
          className="text-[12px] text-body line-clamp-2 leading-[1.7]"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {repo.description}
        </p>
      </div>

      <div className="flex gap-1.5 mt-2">
        {repo.languages.slice(0, 3).map((lang) => (
          <span key={lang} className="tag">{lang}</span>
        ))}
      </div>

      <div className="flex-1" />

      <div className="border-t border-divider pt-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[11px] text-muted" style={{ fontFamily: "var(--font-mono)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            {repo.stars >= 1000 ? (repo.stars / 1000).toFixed(1) + "k" : repo.stars}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted" style={{ fontFamily: "var(--font-mono)" }}>
            <svg width="8" height="11" viewBox="0 0 10 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 1V13M5 1L1 5M5 1L9 5"/>
            </svg>
            {repo.forks >= 1000 ? (repo.forks / 1000).toFixed(1) + "k" : repo.forks}
          </span>
        </div>
        <div className="flex items-center">
          <div className="w-6 h-6 rounded-full bg-[rgba(255,255,255,0.04)] border border-border flex items-center justify-center">
            <span className="text-[8px] text-muted font-medium" style={{ fontFamily: "var(--font-mono)" }}>
              +{repo.contributors}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
