"use client";

import { useState } from "react";
import { submitPrReview, type PrReview, type ReviewFinding } from "@/lib/api";
import { useStickyState } from "@/lib/hooks/useStickyState";

type Verdict = PrReview["verdict"];

const VERDICT_META: Record<Verdict, { label: string; color: string; hint: string }> = {
  approve: { label: "Approve", color: "#28c840", hint: "Looks good — sign off." },
  request_changes: {
    label: "Request changes",
    color: "#f7c948",
    hint: "Needs work before merge.",
  },
  reject: { label: "Reject", color: "#ff6b6b", hint: "Won't merge as-is." },
};

interface ReviewComposerProps {
  prId: string;
  drafts: ReviewFinding[];
  onSubmitted: () => void;
  onDiscardAll: () => void;
}

export function ReviewComposer({
  prId,
  drafts,
  onSubmitted,
  onDiscardAll,
}: ReviewComposerProps) {
  const [reviewerId, setReviewerId] = useStickyState<string>(
    "feeshr:review:reviewer_id",
    "",
  );
  const [verdict, setVerdict] = useState<Verdict>("approve");
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  const summaryValid = summary.trim().length >= 50;
  const reviewerValid = reviewerId.trim().length > 0;
  const draftsValid = drafts.every((d) => d.body.trim().length > 0);
  const canSubmit = summaryValid && reviewerValid && draftsValid && !submitting;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setNeedsAuth(false);
    const res = await submitPrReview(prId, {
      reviewer_id: reviewerId.trim(),
      verdict,
      comment: summary.trim(),
      findings: drafts.length > 0 ? drafts : undefined,
    });
    setSubmitting(false);
    if (res.ok) {
      setSummary("");
      onSubmitted();
      return;
    }
    if (res.status === 401 || res.status === 403) {
      setNeedsAuth(true);
      setError(
        "Hub rejected this submission as unauthenticated. The web app cannot sign requests as an agent yet — submit reviews via the SDK or curl with the agent identity headers.",
      );
      return;
    }
    setError(res.error ?? `Submit failed (HTTP ${res.status})`);
  }

  return (
    <div
      className="card p-4 sticky bottom-4 z-10"
      style={{ backdropFilter: "blur(20px) saturate(1.4)" }}
    >
      <div
        className="text-[11px] uppercase tracking-[0.1em] mb-3 text-white/40"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Submit review {drafts.length > 0 && <span>· {drafts.length} line note{drafts.length !== 1 ? "s" : ""}</span>}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-start">
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          placeholder="Overall review (50+ chars). Why approve / what to change / what's blocking..."
          aria-label="Review summary"
          className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white/85 leading-relaxed focus:outline-none focus:border-cyan/40 resize-y"
          style={{ fontFamily: "var(--font-mono)" }}
        />
        <div className="flex flex-col gap-2 min-w-[180px]">
          <input
            type="text"
            value={reviewerId}
            onChange={(e) => setReviewerId(e.target.value)}
            placeholder="agent id"
            aria-label="Reviewer agent ID"
            className="bg-transparent border border-white/10 rounded-lg px-3 py-1.5 text-[12px] text-white/85 focus:outline-none focus:border-cyan/40"
            style={{ fontFamily: "var(--font-mono)" }}
          />
          <div className="flex flex-col gap-1">
            {(Object.keys(VERDICT_META) as Verdict[]).map((v) => {
              const meta = VERDICT_META[v];
              const selected = verdict === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVerdict(v)}
                  className="text-left text-[12px] px-2.5 py-1.5 rounded transition-colors"
                  style={{
                    color: selected ? meta.color : "rgba(255,255,255,0.7)",
                    background: selected ? `${meta.color}10` : "transparent",
                    border: `1px solid ${selected ? `${meta.color}40` : "rgba(255,255,255,0.06)"}`,
                    fontFamily: "var(--font-mono)",
                  }}
                  aria-pressed={selected}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <div
          className="mt-3 text-[12px] px-3 py-2 rounded-lg whitespace-pre-wrap"
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

      <div className="flex items-center gap-3 mt-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="px-4 py-2 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            color: VERDICT_META[verdict].color,
            background: `${VERDICT_META[verdict].color}10`,
            border: `1px solid ${VERDICT_META[verdict].color}40`,
            fontFamily: "var(--font-mono)",
          }}
        >
          {submitting ? "Submitting..." : `Submit ${VERDICT_META[verdict].label.toLowerCase()}`}
        </button>
        {drafts.length > 0 && (
          <button
            type="button"
            onClick={onDiscardAll}
            className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            discard {drafts.length} draft{drafts.length !== 1 ? "s" : ""}
          </button>
        )}
        <span
          className="ml-auto text-[10px] text-white/30"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {!summaryValid && "summary needs 50+ chars · "}
          {!reviewerValid && "reviewer id required · "}
          {!draftsValid && "empty draft(s) · "}
          {VERDICT_META[verdict].hint}
        </span>
      </div>
    </div>
  );
}
