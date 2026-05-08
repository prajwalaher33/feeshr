"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  fetchRepo,
  fetchRepoTree,
  fetchRepoIssues,
  fetchRepoPRs,
  fetchRepoFileContent,
  fetchRepoCommits,
  type TreeEntry,
  type RepoFileContent,
  type RepoCommit,
} from "@/lib/api";
import { AgentIdenticon } from "@/components/agents/AgentIdenticon";
import { StarToggle } from "@/components/ui/StarToggle";
import { ShareButton } from "@/components/ui/ShareButton";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import type { Repo } from "@/lib/types/repos";

const CI_DOT: Record<Repo["ci_status"], { color: string; title: string }> = {
  passing: { color: "#28c840", title: "CI passing" },
  failing: { color: "#ff6b6b", title: "CI failing" },
  pending: { color: "#f7c948", title: "CI pending" },
};

const TABS = ["Code", "Commits", "Issues", "Pull Requests"];

function sortEntries(entries: TreeEntry[]): TreeEntry[] {
  return [...entries].sort((a, b) => {
    if (a.kind === b.kind) return a.name.localeCompare(b.name);
    return a.kind === "dir" ? -1 : 1;
  });
}

function joinPath(base: string, name: string) {
  if (!base) return name;
  return `${base.replace(/\/$/, "")}/${name}`;
}

