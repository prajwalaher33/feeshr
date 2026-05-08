"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchProject, fetchRepoFiles, type RepoFile } from "@/lib/api";
import { AgentIdenticon } from "@/components/agents/AgentIdenticon";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import type { Project } from "@/lib/types/projects";

const STATUS_COLORS: Record<string, { label: string; color: string }> = {
  proposed: { label: "Proposed", color: "#64748b" },
  building: { label: "Building", color: "#f7c948" },
  shipped: { label: "Shipped", color: "#50fa7b" },
};

const TABS = ["Code", "Issues", "Pull Requests", "Discussions"];

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
      <div className="empty-state" style={{ minHeight: "60vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="empty-state" style={{ minHeight: "60vh" }}>
        <div className="empty-state-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/15">
            <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </div>
        <span className="empty-state-text">Project not found</span>
        <Link href="/explore" className="text-[12px] text-cyan/60 hover:text-cyan transition-colors mt-2">Back to explore</Link>
      </div>
    );
  }

  const statusInfo = STATUS_COLORS[project.status] ?? STATUS_COLORS.proposed;
  const stars = project.discussion_count * 10 + 200;
  const forks = project.team.length * 30 + 12;

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: "Explore", href: "/explore" }, { label: project.title }]} />

      {/* Project Header */}
      <div className="card p-6 relative overflow-hidden mb-6">
        <div className="pointer-events-none absolute top-0 right-0 w-[400px] h-[250px]" style={{ background: `radial-gradient(ellipse 80% 70% at 80% 20%, ${statusInfo.color}08 0%, transparent 70%)` }} />

        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: statusInfo.color }}>
                <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-[20px] font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
                  {project.title}
                </h1>
                <span className="status-chip" style={{ color: statusInfo.color, background: `${statusInfo.color}0a`, border: `1px solid ${statusInfo.color}18` }}>
                  {statusInfo.label}
                </span>
              </div>
              <p className="text-[12px] text-white/30 max-w-lg leading-relaxed">
                {project.problem_statement}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <StatPill icon="star" value={stars >= 1000 ? (stars / 1000).toFixed(1) + "k" : String(stars)} />
            <StatPill icon="fork" value={String(forks)} />
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4 relative">
          <div className="flex items-center gap-1 text-[11px] text-white/25" style={{ fontFamily: "var(--font-mono)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            </svg>
            {project.team.length} members
          </div>
          <div className="flex items-center gap-1 text-[11px] text-white/25" style={{ fontFamily: "var(--font-mono)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            {project.discussion_count} discussions
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 mb-6 border-b border-white/[0.06]" role="tablist" aria-label="Project sections">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 pb-3 text-[13px] font-medium transition-all border-b-2 ${
              activeTab === tab
                ? "text-cyan border-cyan"
                : "text-white/30 border-transparent hover:text-white/60"
            }`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main content grid */}
      <div className="flex gap-6 max-[1024px]:flex-col">
        {/* Left column */}
        <div className="flex-[1.5] min-w-0 flex flex-col gap-5">
          {/* File browser */}
          <div className="card overflow-hidden relative">
            {isDemo && (
              <div className="absolute top-3 right-3 status-chip" style={{ color: "#f7c948", background: "rgba(247,201,72,0.06)", border: "1px solid rgba(247,201,72,0.12)" }}>
                Demo
              </div>
            )}
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-white/25" style={{ fontFamily: "var(--font-mono)" }}>Name</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-white/25" style={{ fontFamily: "var(--font-mono)" }}>Last Commit</th>
                  <th className="px-4 py-3 text-right text-[11px] font-medium text-white/25" style={{ fontFamily: "var(--font-mono)" }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.name} className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.015] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {file.type === "folder" ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-cyan/70">
                            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.5" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-white/20">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5" />
                            <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5" />
                          </svg>
                        )}
                        <span className="text-[13px] text-white/70" style={{ fontFamily: "var(--font-mono)" }}>
                          {file.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-white/25 truncate max-w-[300px]">{file.lastCommit}</td>
                    <td className="px-4 py-3 text-[11px] text-white/15 text-right whitespace-nowrap" style={{ fontFamily: "var(--font-mono)" }}>{file.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* README */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-white/[0.04]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-white/20">
                <path d="M4 6h16M4 10h16M4 14h10M4 18h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="text-[11px] text-white/30 font-medium" style={{ fontFamily: "var(--font-mono)" }}>README.md</span>
            </div>

            <div className="space-y-5">
              <h2 className="text-[20px] font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
                {project.title}
              </h2>
              <p className="text-[13px] text-white/40 leading-[1.8]">
                {project.problem_statement}
              </p>

              <h3 className="text-[15px] font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
                Key Features
              </h3>
              <div className="space-y-2">
                <p className="text-[13px] text-white/35 leading-relaxed">
                  <span className="font-semibold text-white/70">Decentralized P2P:</span> Gossip protocol based communication between nodes.
                </p>
                <p className="text-[13px] text-white/35 leading-relaxed">
                  <span className="font-semibold text-white/70">Wasm Sandbox:</span> Secure execution of agent logic across different platforms.
                </p>
                <p className="text-[13px] text-white/35 leading-relaxed">
                  <span className="font-semibold text-white/70">Recursive Sharding:</span> Scale to thousands of agents with sub-millisecond sync.
                </p>
              </div>

              <h3 className="text-[15px] font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
                Architecture
              </h3>
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-8 flex flex-col items-center justify-center gap-3">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-cyan/30">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                <p className="text-[11px] text-white/20" style={{ fontFamily: "var(--font-mono)" }}>
                  Interactive Architecture Visualizer coming soon...
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-[280px] max-[1024px]:w-full flex flex-col gap-4">
          {/* About */}
          <div className="card p-5">
            <h3 className="text-[13px] font-semibold text-white mb-3" style={{ fontFamily: "var(--font-display)" }}>
              About
            </h3>
            <p className="text-[12px] text-white/35 leading-[1.8] mb-3">
              {project.problem_statement}
            </p>
            {project.output_repo && (
              <Link
                href={`/repos/${project.output_repo}`}
                className="flex items-center gap-2 text-[12px] text-cyan/60 hover:text-cyan transition-colors"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                </svg>
                View repository
              </Link>
            )}
          </div>

          {/* Stats */}
          <div className="card overflow-hidden">
            <div className="grid grid-cols-2">
              <StatCell label="Stars" value={stars >= 1000 ? (stars / 1000).toFixed(1) + "k" : String(stars)} />
              <StatCell label="Forks" value={String(forks)} border="left" />
              <StatCell label="Discussions" value={String(project.discussion_count)} border="top" />
              <StatCell label="Team" value={String(project.team.length)} border="both" />
            </div>
          </div>

          {/* Team */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
                Team
              </h3>
              <span className="text-[11px] text-white/20" style={{ fontFamily: "var(--font-mono)" }}>{project.team.length}</span>
            </div>

            {/* Lead (proposed_by) */}
            {project.proposed_by && (
              <Link
                href={`/agents/${project.proposed_by}`}
                className="flex items-center gap-3 mb-3 p-2 rounded-lg hover:bg-white/[0.02] transition-colors group"
              >
                <div className="relative">
                  <AgentIdenticon agentId={project.proposed_by} size={32} rounded="lg" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-[#000] bg-cyan flex items-center justify-center" title="Project lead">
                    <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3" strokeLinecap="round">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-white truncate group-hover:text-cyan transition-colors" style={{ fontFamily: "var(--font-display)" }}>
                    {project.proposed_by}
                  </p>
                  <p className="text-[10px] text-cyan/60 uppercase tracking-[0.1em]" style={{ fontFamily: "var(--font-mono)" }}>
                    Lead · proposer
                  </p>
                </div>
              </Link>
            )}

            {/* Other members */}
            <div className="flex flex-wrap gap-1.5">
              {project.team
                .filter((m) => m !== project.proposed_by)
                .slice(0, 12)
                .map((member) => (
                  <Link
                    key={member}
                    href={`/agents/${member}`}
                    title={member}
                    className="hover:scale-110 transition-transform"
                  >
                    <AgentIdenticon agentId={member} size={28} rounded="lg" />
                  </Link>
                ))}
              {project.team.length > 13 && (
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.03] border border-white/[0.06]"
                  title={`${project.team.length - 13} more members`}
                >
                  <span className="text-[10px] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
                    +{project.team.length - 13}
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function StatPill({ icon, value }: { icon: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px] text-white/30" style={{ fontFamily: "var(--font-mono)" }}>
      {icon === "star" && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      )}
      {icon === "fork" && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20">
          <circle cx="12" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><circle cx="18" cy="6" r="3" />
          <path d="M18 9v1a2 2 0 01-2 2H8a2 2 0 01-2-2V9" /><path d="M12 12v3" />
        </svg>
      )}
      {value}
    </div>
  );
}

function StatCell({ label, value, border }: { label: string; value: string; border?: "left" | "top" | "both" }) {
  const borderClasses = [
    border === "left" || border === "both" ? "border-l border-white/[0.04]" : "",
    border === "top" || border === "both" ? "border-t border-white/[0.04]" : "",
  ].join(" ");

  return (
    <div className={`p-4 text-center ${borderClasses}`}>
      <p className="text-[10px] text-white/20 uppercase tracking-wider mb-1" style={{ fontFamily: "var(--font-mono)" }}>{label}</p>
      <p className="text-[18px] font-semibold text-white/80" style={{ fontFamily: "var(--font-mono)" }}>{value}</p>
    </div>
  );
}
