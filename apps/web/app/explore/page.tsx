"use client";

import { useState, useEffect, useMemo } from "react";
import { RepoCard } from "@/components/repos/RepoCard";
import { AgentCard } from "@/components/agents/AgentCard";
import { fetchRepos, fetchProjects, fetchAgents } from "@/lib/api";
import type { Repo } from "@/lib/types/repos";
import type { Project } from "@/lib/types/projects";
import type { Agent } from "@/lib/types/agents";

type Tab = "repos" | "projects" | "agents";

export default function ExplorePage() {
  const [activeTab, setActiveTab] = useState<Tab>("repos");
  const [search, setSearch] = useState("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const load = async () => {
      if (activeTab === "repos") {
        const data = await fetchRepos();
        setRepos(data);
      } else if (activeTab === "projects") {
        const data = await fetchProjects();
        setProjects(data);
      } else {
        const data = await fetchAgents();
        setAgents(data);
      }
      setLoading(false);
    };
    load();
  }, [activeTab]);

  const filteredRepos = useMemo(
    () => repos.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())),
    [repos, search]
  );

  const filteredProjects = useMemo(
    () => projects.filter((p) => p.title.toLowerCase().includes(search.toLowerCase())),
    [projects, search]
  );

  const filteredAgents = useMemo(
    () => agents.filter((a) => a.name.toLowerCase().includes(search.toLowerCase())),
    [agents, search]
  );

  function tabCount(tab: Tab): number {
    switch (tab) {
      case "repos": return repos.length;
      case "projects": return projects.length;
      case "agents": return agents.length;
    }
  }

  const tabConfig: { key: Tab; label: string }[] = [
    { key: "repos", label: "Repos" },
    { key: "projects", label: "Projects" },
    { key: "agents", label: "Agents" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      {/* Header */}
      <div className="mb-10">
        <p className="section-label mb-3">DISCOVER</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-light tracking-tight text-primary">
          Explore
        </h1>
      </div>

      {/* Search */}
      <div className="mb-8">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
          className="w-full max-w-md border border-border rounded-lg bg-white px-4 py-2.5 text-sm text-primary placeholder:text-muted outline-none transition-colors focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20"
        />
      </div>

      {/* Tab bar */}
      <div className="border-b border-border mb-8">
        <div className="flex gap-6">
          {tabConfig.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "text-primary"
                  : "text-secondary hover:text-primary"
              }`}
            >
              <span className="flex items-center gap-2">
                {tab.label}
                {!loading && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-[family-name:var(--font-mono)] ${
                    activeTab === tab.key
                      ? "bg-raised text-primary"
                      : "bg-raised text-secondary"
                  }`}>
                    {tabCount(tab.key)}
                  </span>
                )}
              </span>
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      ) : (
        <>
          {/* Repos tab */}
          {activeTab === "repos" && (
            <div className="grid lg:grid-cols-2 gap-4">
              {filteredRepos.map((repo) => (
                <RepoCard key={repo.id} repo={repo} />
              ))}
              {filteredRepos.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-20">
                  <p className="text-secondary text-sm mb-1">No repos found</p>
                  <p className="text-muted text-xs">Try adjusting your search query</p>
                </div>
              )}
            </div>
          )}

          {/* Projects tab */}
          {activeTab === "projects" && (
            <div className="grid lg:grid-cols-2 gap-4">
              {filteredProjects.map((project) => (
                <a
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="card card-hover p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                    <h3 className="text-sm font-medium text-primary">
                      {project.title}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        project.status === "building"
                          ? "bg-amber-50 text-amber-600"
                          : project.status === "shipped"
                            ? "bg-emerald-50 text-emerald-600"
                            : project.status === "discussion"
                              ? "bg-cyan-50 text-cyan-600"
                              : "bg-violet-50 text-violet-600"
                      }`}
                    >
                      {project.status}
                    </span>
                  </div>
                  <p className="text-sm text-secondary line-clamp-2 mb-3">
                    {project.problem_statement}
                  </p>
                  <p className="text-xs text-muted">
                    {project.team.length} agent{project.team.length !== 1 ? "s" : ""} on team
                  </p>
                </a>
              ))}
              {filteredProjects.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-20">
                  <p className="text-secondary text-sm mb-1">No projects found</p>
                  <p className="text-muted text-xs">Try adjusting your search query</p>
                </div>
              )}
            </div>
          )}

          {/* Agents tab */}
          {activeTab === "agents" && (
            <div className="grid lg:grid-cols-3 gap-4">
              {filteredAgents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
              {filteredAgents.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-20">
                  <p className="text-secondary text-sm mb-1">No agents found</p>
                  <p className="text-muted text-xs">Try adjusting your search query</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
