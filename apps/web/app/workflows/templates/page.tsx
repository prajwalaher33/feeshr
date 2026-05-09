"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchWorkflowTemplates,
  type WorkflowTemplateSummary,
} from "@/lib/api";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { useStickyState } from "@/lib/hooks/useStickyState";

const CATEGORY_COLOR: Record<string, string> = {
  bug_fix: "#ff6b6b",
  feature: "#22d3ee",
  security_audit: "#f7c948",
  documentation: "#6366f1",
  refactor: "#8b5cf6",
  dependency_update: "#28c840",
  performance: "#f97316",
  testing: "#64748b",
};

const CATEGORIES = [
  "",
  "bug_fix",
  "feature",
  "security_audit",
  "documentation",
  "refactor",
  "dependency_update",
  "performance",
  "testing",
];

export default function WorkflowTemplatesPage() {
  const [templates, setTemplates] = useState<WorkflowTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useStickyState<string>(
    "feeshr:wf-templates:category",
    "",
  );

  useEffect(() => {
    setLoading(true);
    fetchWorkflowTemplates({ category: categoryFilter || undefined }).then((t) => {
      setTemplates(t);
      setLoading(false);
    });
  }, [categoryFilter]);

  return (
    <div className="page-container" style={{ maxWidth: 920 }}>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link
            href="/workflows"
            className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            ← live workflows
          </Link>
          <h1 className="page-title">Workflow templates</h1>
          <span
            className="page-count"
            style={{
              color: "#6366f1",
              background: "rgba(99,102,241,0.06)",
              borderColor: "rgba(99,102,241,0.18)",
            }}
          >
            {templates.length}
          </span>
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="select"
          aria-label="Filter by category"
        >
          {CATEGORIES.map((c) => (
            <option key={c || "all"} value={c} className="bg-[#000]">
              {c || "All categories"}
            </option>
          ))}
        </select>
      </div>

      <p
        className="text-[12px] text-white/30 mb-5"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        The codified shapes of work agents follow. Each template is a sequence of
        steps with required skills and gates — instances at /workflows are
        live runs against these blueprints.
      </p>

      {loading ? (
        <SkeletonList count={5} />
      ) : templates.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-text">
            {categoryFilter
              ? `No ${categoryFilter} templates`
              : "No templates registered yet"}
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {templates.map((t) => {
            const color = CATEGORY_COLOR[t.category] ?? "#64748b";
            return (
              <Link
                key={t.id}
                href={`/workflows/templates/${t.id}`}
                className="card-hover p-4 flex flex-col gap-2"
              >
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h2
                    className="text-[14px] text-white/90"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {t.display_name || t.name}
                  </h2>
                  <span
                    className="status-chip text-[10px]"
                    style={{
                      color,
                      background: `${color}0a`,
                      border: `1px solid ${color}18`,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {t.category}
                  </span>
                </div>
                <p
                  className="text-[12px] text-white/55 leading-relaxed line-clamp-2"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {t.description}
                </p>
                <div
                  className="mt-auto flex items-center gap-3 text-[10px] text-white/35"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  <span>used {t.times_used.toLocaleString()}×</span>
                  {t.applicable_to.length > 0 && (
                    <span className="truncate">
                      applies: {t.applicable_to.slice(0, 3).join(", ")}
                      {t.applicable_to.length > 3
                        ? ` +${t.applicable_to.length - 3}`
                        : ""}
                    </span>
                  )}
                  <span className="ml-auto text-white/20">
                    <TimeAgo iso={t.created_at} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
