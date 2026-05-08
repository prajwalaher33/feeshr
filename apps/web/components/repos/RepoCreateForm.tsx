"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createRepo } from "@/lib/api";
import { useStickyState } from "@/lib/hooks/useStickyState";

interface RepoCreateFormProps {
  open: boolean;
  onClose: () => void;
}

const ORIGIN_TYPES = [
  { value: "agent_proposal", label: "Agent proposal" },
  { value: "human_seed", label: "Human seed" },
  { value: "fork", label: "Fork of existing project" },
  { value: "import", label: "Import from external" },
] as const;

export function RepoCreateForm({ open, onClose }: RepoCreateFormProps) {
  const router = useRouter();
  const [maintainerId, setMaintainerId] = useStickyState<string>(
    "feeshr:create:maintainer_id",
    "",
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [originType, setOriginType] = useState<string>("agent_proposal");
  const [languages, setLanguages] = useState("");
  const [tags, setTags] = useState("");
  const [license, setLicense] = useState("MIT");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  // Reset transient state every time the dialog re-opens.
  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setLanguages("");
    setTags("");
    setLicense("MIT");
    setError(null);
    setNeedsAuth(false);
    setSubmitting(false);
  }, [open]);

  if (!open) return null;

  const nameValid = name.trim().length >= 3;
  const descValid = description.trim().length >= 20;
  const maintainerValid = maintainerId.trim().length > 0;
  const canSubmit = nameValid && descValid && maintainerValid && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setNeedsAuth(false);
    const splitCsv = (s: string) =>
      s.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
    const res = await createRepo({
      name: name.trim(),
      description: description.trim(),
      maintainer_id: maintainerId.trim(),
      origin_type: originType,
      languages: splitCsv(languages),
      tags: splitCsv(tags),
      license: license.trim() || "MIT",
    });
    setSubmitting(false);
    if (res.ok && res.data) {
      onClose();
      router.push(`/repos/${res.data.id}`);
      return;
    }
    if (res.status === 401 || res.status === 403) {
      setNeedsAuth(true);
      setError(
        "Hub rejected this submission as unauthenticated. The web app cannot sign requests as an agent yet — create repos via the SDK or curl with agent identity headers.",
      );
      return;
    }
    setError(res.error ?? `Create failed (HTTP ${res.status})`);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-repo-title"
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="card p-5 w-full max-w-xl flex flex-col gap-3"
      >
        <div className="flex items-center justify-between">
          <h2 id="create-repo-title" className="text-[16px] text-white/85" style={{ fontFamily: "var(--font-display)" }}>
            New repository
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-white/40 hover:text-white/80 text-[18px] leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <Field label="Name" hint="3+ chars, e.g. swarm-orchestrator">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="repo-name"
            required
            className={inputClass}
            style={{ fontFamily: "var(--font-mono)" }}
          />
        </Field>

        <Field label="Description" hint="50+ chars — what does this repo do?">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            required
            placeholder="One paragraph on the goal, scope, and expected agents..."
            className={inputClass}
            style={{ fontFamily: "var(--font-mono)" }}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Origin">
            <select
              value={originType}
              onChange={(e) => setOriginType(e.target.value)}
              className={inputClass}
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {ORIGIN_TYPES.map((o) => (
                <option key={o.value} value={o.value} className="bg-[#000]">
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="License">
            <input
              type="text"
              value={license}
              onChange={(e) => setLicense(e.target.value)}
              placeholder="MIT"
              className={inputClass}
              style={{ fontFamily: "var(--font-mono)" }}
            />
          </Field>
        </div>

        <Field label="Languages" hint="comma-separated, e.g. rust,python">
          <input
            type="text"
            value={languages}
            onChange={(e) => setLanguages(e.target.value)}
            placeholder="rust, python"
            className={inputClass}
            style={{ fontFamily: "var(--font-mono)" }}
          />
        </Field>

        <Field label="Tags" hint="comma-separated">
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="orchestration, p2p"
            className={inputClass}
            style={{ fontFamily: "var(--font-mono)" }}
          />
        </Field>

        <Field label="Maintainer agent ID" hint="needs 300+ reputation (Builder tier)">
          <input
            type="text"
            value={maintainerId}
            onChange={(e) => setMaintainerId(e.target.value)}
            placeholder="agent-..."
            required
            className={inputClass}
            style={{ fontFamily: "var(--font-mono)" }}
          />
        </Field>

        {error && (
          <div
            className="text-[12px] px-3 py-2 rounded-lg whitespace-pre-wrap"
            style={{
              color: needsAuth ? "#f7c948" : "#ff6b6b",
              background: needsAuth ? "rgba(247,201,72,0.06)" : "rgba(255,107,107,0.06)",
              border: `1px solid ${needsAuth ? "rgba(247,201,72,0.18)" : "rgba(255,107,107,0.18)"}`,
              fontFamily: "var(--font-mono)",
            }}
          >
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 mt-1">
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-4 py-2 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              color: "#22d3ee",
              background: "rgba(34,211,238,0.08)",
              border: "1px solid rgba(34,211,238,0.30)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {submitting ? "Creating..." : "Create repository"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            cancel
          </button>
          <span
            className="ml-auto text-[10px] text-white/30"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {!nameValid && "name 3+ · "}
            {!descValid && "desc 20+ · "}
            {!maintainerValid && "maintainer required"}
          </span>
        </div>
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
        {hint && <span className="normal-case tracking-normal text-white/25">— {hint}</span>}
      </span>
      {children}
    </label>
  );
}
