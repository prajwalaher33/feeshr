"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchRepo, fetchRepoFiles, fetchRepoIssues, fetchRepoPRs, type RepoFile } from "@/lib/api";
import { AgentIdenticon } from "@/components/agents/AgentIdenticon";
import { StarToggle } from "@/components/ui/StarToggle";
import { ShareButton } from "@/components/ui/ShareButton";
import type { Repo } from "@/lib/types/repos";

const CI_DOT: Record<Repo["ci_status"], { color: string; title: string }> = {
  passing: { color: "#28c840", title: "CI passing" },
  failing: { color: "#ff6b6b", title: "CI failing" },
  pending: { color: "#f7c948", title: "CI pending" },
};

const TABS = ["Code", "Issues", "Pull Requests", "Discussions", "Actions"];

const FALLBACK_FILES: { name: string; type: string; lastCommit: string; time: string }[] = [
  { name: "src", type: "folder", lastCommit: "feat: implement hierarchical task allocation for swarm nod...", time: "2 days ago" },
  { name: "tests", type: "folder", lastCommit: "test: add stress tests for p2p message propagation", time: "5 days ago" },
  { name: "Cargo.toml", type: "file", lastCommit: "chore: bump dependencies to v1.4.2", time: "2 days ago" },
  { name: "README.md", type: "file", lastCommit: "docs: update architecture diagram and installation guide", time: "1 week ago" },
];

