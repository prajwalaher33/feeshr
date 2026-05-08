"use client";

import { useMemo, useState } from "react";
import type { RepoDiff, DiffFileStat, ReviewFinding, PrReview } from "@/lib/api";

/** A line-level review comment with reviewer metadata for inline display. */
export interface DiffComment extends ReviewFinding {
  reviewer_id: string;
  reviewer_display_name?: string;
  verdict: PrReview["verdict"];
  created_at: string;
}

/** A draft (unsaved) line comment the reviewer is composing. */
export interface DraftFinding extends ReviewFinding {
  /** Stable client-side id so React can key edits/removes. */
  id: string;
}

interface DiffViewProps {
  diff: RepoDiff;
  /** Line-anchored review comments to render in-thread under matching rows. */
  comments?: DiffComment[];
  /** Local draft comments the reviewer is still composing. */
  drafts?: DraftFinding[];
  /** Called when the reviewer clicks the "+" on a diff line. */
  onAddDraft?: (file: string, line: number, side: "old" | "new") => void;
  /** Update a draft's body in place. */
  onEditDraft?: (id: string, body: string) => void;
  /** Discard a draft. */
  onRemoveDraft?: (id: string) => void;
}

interface ParsedFile {
  stat: DiffFileStat | null;
  /** Header lines from the diff (diff --git, ---, +++, etc.) — not rendered as hunk lines. */
  oldPath: string;
  newPath: string;
  hunks: Hunk[];
}

interface Hunk {
  header: string;
  lines: HunkLine[];
}

interface HunkLine {
  kind: "ctx" | "add" | "del" | "meta";
  oldNo: number | null;
  newNo: number | null;
  text: string;
}

function parseUnifiedDiff(raw: string, stats: DiffFileStat[]): ParsedFile[] {
  const statByPath = new Map(stats.map((s) => [s.path, s] as const));
  const lines = raw.split("\n");
  const files: ParsedFile[] = [];
  let cur: ParsedFile | null = null;
  let curHunk: Hunk | null = null;
  let oldNo = 0;
  let newNo = 0;

  const flushFile = () => {
    if (cur) files.push(cur);
    cur = null;
    curHunk = null;
  };

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      flushFile();
      // "diff --git a/path b/path" — pull the b/ side as canonical
      const m = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      const oldPath = m?.[1] ?? "";
      const newPath = m?.[2] ?? "";
      cur = {
        stat: statByPath.get(newPath) ?? statByPath.get(oldPath) ?? null,
        oldPath,
        newPath,
        hunks: [],
      };
      continue;
    }
    if (!cur) continue;

    if (line.startsWith("@@")) {
      // @@ -oldStart,oldLines +newStart,newLines @@ ...
      const m = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      oldNo = m ? parseInt(m[1], 10) : 0;
      newNo = m ? parseInt(m[2], 10) : 0;
      curHunk = { header: line, lines: [] };
      cur.hunks.push(curHunk);
      continue;
    }

    // Skip the per-file header lines (---, +++, index, mode changes, binary)
    if (
      !curHunk &&
      (line.startsWith("---") ||
        line.startsWith("+++") ||
        line.startsWith("index ") ||
        line.startsWith("new file") ||
        line.startsWith("deleted file") ||
        line.startsWith("rename ") ||
        line.startsWith("similarity ") ||
        line.startsWith("Binary files"))
    ) {
      continue;
    }

    if (!curHunk) continue;
    if (line.startsWith("+")) {
      curHunk.lines.push({ kind: "add", oldNo: null, newNo: newNo++, text: line.slice(1) });
    } else if (line.startsWith("-")) {
      curHunk.lines.push({ kind: "del", oldNo: oldNo++, newNo: null, text: line.slice(1) });
    } else if (line.startsWith("\\")) {
      // "\ No newline at end of file" — keep as meta
      curHunk.lines.push({ kind: "meta", oldNo: null, newNo: null, text: line });
    } else {
      // Context line — leading space, or empty line inside hunk
      curHunk.lines.push({
        kind: "ctx",
        oldNo: oldNo++,
        newNo: newNo++,
        text: line.startsWith(" ") ? line.slice(1) : line,
      });
    }
  }
  flushFile();
  return files;
}

