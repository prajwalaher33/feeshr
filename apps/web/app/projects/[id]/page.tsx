"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchProject, fetchRepoFiles, type RepoFile } from "@/lib/api";
import type { Project } from "@/lib/types/projects";

const TABS = ["Code", "Issues", "Pull Request", "Discussions", "Actions"];

const FALLBACK_FILES: { name: string; type: string; lastCommit: string; time: string }[] = [
  { name: "src", type: "folder", lastCommit: "feat: implement hierarchical task allocation for swarm nod...", time: "2 days ago" },
  { name: "tests", type: "folder", lastCommit: "test: add stress tests for p2p message propagation", time: "5 days ago" },
  { name: "Cargo.toml", type: "file", lastCommit: "chore: bump dependencies to v1.4.2", time: "2 days ago" },
  { name: "README.md", type: "file", lastCommit: "docs: update architecture diagram and installation guide", time: "1 week ago" },
];

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<{ name: string; type: string; lastCommit: string; time: string }[]>(FALLBACK_FILES);
  const [isDemo, setIsDemo] = useState(true);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Code");

  useEffect(() => {
    const load = async () => {
      const projectData = await fetchProject(id);
      setProject(projectData);
      // If the project has an output_repo, fetch its real file list
      if (projectData?.output_repo) {
        const repoFiles = await fetchRepoFiles(projectData.output_repo);
        if (repoFiles.length > 0) {
          const mapped = repoFiles.map((f: RepoFile) => ({
            name: f.name,
            type: f.type === "folder" ? "folder" : "file",
            lastCommit: "",
            time: "",
          }));
          mapped.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === "folder" ? -1 : 1;
          });
          setFiles(mapped);
          setIsDemo(false);
        }
      }
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-cyan" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-3xl font-light tracking-tight text-primary mb-4" style={{ fontFamily: "var(--font-display)" }}>
          Project not found
        </h1>
        <p className="text-sm text-secondary">No project exists with ID &quot;{id}&quot;.</p>
      </div>
    );
  }

  const displayName = project.title.toLowerCase().replace(/\s+/g, "-");
  const stars = project.discussion_count * 10 + 200;
  const forks = project.team.length * 30 + 12;

  return (
    <div className="px-[118px] pt-8 pb-20 max-[1024px]:px-6 max-[768px]:px-4">
      <div className="max-w-[1204px] mx-auto">
        {/* Project name + action buttons */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-medium text-primary" style={{ fontFamily: "var(--font-mono)" }}>
            {displayName}
          </h1>
          <div className="flex items-center gap-2">
            <ActionButton icon="star" label="Star" count={stars >= 1000 ? (stars / 1000).toFixed(1) + "k" : String(stars)} />
            <ActionButton icon="fork" label="Fork" count={String(forks)} />
            <ActionButton icon="eye" label="Watch" count={String(project.team.length + 10)} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pill ${activeTab === tab ? "pill-active" : "pill-inactive"}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Branch bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4 text-sm text-body">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface border border-border text-primary text-sm">
              <svg width="10" height="12" viewBox="0 0 10 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M1 3V9M9 3V5C9 7 5 7 5 9M5 9V11M1 3C2.1 3 3 2.1 3 1S2.1-1 1-1-1-.1-1 1 0 3 1 3ZM9 3C10.1 3 11 2.1 11 1S10.1-1 9-1 7-.1 7 1 7.9 3 9 3ZM5 11C6.1 11 7 10.1 7 9S6.1 7 5 7 3 7.9 3 9 3.9 11 5 11Z" />
              </svg>
              main
              <svg width="8" height="5" viewBox="0 0 8 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 1L4 4L7 1" />
              </svg>
            </button>
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                <path d="M1 3V9M11 3V5C11 7 7 7 7 9M7 9V11" />
              </svg>
              <span className="font-semibold text-primary">3</span> branches
            </span>
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
              <span className="font-semibold text-primary">12</span> tags
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 rounded-md bg-surface border border-border text-sm text-primary hover:border-border-hover transition-colors">
              Go to file
            </button>
            <button className="px-3 py-1.5 rounded-md bg-surface border border-border text-sm text-primary hover:border-border-hover transition-colors">
              Add file
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[rgba(34,211,238,0.1)] border border-cyan text-sm text-cyan">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              Code
              <svg width="8" height="5" viewBox="0 0 8 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 1L4 4L7 1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main content grid */}
        <div className="flex gap-6 max-[1024px]:flex-col">
          {/* Left column */}
          <div className="flex-[1.5] min-w-0 flex flex-col gap-6">
            {/* File browser */}
            <div className="card overflow-hidden relative">
              {isDemo && (
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider z-10"
                  style={{ fontFamily: "var(--font-mono)", color: "#f7c948", background: "rgba(247,201,72,0.08)", border: "1px solid rgba(247,201,72,0.15)" }}>
                  Demo
                </div>
              )}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-left text-body">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Last Commit</th>
                    <th className="px-4 py-3 font-medium text-right">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.name} className="border-b border-border-subtle last:border-b-0 hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {file.type === "folder" ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-cyan">
                              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-muted">
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                          <span className="text-primary" style={{ fontFamily: "var(--font-mono)" }}>
                            {file.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-body truncate max-w-[300px]">{file.lastCommit}</td>
                      <td className="px-4 py-3 text-muted text-right whitespace-nowrap">{file.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* README */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-border-subtle">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-muted">
                  <path d="M4 6h16M4 10h16M4 14h10M4 18h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="text-sm text-body font-medium" style={{ fontFamily: "var(--font-mono)" }}>README.MD</span>
              </div>

              <div>
                <h1 className="text-2xl font-bold text-primary mb-4" style={{ fontFamily: "var(--font-display)" }}>
                  Swarm v2
                </h1>
                <p className="text-sm text-body leading-relaxed mb-6">
                  High-performance orchestration engine for autonomous AI swarms. Built with Rust for safety and Python for developer experience.
                </p>

                <h2 className="text-lg font-bold text-primary mb-3" style={{ fontFamily: "var(--font-display)" }}>
                  Key Features
                </h2>
                <div className="space-y-2 mb-6">
                  <p className="text-sm text-body">
                    <span className="font-bold text-primary">Decentralized P2P:</span> Gossip protocol based communication between nodes.
                  </p>
                  <p className="text-sm text-body">
                    <span className="font-bold text-primary">Wasm Sandbox:</span> Secure execution of agent logic across different platforms.
                  </p>
                  <p className="text-sm text-body">
                    <span className="font-bold text-primary">Recursive Sharding:</span> Scale to thousands of agents with sub-millisecond sync.
                  </p>
                </div>

                <h2 className="text-lg font-bold text-primary mb-3" style={{ fontFamily: "var(--font-display)" }}>
                  Quick Start
                </h2>
                <div className="rounded-xl bg-[#0a0c14] border border-border p-5 mb-6" style={{ fontFamily: "var(--font-mono)" }}>
                  <p className="text-sm">
                    <span className="text-cyan">#</span> <span className="text-muted">Install dependencies</span>
                  </p>
                  <p className="text-sm text-primary">pip install swarm-v2</p>
                  <p className="text-sm mt-3">
                    <span className="text-cyan">#</span> <span className="text-muted">Initialize a local node</span>
                  </p>
                  <p className="text-sm text-primary">swarm init --config ./default.yaml</p>
                  <p className="text-sm text-primary">swarm run</p>
                </div>

                <h2 className="text-lg font-bold text-primary mb-3" style={{ fontFamily: "var(--font-display)" }}>
                  Architecture
                </h2>
                <div className="rounded-xl bg-surface border border-border p-8 flex flex-col items-center justify-center gap-3 text-center">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-cyan opacity-40">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-sm text-muted" style={{ fontFamily: "var(--font-mono)" }}>
                    Interactive Architecture Visualizer coming soon...
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="w-[300px] max-[1024px]:w-full flex flex-col gap-6">
            {/* About */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-primary mb-3" style={{ fontFamily: "var(--font-display)" }}>
                About
              </h3>
              <p className="text-sm text-body leading-relaxed mb-3">
                {project.problem_statement || "Swarm v2 is the backbone of the Feeshr AI ecosystem, providing a robust and scalable layer for decentralized agent coordination."}
              </p>
              <Link href="#" className="flex items-center gap-2 text-sm text-cyan hover:text-cyan-light transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                </svg>
                swarm.feeshr.network
              </Link>
            </div>

            {/* Project Stats */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-primary mb-3" style={{ fontFamily: "var(--font-display)" }}>
                Project Stats
              </h3>
              <div className="grid grid-cols-2 gap-px bg-border-subtle">
                <div className="bg-card-bg p-4 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted mb-1">Stars</p>
                  <p className="text-xl font-semibold text-primary">
                    {stars >= 1000 ? (stars / 1000).toFixed(0) + "," + String(stars % 1000).padStart(3, "0") : stars}
                  </p>
                </div>
                <div className="bg-card-bg p-4 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted mb-1">Forks</p>
                  <p className="text-xl font-semibold text-primary">{forks}</p>
                </div>
                <div className="bg-card-bg p-4 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted mb-1">Issues</p>
                  <p className="text-xl font-semibold text-primary">12</p>
                </div>
                <div className="bg-card-bg p-4 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted mb-1">PRs</p>
                  <p className="text-xl font-semibold text-primary">4</p>
                </div>
              </div>
            </div>

            {/* Releases */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-primary mb-3" style={{ fontFamily: "var(--font-display)" }}>
                Releases
              </h3>
              <div className="flex items-start gap-3 mb-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-mint mt-0.5">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-primary">v1.4.2-alpha</p>
                  <p className="text-xs text-muted">Released 2 days ago</p>
                  <Link href="#" className="text-xs text-cyan hover:text-cyan-light transition-colors">
                    View Changelog
                  </Link>
                </div>
              </div>
              <p className="text-xs text-muted">+ 14 more releases</p>
            </div>

            {/* Contributors */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-primary" style={{ fontFamily: "var(--font-display)" }}>
                  Contributors
                </h3>
                <span className="text-xs text-muted">{project.team.length}</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {project.team.slice(0, 6).map((member) => (
                  <div
                    key={member}
                    className="w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center"
                  >
                    <span className="text-[10px] text-cyan font-medium" style={{ fontFamily: "var(--font-mono)" }}>
                      {member.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
              <Link href="#" className="text-xs text-cyan hover:text-cyan-light transition-colors">
                View all contributors
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ icon, label, count }: { icon: string; label: string; count: string }) {
  return (
    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface border border-border text-sm text-body hover:border-border-hover transition-colors">
      {icon === "star" && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      )}
      {icon === "fork" && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="18" r="3" />
          <circle cx="6" cy="6" r="3" />
          <circle cx="18" cy="6" r="3" />
          <path d="M18 9v1a2 2 0 01-2 2H8a2 2 0 01-2-2V9" />
          <path d="M12 12v3" />
        </svg>
      )}
      {icon === "eye" && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
      {label}
      <span className="text-muted">{count}</span>
    </button>
  );
}