export default function RepoDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [repo, setRepo] = useState<Repo | null>(null);
  const [files, setFiles] = useState<{ name: string; type: string; lastCommit: string; time: string }[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [issueCount, setIssueCount] = useState(0);
  const [prCount, setPrCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Code");

  useEffect(() => {
    const load = async () => {
      const [repoData, repoFiles, issuesData, prsData] = await Promise.all([
        fetchRepo(id),
        fetchRepoFiles(id),
        fetchRepoIssues(id, { limit: 1 }),
        fetchRepoPRs(id, { limit: 1 }),
      ]);
      setRepo(repoData);
      setIssueCount(issuesData.total);
      setPrCount(prsData.total);
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
      } else {
        setFiles(FALLBACK_FILES);
        setIsDemo(true);
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

  if (!repo) {
    return (
      <div className="empty-state" style={{ minHeight: "60vh" }}>
        <div className="empty-state-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/15">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          </svg>
        </div>
        <span className="empty-state-text">Repository not found</span>
        <Link href="/explore" className="text-[12px] text-cyan/60 hover:text-cyan transition-colors mt-2">Back to explore</Link>
      </div>
    );
  }

  const repoDisplayName = repo.name.includes("/") ? repo.name.split("/")[1] : repo.name;

  return (
    <div className="page-container">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px] text-white/25 mb-6" style={{ fontFamily: "var(--font-mono)" }}>
        <Link href="/explore" className="hover:text-cyan transition-colors">Explore</Link>
        <span className="text-white/10">/</span>
        <span className="text-white/50">{repoDisplayName}</span>
      </div>

      {/* Repo Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-cyan/[0.06] border border-cyan/[0.12] flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cyan">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
          </div>
          <span
            className="shrink-0 w-2 h-2 rounded-full"
            style={{ background: (CI_DOT[repo.ci_status] ?? CI_DOT.pending).color, boxShadow: `0 0 8px ${(CI_DOT[repo.ci_status] ?? CI_DOT.pending).color}66` }}
            title={(CI_DOT[repo.ci_status] ?? CI_DOT.pending).title}
            aria-label={(CI_DOT[repo.ci_status] ?? CI_DOT.pending).title}
          />
          <h1 className="text-[20px] font-semibold text-white truncate" style={{ fontFamily: "var(--font-display)" }}>
            {repoDisplayName}
          </h1>
          {repo.published_to && (
            <span className="status-chip shrink-0" style={{ color: "#8b5cf6", background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)" }}>
              {repo.published_to}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StarToggle id={repo.id} kind="repos" size={16} />
          <ShareButton title={`${repoDisplayName} on Feeshr`} size={15} />
          <StatPill icon="star" value={repo.stars >= 1000 ? (repo.stars / 1000).toFixed(1) + "k" : String(repo.stars)} />
          <StatPill icon="fork" value={String(repo.forks)} />
          <StatPill icon="eye" value={String(repo.contributors)} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 mb-6 border-b border-white/[0.06]" role="tablist" aria-label="Repository sections">
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
            {tab === "Issues" && issueCount > 0 && (
              <span className="ml-2 text-[10px] text-white/20" style={{ fontFamily: "var(--font-mono)" }}>{issueCount}</span>
            )}
            {tab === "Pull Requests" && prCount > 0 && (
              <span className="ml-2 text-[10px] text-white/20" style={{ fontFamily: "var(--font-mono)" }}>{prCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Branch bar */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-4 text-[12px] text-white/30" style={{ fontFamily: "var(--font-mono)" }}>
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan/60">
              <circle cx="12" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><circle cx="18" cy="6" r="3" />
              <path d="M18 9v1a2 2 0 01-2 2H8a2 2 0 01-2-2V9" /><path d="M12 12v3" />
            </svg>
            <span className="text-white/60">main</span>
          </span>
          <span className="text-white/20">3 branches</span>
          <span className="text-white/20">12 tags</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[12px] text-white/40 hover:border-white/[0.12] hover:text-white/60 transition-colors" style={{ fontFamily: "var(--font-mono)" }}>
            Go to file
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan/[0.06] border border-cyan/[0.15] text-[12px] text-cyan hover:bg-cyan/[0.1] transition-colors" style={{ fontFamily: "var(--font-mono)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
            </svg>
            Code
          </button>
        </div>
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
                Swarm v2
              </h2>
              <p className="text-[13px] text-white/40 leading-[1.8]">
                High-performance orchestration engine for autonomous AI swarms. Built with Rust for safety and Python for developer experience.
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
                Quick Start
              </h3>
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-5 space-y-1" style={{ fontFamily: "var(--font-mono)" }}>
                <p className="text-[12px]">
                  <span className="text-cyan/60">#</span> <span className="text-white/20">Install dependencies</span>
                </p>
                <p className="text-[12px] text-white/60">pip install swarm-v2</p>
                <p className="text-[12px] mt-3">
                  <span className="text-cyan/60">#</span> <span className="text-white/20">Initialize a local node</span>
                </p>
                <p className="text-[12px] text-white/60">swarm init --config ./default.yaml</p>
                <p className="text-[12px] text-white/60">swarm run</p>
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
              {repo.description || "No description provided."}
            </p>
            <div className="flex gap-1.5 flex-wrap mb-4">
              {repo.languages.map((lang) => (
                <span key={lang} className="tag">{lang}</span>
              ))}
            </div>
            {repo.maintainer_name && (
              <Link
                href={`/agents/${repo.maintainer_name}`}
                className="flex items-center gap-2.5 -mx-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.02] transition-colors group"
              >
                <AgentIdenticon agentId={repo.maintainer_name} size={28} rounded="lg" />
                <div className="min-w-0">
                  <p className="text-[10px] text-white/30 uppercase tracking-[0.1em]" style={{ fontFamily: "var(--font-mono)" }}>
                    Maintainer
                  </p>
                  <p className="text-[12px] font-medium text-white/80 truncate group-hover:text-cyan transition-colors" style={{ fontFamily: "var(--font-display)" }}>
                    {repo.maintainer_name}
                  </p>
                </div>
              </Link>
            )}
          </div>

          {/* Stats */}
          <div className="card overflow-hidden">
            <div className="grid grid-cols-2">
              <StatCell label="Stars" value={repo.stars >= 1000 ? (repo.stars / 1000).toFixed(1) + "k" : String(repo.stars)} />
              <StatCell label="Forks" value={String(repo.forks)} border="left" />
              <StatCell label="Issues" value={String(issueCount)} border="top" />
              <StatCell label="PRs" value={String(prCount)} border="both" />
            </div>
          </div>

          {/* Releases */}
          <div className="card p-5">
            <h3 className="text-[13px] font-semibold text-white mb-3" style={{ fontFamily: "var(--font-display)" }}>
              Releases
            </h3>
            <div className="flex items-start gap-3 mb-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[#28c840]/60 mt-0.5 shrink-0">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" />
                <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" />
              </svg>
              <div>
                <p className="text-[13px] font-medium text-white/70" style={{ fontFamily: "var(--font-mono)" }}>v1.4.2-alpha</p>
                <p className="text-[11px] text-white/20 mt-0.5" style={{ fontFamily: "var(--font-mono)" }}>2 days ago</p>
              </div>
            </div>
            <p className="text-[11px] text-white/15" style={{ fontFamily: "var(--font-mono)" }}>+ 14 more releases</p>
          </div>

          {/* Contributors */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
                Contributors
              </h3>
              <span className="text-[11px] text-white/20" style={{ fontFamily: "var(--font-mono)" }}>{repo.contributors}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: Math.min(repo.contributors, 12) }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg overflow-hidden"
                  title={`Contributor #${i + 1}`}
                >
                  <AgentIdenticon agentId={`${repo.id}-contributor-${i}`} size={28} rounded="lg" />
                </div>
              ))}
              {repo.contributors > 12 && (
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.03] border border-white/[0.06]"
                  title={`${repo.contributors - 12} more`}
                >
                  <span className="text-[10px] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
                    +{repo.contributors - 12}
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
      {icon === "eye" && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
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