const KIND_BG: Record<HunkLine["kind"], string> = {
  add: "rgba(34,197,94,0.08)",
  del: "rgba(239,68,68,0.08)",
  ctx: "transparent",
  meta: "rgba(203,213,225,0.04)",
};
const KIND_GUTTER: Record<HunkLine["kind"], string> = {
  add: "rgba(34,197,94,0.18)",
  del: "rgba(239,68,68,0.18)",
  ctx: "rgba(203,213,225,0.12)",
  meta: "rgba(203,213,225,0.10)",
};
const KIND_PREFIX: Record<HunkLine["kind"], string> = {
  add: "+",
  del: "-",
  ctx: " ",
  meta: " ",
};

function DraftEditor({
  draft,
  onEdit,
  onRemove,
}: {
  draft: DraftFinding;
  onEdit?: (id: string, body: string) => void;
  onRemove?: (id: string) => void;
}) {
  return (
    <div
      className="px-3 py-2 border-y"
      style={{
        background: "rgba(247,201,72,0.05)",
        borderColor: "rgba(247,201,72,0.18)",
      }}
    >
      <div className="flex items-start gap-2">
        <span
          className="shrink-0 mt-1.5 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{
            color: "#f7c948",
            background: "rgba(247,201,72,0.10)",
            border: "1px solid rgba(247,201,72,0.25)",
            fontFamily: "var(--font-mono)",
          }}
        >
          draft
        </span>
        <textarea
          value={draft.body}
          autoFocus
          rows={2}
          placeholder="Leave a comment on this line..."
          onChange={(e) => onEdit?.(draft.id, e.target.value)}
          className="flex-1 min-w-0 bg-transparent border border-white/10 rounded px-2 py-1.5 text-[12px] text-white/85 leading-relaxed focus:outline-none focus:border-cyan/40 resize-y"
          style={{ fontFamily: "var(--font-mono)" }}
        />
        <button
          type="button"
          onClick={() => onRemove?.(draft.id)}
          className="shrink-0 mt-1 text-[10px] text-white/40 hover:text-[#ff6b6b] transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
          title="Discard"
        >
          remove
        </button>
      </div>
    </div>
  );
}

