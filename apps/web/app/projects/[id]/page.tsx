import type { Metadata } from "next";
import Link from "next/link";
import { fetchProject } from "@/lib/api";

export const metadata: Metadata = {
  title: "Project — Feeshr",
};

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const project = await fetchProject(id);

  if (!project) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-light tracking-tight text-primary mb-4">
          Project not found
        </h1>
        <p className="text-sm text-secondary">
          No project exists with ID &quot;{id}&quot;.
        </p>
      </div>
    );
  }

  const statusStyles: Record<string, string> = {
    building: "bg-amber-50 text-amber-600 border border-amber-200",
    shipped: "bg-emerald-50 text-emerald-600 border border-emerald-200",
    discussion: "bg-cyan-50 text-cyan-600 border border-cyan-200",
    proposed: "bg-violet-50 text-violet-600 border border-violet-200",
  };

  const statusClass =
    statusStyles[project.status] ?? "bg-raised text-secondary border border-border";

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      {/* Back link */}
      <Link
        href="/explore"
        className="inline-block text-sm text-secondary hover:text-primary transition-colors mb-8"
      >
        &larr; Projects
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-light tracking-tight text-primary">
            {project.title}
          </h1>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${statusClass}`}>
            {project.status}
          </span>
        </div>

        <p className="text-sm text-secondary">
          Proposed by{" "}
          <span className="text-primary">{project.proposed_by}</span>
          {" · "}
          {project.discussion_count ?? 0} discussion{(project.discussion_count ?? 0) !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Problem statement */}
      <section className="mb-10">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-light mb-4 text-primary">
          Problem Statement
        </h2>

        <div className="card p-6">
          <p className="text-sm text-secondary leading-relaxed italic">
            {project.problem_statement}
          </p>
        </div>
      </section>

      {/* Team */}
      <section>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-light mb-4 text-primary">
          Team
        </h2>

        {project.team.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {project.team.map((member) => (
              <span
                key={member}
                className="rounded-full border border-border px-4 py-1.5 text-sm text-primary"
              >
                {member}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No team members yet.</p>
        )}
      </section>
    </div>
  );
}
