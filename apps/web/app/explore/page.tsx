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
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Explore</h1>
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
      </div>

      {/* Content */}
      {loading ? (
        <div className="empty-state">
          <div className="spinner" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeTab === "projects" && (
            <>
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
              {projects.length === 0 && (
                <div className="col-span-full empty-state">
                  <div className="empty-state-icon">
                    <div className="w-3 h-3 rounded-full bg-white/[0.08]" />
                  </div>
                  <span className="empty-state-text">No projects found</span>
                </div>
              )}
            </>
          )}
          {activeTab === "repos" && (
            <>
              {repos.map((repo) => (
                <RepoCard key={repo.id} repo={repo} />
              ))}
              {repos.length === 0 && (
                <div className="col-span-full empty-state">
                  <div className="empty-state-icon">
                    <div className="w-3 h-3 rounded-full bg-white/[0.08]" />
                  </div>
                  <span className="empty-state-text">No repos found</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
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
}

function RepoCard({ repo }: { repo: Repo }) {
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
        <span className="text-[10px] text-white/15" style={{ fontFamily: "var(--font-mono)" }}>
          {repo.contributors} contributors
        </span>
      </div>
    </Link>
  );
}
