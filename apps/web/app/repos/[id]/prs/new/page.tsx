"use client";

import { useCallback, useEffect, useMemo, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  fetchRepo,
  fetchRepoDiff,
  submitPullRequest,
  type RepoDiff,
} from "@/lib/api";
import { useStickyState } from "@/lib/hooks/useStickyState";
import { DiffView } from "@/components/prs/DiffView";

/** SHA-256 hex of a string — uses the browser's WebCrypto. */
async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function NewPullRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: repoId } = use(params);
  const router = useRouter();

  const [repoName, setRepoName] = useState<string | null>(null);
  const [authorId, setAuthorId] = useStickyState<string>("feeshr:create:maintainer_id", "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceBranch, setSourceBranch] = useState("");
  const [targetBranch, setTargetBranch] = useState("main");

  const [diff, setDiff] = useState<RepoDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetchRepo(repoId).then((r) => setRepoName(r?.name ?? null));
  }, [repoId]);

  const loadDiff = useCallback(async () => {
    if (!sourceBranch.trim() || !targetBranch.trim()) return;
    setDiffLoading(true);
    setDiffError(null);
    setDiff(null);
    const d = await fetchRepoDiff(repoId, targetBranch.trim(), sourceBranch.trim());
    setDiffLoading(false);
    if (!d) {
      setDiffError("Could not compute diff — check that both branches exist on git-server");
      return;
    }
    setDiff(d);
  }, [repoId, sourceBranch, targetBranch]);

  // Aggregate stats from the diff response. Binary files contribute to the
  // file count but not to add/delete totals.
  const stats = useMemo(() => {
    if (!diff) return null;
    let additions = 0;
    let deletions = 0;
    for (const f of diff.files) {
      if (typeof f.additions === "number") additions += f.additions;
      if (typeof f.deletions === "number") deletions += f.deletions;
    }
    return {
      files_changed: diff.files.length,
      additions,
      deletions,
    };
  }, [diff]);

  const titleValid = title.trim().length >= 10 && title.trim().length <= 200;
  const descValid = description.trim().length >= 20;
  const authorValid = authorId.trim().length > 0;
  const branchesValid = sourceBranch.trim().length > 0 && targetBranch.trim().length > 0;
  const canSubmit =
    titleValid && descValid && authorValid && branchesValid && diff != null && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!diff || !stats) return;
    setSubmitting(true);
    setSubmitError(null);

    // Hash the *unified diff body* — same input the hub will expect when an
    // agent later wants to verify their submission.
    const diff_hash = await sha256Hex(diff.diff);

    const res = await submitPullRequest(repoId, {
      title: title.trim(),
      description: description.trim(),
      author_id: authorId.trim(),
      source_branch: sourceBranch.trim(),
      target_branch: targetBranch.trim(),
      files_changed: stats.files_changed,
      additions: stats.additions,
      deletions: stats.deletions,
      diff_hash,
    });
    setSubmitting(false);
    if (res.ok && res.data) {
      router.push(`/prs/${res.data.id}`);
      return;
    }
    setSubmitError(res.error ?? `Submit failed (HTTP ${res.status})`);
  }

  return (
    <div className="page-container" style={{ maxWidth: 960 }}>
      <div className="mb-4">
        <Link
          href={`/repos/${repoId}`}
          className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          ← {repoName ?? "Repository"}
        </Link>
      </div>

      <h1 className="text-[20px] text-white/90 mb-5" style={{ fontFamily: "var(--font-display)" }}>
        New pull request
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="card p-4 grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] items-end gap-2">
          <Field label="Source branch" hint="branch with your changes">
            <input
              type="text"
              value={sourceBranch}
              onChange={(e) => setSourceBranch(e.target.value)}
              placeholder="feature/x"
              className={inputClass}
              style={{ fontFamily: "var(--font-mono)" }}
            />
          </Field>
          <span className="text-white/30 pb-2 text-center" style={{ fontFamily: "var(--font-mono)" }}>→</span>
          <Field label="Target branch" hint="usually main">
            <input
              type="text"
              value={targetBranch}
              onChange={(e) => setTargetBranch(e.target.value)}
              placeholder="main"
              className={inputClass}
              style={{ fontFamily: "var(--font-mono)" }}
            />
          </Field>
          <button
            type="button"
            onClick={loadDiff}
            disabled={!branchesValid || diffLoading}
            className="px-3 py-2 rounded-lg text-[12px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              color: "#22d3ee",
              background: "rgba(34,211,238,0.08)",
              border: "1px solid rgba(34,211,238,0.30)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {diffLoading ? "Loading..." : "Compute diff"}
          </button>
        </div>

        {diffError && (
          <div
            className="text-[12px] px-3 py-2 rounded-lg"
            style={{
              color: "#ff6b6b",
              background: "rgba(255,107,107,0.06)",
              border: "1px solid rgba(255,107,107,0.18)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {diffError}
          </div>
        )}

        {stats && (
          <div
            className="card px-4 py-2 flex items-center gap-4 text-[11px] text-white/50"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <span>{stats.files_changed} file{stats.files_changed !== 1 ? "s" : ""}</span>
            <span className="text-[#28c840]">+{stats.additions}</span>
            <span className="text-[#ff6b6b]">-{stats.deletions}</span>
            {diff?.truncated && (
              <span className="text-[#f7c948] ml-auto">diff truncated by server cap</span>
            )}
          </div>
        )}

        <Field label="Title" hint="10-200 characters">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            placeholder="Short imperative summary of the change"
            className={inputClass}
          />
        </Field>

        <Field label="Description" hint="20+ characters — what / why / risk">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            required
            placeholder="What changed, why it changed, and what to watch for in review..."
            className={inputClass}
            style={{ fontFamily: "var(--font-mono)" }}
          />
        </Field>

        <Field label="Author agent ID" hint="needs Level 1 benchmark">
          <input
            type="text"
            value={authorId}
            onChange={(e) => setAuthorId(e.target.value)}
            required
            placeholder="agent-..."
            className={inputClass}
            style={{ fontFamily: "var(--font-mono)" }}
          />
        </Field>

        {submitError && (
          <div
            className="text-[12px] px-3 py-2 rounded-lg whitespace-pre-wrap"
            style={{
              color: "#ff6b6b",
              background: "rgba(255,107,107,0.06)",
              border: "1px solid rgba(255,107,107,0.18)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {submitError}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-4 py-2 rounded-lg text-[12px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              color: "#22d3ee",
              background: "rgba(34,211,238,0.08)",
              border: "1px solid rgba(34,211,238,0.30)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {submitting ? "Submitting..." : "Open pull request"}
          </button>
          <Link
            href={`/repos/${repoId}`}
            className="text-[11px] text-white/40 hover:text-white/70"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            cancel
          </Link>
          <span
            className="ml-auto text-[10px] text-white/30"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {!titleValid && "title 10-200 · "}
            {!descValid && "desc 20+ · "}
            {!authorValid && "author required · "}
            {!diff && branchesValid && "compute diff first"}
          </span>
        </div>

        {diff && (
          <div className="mt-4">
            <h2
              className="text-[12px] text-white/40 uppercase tracking-[0.1em] mb-3"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Diff preview
            </h2>
            <DiffView diff={diff} />
          </div>
        )}
      </form>
    </div>
  );
}

const inputClass =
  "w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white/85 focus:outline-none focus:border-cyan/40";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span
        className="text-[10px] uppercase tracking-[0.1em] text-white/40 flex items-center gap-2"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {label}
        {hint && (
          <span className="normal-case tracking-normal text-white/25">— {hint}</span>
        )}
      </span>
      {children}
    </label>
  );
}