function CommentThread({ comments }: { comments: DiffComment[] }) {
  return (
    <div
      className="px-3 py-2 border-y"
      style={{
        background: "rgba(34,211,238,0.04)",
        borderColor: "rgba(34,211,238,0.12)",
      }}
    >
      <div className="flex flex-col gap-2">
        {comments.map((c, i) => {
          const sevColor = c.severity ? SEVERITY_DOT[c.severity] : VERDICT_DOT[c.verdict];
          return (
            <div key={i} className="flex items-start gap-2">
              <span
                className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: sevColor, boxShadow: `0 0 4px ${sevColor}66` }}
              />
              <div className="flex-1 min-w-0">
                <div
                  className="text-[10px] text-white/40 mb-0.5 flex items-center gap-2"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  <span>{c.reviewer_display_name ?? c.reviewer_id.slice(0, 12)}</span>
                  {c.severity && (
                    <span style={{ color: sevColor }}>· {c.severity}</span>
                  )}
                  <span className="ml-auto">{new Date(c.created_at).toLocaleString()}</span>
                </div>
                <p className="text-[12px] text-white/85 leading-relaxed whitespace-pre-wrap m-0">
                  {c.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Build "file::side::line" → comments lookup so lookup per row is O(1). */
function indexComments(comments: DiffComment[] | undefined): Map<string, DiffComment[]> {
  const out = new Map<string, DiffComment[]>();
  for (const c of comments ?? []) {
    const side = c.side ?? "new";
    const key = `${c.file}::${side}::${c.line}`;
    const arr = out.get(key);
    if (arr) arr.push(c);
    else out.set(key, [c]);
  }
  return out;
}

const VERDICT_DOT: Record<DiffComment["verdict"], string> = {
  approve: "#28c840",
  request_changes: "#f7c948",
  reject: "#ff6b6b",
};

const SEVERITY_DOT: Record<NonNullable<DiffComment["severity"]>, string> = {
  info: "#22d3ee",
  warn: "#f7c948",
  error: "#ff6b6b",
};

/** Same shape as indexComments but for drafts. */
function indexDrafts(drafts: DraftFinding[] | undefined): Map<string, DraftFinding[]> {
  const out = new Map<string, DraftFinding[]>();
  for (const d of drafts ?? []) {
    const side = d.side ?? "new";
    const key = `${d.file}::${side}::${d.line}`;
    const arr = out.get(key);
    if (arr) arr.push(d);
    else out.set(key, [d]);
  }
  return out;
}

export function DiffView({
  diff,
  comments,
  drafts,
  onAddDraft,
  onEditDraft,
  onRemoveDraft,
}: DiffViewProps) {
  const files = useMemo(
    () => parseUnifiedDiff(diff.diff ?? "", diff.files ?? []),
    [diff.diff, diff.files],
  );
  const commentIndex = useMemo(() => indexComments(comments), [comments]);
  const draftIndex = useMemo(() => indexDrafts(drafts), [drafts]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const drafting = onAddDraft != null;

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (!diff.diff || files.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state-text">No changes between {diff.base} and {diff.head}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {diff.truncated && (
        <div
          className="text-[12px] px-3 py-2 rounded-lg"
          style={{
            color: "#f7c948",
            background: "rgba(247,201,72,0.08)",
            border: "1px solid rgba(247,201,72,0.18)",
            fontFamily: "var(--font-mono)",
          }}
        >
          Diff was truncated at the server cap. Some hunks may be missing.
        </div>
      )}
      {files.map((f) => {
        const key = f.newPath || f.oldPath;
        const isCollapsed = collapsed.has(key);
        const fileComments = (comments ?? []).filter(
          (c) => c.file === f.newPath || c.file === f.oldPath,
        );
        return (
          <div key={key} className="card overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(key)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left"
              aria-expanded={!isCollapsed}
            >
              <span className="text-white/30 text-[10px] w-3" style={{ fontFamily: "var(--font-mono)" }}>
                {isCollapsed ? "▸" : "▾"}
              </span>
              <span className="flex-1 truncate text-[13px] text-white/85" style={{ fontFamily: "var(--font-mono)" }}>
                {f.newPath !== f.oldPath && f.oldPath ? `${f.oldPath} → ${f.newPath}` : f.newPath || f.oldPath}
              </span>
              {fileComments.length > 0 && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{
                    color: "#22d3ee",
                    background: "rgba(34,211,238,0.08)",
                    border: "1px solid rgba(34,211,238,0.18)",
                    fontFamily: "var(--font-mono)",
                  }}
                  title={`${fileComments.length} review comment${fileComments.length !== 1 ? "s" : ""}`}
                >
                  {fileComments.length}
                </span>
              )}
              {f.stat && (
                <span className="flex items-center gap-2 text-[11px]" style={{ fontFamily: "var(--font-mono)" }}>
                  {f.stat.binary ? (
                    <span className="text-white/40">binary</span>
                  ) : (
                    <>
                      <span className="text-[#28c840]">+{f.stat.additions ?? 0}</span>
                      <span className="text-[#ff6b6b]">-{f.stat.deletions ?? 0}</span>
                    </>
                  )}
                </span>
              )}
            </button>
            {!isCollapsed && f.hunks.length > 0 && (
              <div className="border-t border-white/[0.06] overflow-x-auto">
                <pre
                  className="text-[12px] leading-[1.55] m-0"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {f.hunks.map((h, hi) => (
                    <div key={hi}>
                      <div
                        className="px-3 py-1 text-white/40 select-none"
                        style={{
                          background: "rgba(203,213,225,0.04)",
                          borderTop: hi > 0 ? "1px solid rgba(203,213,225,0.06)" : "none",
                        }}
                      >
                        {h.header}
                      </div>
                      {h.lines.map((ln, li) => {
                        // A comment can anchor to either side of the diff;
                        // check both keys so context lines (which have both
                        // line numbers) match comments on either side.
                        const onNew =
                          ln.newNo != null
                            ? commentIndex.get(`${f.newPath}::new::${ln.newNo}`) ??
                              commentIndex.get(`${f.oldPath}::new::${ln.newNo}`)
                            : undefined;
                        const onOld =
                          ln.oldNo != null
                            ? commentIndex.get(`${f.newPath}::old::${ln.oldNo}`) ??
                              commentIndex.get(`${f.oldPath}::old::${ln.oldNo}`)
                            : undefined;
                        const lineComments = [...(onNew ?? []), ...(onOld ?? [])];
                        const lineDrafts = [
                          ...(ln.newNo != null
                            ? draftIndex.get(`${f.newPath}::new::${ln.newNo}`) ?? []
                            : []),
                          ...(ln.oldNo != null
                            ? draftIndex.get(`${f.newPath}::old::${ln.oldNo}`) ?? []
                            : []),
                        ];
                        // Default-side for the "+" button: prefer "new" when
                        // the line exists in the post-change file (add or
                        // ctx); fall back to "old" for deletions.
                        const draftSide: "old" | "new" =
                          ln.newNo != null ? "new" : "old";
                        const draftLine = ln.newNo ?? ln.oldNo;
                        const canDraft =
                          drafting && draftLine != null && ln.kind !== "meta";
                        return (
                          <div key={li}>
                            <div
                              className="group grid"
                              style={{
                                gridTemplateColumns: "44px 44px 16px 1fr",
                                background: KIND_BG[ln.kind],
                                borderLeft: `2px solid ${KIND_GUTTER[ln.kind]}`,
                              }}
                            >
                              <span className="text-right pr-2 text-white/25 select-none">
                                {ln.oldNo ?? ""}
                              </span>
                              <span className="text-right pr-2 text-white/25 select-none relative">
                                {ln.newNo ?? ""}
                                {canDraft && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onAddDraft?.(f.newPath, draftLine, draftSide)
                                    }
                                    className="opacity-0 group-hover:opacity-100 transition-opacity absolute -left-1 top-1/2 -translate-y-1/2 w-4 h-4 rounded text-[11px] leading-none flex items-center justify-center"
                                    style={{
                                      background: "#22d3ee",
                                      color: "#000",
                                      fontFamily: "var(--font-mono)",
                                    }}
                                    title="Comment on this line"
                                    aria-label="Add line comment"
                                  >
                                    +
                                  </button>
                                )}
                              </span>
                              <span
                                className="text-center select-none"
                                style={{
                                  color:
                                    ln.kind === "add"
                                      ? "#28c840"
                                      : ln.kind === "del"
                                        ? "#ff6b6b"
                                        : "rgba(203,213,225,0.30)",
                                }}
                              >
                                {KIND_PREFIX[ln.kind]}
                              </span>
                              <span className="text-white/85 whitespace-pre">{ln.text}</span>
                            </div>
                            {lineComments.length > 0 && (
                              <CommentThread comments={lineComments} />
                            )}
                            {lineDrafts.map((d) => (
                              <DraftEditor
                                key={d.id}
                                draft={d}
                                onEdit={onEditDraft}
                                onRemove={onRemoveDraft}
                              />
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </pre>
              </div>
            )}
            {!isCollapsed && f.hunks.length === 0 && (
              <div className="border-t border-white/[0.06] px-4 py-3 text-[12px] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
                No textual hunks (likely binary or whitespace-only).
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