export default function RepoDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [repo, setRepo] = useState<Repo | null>(null);
  const [issueCount, setIssueCount] = useState(0);
  const [prCount, setPrCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Code");

  // File browser state
  const [cwd, setCwd] = useState("");
  const [tree, setTree] = useState<TreeEntry[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState(false);
  const [openFile, setOpenFile] = useState<{ path: string; content: RepoFileContent | null; loading: boolean } | null>(null);
  const [readme, setReadme] = useState<RepoFileContent | null>(null);
  const [commits, setCommits] = useState<RepoCommit[]>([]);

  // Initial repo metadata + counts.
  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetchRepo(id),
      fetchRepoIssues(id, { limit: 1 }),
      fetchRepoPRs(id, { limit: 1 }),
    ]).then(([repoData, issuesData, prsData]) => {
      setRepo(repoData);
      setIssueCount(issuesData.total);
      setPrCount(prsData.total);
      setLoading(false);
    });
  }, [id]);

  // Reload the directory listing whenever cwd changes. A failed fetch
  // (no bare repo, empty repo, missing path) leaves treeError set so
  // we can render an honest empty state instead of a fake one.
  const loadTree = useCallback(async () => {
    if (!id) return;
    setTreeLoading(true);
    setTreeError(false);
    setOpenFile(null);
    const entries = await fetchRepoTree(id, { path: cwd });
    setTreeLoading(false);
    if (entries.length === 0 && cwd === "") {
      setTreeError(true);
      setTree([]);
      return;
    }
    setTree(sortEntries(entries));
  }, [id, cwd]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  // Best-effort README fetch — only at the repo root.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      for (const candidate of ["README.md", "README", "readme.md"]) {
        const c = await fetchRepoFileContent(id, candidate);
        if (cancelled) return;
        if (c) {
          setReadme(c);
          return;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Lazy-load commits when the tab opens.
  useEffect(() => {
    if (activeTab !== "Commits" || !id || commits.length > 0) return;
    fetchRepoCommits(id, 50).then(setCommits);
  }, [activeTab, id, commits.length]);

  const openFilePath = useCallback(
    async (path: string) => {
      setOpenFile({ path, content: null, loading: true });
      const content = await fetchRepoFileContent(id, path);
      setOpenFile({ path, content, loading: false });
    },
    [id],
  );

  const navigateUp = () => {
    const parts = cwd.split("/").filter(Boolean);
    parts.pop();
    setCwd(parts.join("/"));
  };

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
      <Breadcrumb items={[{ label: "Explore", href: "/explore" }, { label: repoDisplayName }]} />

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
        </div>
      </div>

      {/* Main content grid */}
      <div className="flex gap-6 max-[1024px]:flex-col">
        {/* Left column */}
        <div className="flex-[1.5] min-w-0 flex flex-col gap-5">
          {/* File browser / file viewer */}
          {activeTab === "Code" && (
            <div className="card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.04] text-[11px] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
                <button
                  type="button"
                  onClick={() => { setCwd(""); setOpenFile(null); }}
                  className="hover:text-cyan transition-colors"
                >
                  /
                </button>
                {cwd.split("/").filter(Boolean).map((seg, i, arr) => (
                  <span key={i} className="flex items-center gap-2">
                    <span className="text-white/15">›</span>
                    <button
                      type="button"
                      onClick={() => { setCwd(arr.slice(0, i + 1).join("/")); setOpenFile(null); }}
                      className="hover:text-cyan transition-colors"
                    >
                      {seg}
                    </button>
                  </span>
                ))}
                {openFile && (
                  <span className="flex items-center gap-2">
                    <span className="text-white/15">›</span>
                    <span className="text-cyan/80">{openFile.path.split("/").pop()}</span>
                    <button
                      type="button"
                      onClick={() => setOpenFile(null)}
                      className="ml-auto text-white/30 hover:text-white/70"
                      title="Close file"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>

              {openFile ? (
                <FileViewer file={openFile} />
              ) : treeError ? (
                <div className="p-6 text-center">
                  <p className="text-[12px] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
                    No tree available — repo is empty or not yet pushed
                  </p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.04]">
                      <th className="px-4 py-3 text-left text-[11px] font-medium text-white/25" style={{ fontFamily: "var(--font-mono)" }}>Name</th>
                      <th className="px-4 py-3 text-right text-[11px] font-medium text-white/25" style={{ fontFamily: "var(--font-mono)" }}>Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cwd && (
                      <tr className="border-b border-white/[0.03] hover:bg-white/[0.015] transition-colors">
                        <td className="px-4 py-3" colSpan={2}>
                          <button
                            type="button"
                            onClick={navigateUp}
                            className="text-[13px] text-white/60 hover:text-cyan transition-colors"
                            style={{ fontFamily: "var(--font-mono)" }}
                          >
                            ..
                          </button>
                        </td>
                      </tr>
                    )}
                    {treeLoading ? (
                      <tr><td className="px-4 py-3 text-[12px] text-white/30" style={{ fontFamily: "var(--font-mono)" }} colSpan={2}>Loading…</td></tr>
                    ) : tree.length === 0 ? (
                      <tr><td className="px-4 py-3 text-[12px] text-white/30" style={{ fontFamily: "var(--font-mono)" }} colSpan={2}>Empty directory</td></tr>
                    ) : tree.map((entry) => (
                      <tr key={entry.name} className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.015] transition-colors">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => entry.kind === "dir" ? setCwd(joinPath(cwd, entry.name)) : openFilePath(joinPath(cwd, entry.name))}
                            className="flex items-center gap-2.5 text-left w-full"
                          >
                            {entry.kind === "dir" ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-cyan/70">
                                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.5" />
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-white/20">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5" />
                                <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5" />
                              </svg>
                            )}
                            <span className="text-[13px] text-white/70 hover:text-cyan transition-colors" style={{ fontFamily: "var(--font-mono)" }}>
                              {entry.name}
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-white/30 text-right whitespace-nowrap" style={{ fontFamily: "var(--font-mono)" }}>
                          {entry.kind === "dir" ? "—" : formatBytes(entry.size ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === "Commits" && (
            <CommitsPanel commits={commits} loading={commits.length === 0} />
          )}

          {activeTab === "Issues" && (
            <TabRedirect href={`/repos/${id}/issues`} label="Issues" count={issueCount} />
          )}

          {activeTab === "Pull Requests" && (
            <div className="card px-4 py-6 flex items-center justify-between">
              <div>
                <p className="text-[13px] text-white/80" style={{ fontFamily: "var(--font-display)" }}>
                  {prCount} pull request{prCount !== 1 ? "s" : ""}
                </p>
                <p className="text-[11px] text-white/30 mt-1" style={{ fontFamily: "var(--font-mono)" }}>
                  Open the pull-requests view for the full list, or open a new one against this repo
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/prs"
                  className="px-3 py-1.5 rounded-lg text-[12px] text-white/60 border border-white/[0.10] hover:bg-white/[0.05] transition-colors"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Browse all
                </Link>
                <Link
                  href={`/repos/${id}/prs/new`}
                  className="px-3 py-1.5 rounded-lg text-[12px] transition-colors"
                  style={{
                    color: "#22d3ee",
                    background: "rgba(34,211,238,0.08)",
                    border: "1px solid rgba(34,211,238,0.30)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  + New PR
                </Link>
              </div>
            </div>
          )}

          {/* README — only shown on the Code tab and only if we found one. */}
          {activeTab === "Code" && readme && (
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/[0.04]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-white/20">
                  <path d="M4 6h16M4 10h16M4 14h10M4 18h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="text-[11px] text-white/30 font-medium" style={{ fontFamily: "var(--font-mono)" }}>README.md</span>
                <span className="ml-auto text-[10px] text-white/20" style={{ fontFamily: "var(--font-mono)" }}>
                  {formatBytes(readme.size_bytes)}
                </span>
              </div>
              {readme.encoding === "utf-8" ? (
                <pre
                  className="text-[13px] text-white/70 leading-[1.7] whitespace-pre-wrap m-0 max-h-[600px] overflow-auto"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {readme.content}
                </pre>
              ) : (
                <p className="text-[12px] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
                  Binary README — open in the file browser to view.
                </p>
              )}
            </div>
          )}
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

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function FileViewer({
  file,
}: {
  file: { path: string; content: RepoFileContent | null; loading: boolean };
}) {
  if (file.loading) {
    return (
      <div className="px-4 py-6 text-[12px] text-white/30" style={{ fontFamily: "var(--font-mono)" }}>
        Loading {file.path}…
      </div>
    );
  }
  if (!file.content) {
    return (
      <div className="px-4 py-6 text-[12px] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
        Failed to load {file.path}
      </div>
    );
  }
  if (file.content.encoding !== "utf-8") {
    return (
      <div className="px-4 py-6 text-[12px] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
        Binary file ({formatBytes(file.content.size_bytes)}) — preview unavailable
      </div>
    );
  }
  return (
    <pre
      className="m-0 px-4 py-3 text-[12px] leading-[1.6] text-white/85 overflow-auto max-h-[700px]"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {file.content.content}
    </pre>
  );
}

function CommitsPanel({ commits, loading }: { commits: RepoCommit[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="card px-4 py-6 text-[12px] text-white/30" style={{ fontFamily: "var(--font-mono)" }}>
        Loading commit history…
      </div>
    );
  }
  if (commits.length === 0) {
    return (
      <div className="card px-4 py-6 text-[12px] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
        No commits yet
      </div>
    );
  }
  return (
    <div className="card overflow-hidden">
      {commits.map((c) => (
        <div key={c.hash} className="px-4 py-3 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.015] transition-colors">
          <div className="flex items-start gap-3">
            <span
              className="shrink-0 mt-1 text-[10px] px-1.5 py-0.5 rounded text-white/40"
              style={{
                background: "rgba(203,213,225,0.05)",
                border: "1px solid rgba(203,213,225,0.10)",
                fontFamily: "var(--font-mono)",
              }}
              title={c.hash}
            >
              {c.hash.slice(0, 7)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-white/80 truncate">{c.subject}</p>
              <div className="mt-1 flex items-center gap-3 text-[11px] text-white/30" style={{ fontFamily: "var(--font-mono)" }}>
                <span>{c.author_email}</span>
                <span>{new Date(c.date).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TabRedirect({ href, label, count }: { href: string; label: string; count: number }) {
  return (
    <div className="card px-4 py-6 flex items-center justify-between">
      <div>
        <p className="text-[13px] text-white/80" style={{ fontFamily: "var(--font-display)" }}>
          {count} {label.toLowerCase()}
        </p>
        <p className="text-[11px] text-white/30 mt-1" style={{ fontFamily: "var(--font-mono)" }}>
          Open the dedicated {label.toLowerCase()} view to see them all
        </p>
      </div>
      <Link
        href={href}
        className="px-3 py-1.5 rounded-lg text-[12px] text-cyan border border-cyan/30 hover:bg-cyan/10 transition-colors"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Open →
      </Link>
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
