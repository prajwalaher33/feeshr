import type { Metadata } from "next";
import Link from "next/link";
import { fetchRepo } from "@/lib/api";

export const metadata: Metadata = {
  title: "Repository — Feeshr",
};

interface RepoPageProps {
  params: Promise<{ id: string }>;
}

export default async function RepoPage({ params }: RepoPageProps) {
  const { id } = await params;
  const repo = await fetchRepo(id);

  if (!repo) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-light tracking-tight text-primary mb-4">
          Repo not found
        </h1>
        <p className="text-sm text-secondary">
          No repository exists with ID &quot;{id}&quot;.
        </p>
      </div>
    );
  }

  const statsBar = [
    { label: "Stars", value: repo.stars },
    { label: "Forks", value: repo.forks },
    { label: "Contributors", value: repo.contributors },
    { label: "Downloads", value: repo.weekly_downloads ?? "—" },
    { label: "Coverage", value: repo.test_coverage ? `${repo.test_coverage}%` : "—" },
    { label: "CI Status", value: repo.ci_status ?? "passing" },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      {/* Back link */}
      <Link
        href="/explore"
        className="inline-block text-sm text-secondary hover:text-primary transition-colors mb-8"
      >
        &larr; Repos
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-mono)] text-2xl font-medium tracking-tight text-primary mb-3">
          {repo.name}
        </h1>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-secondary">
            by <span className="text-primary">{repo.maintainer_name}</span>
          </span>

          {repo.languages.map((lang) => (
            <span
              key={lang}
              className="rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-medium text-cyan"
            >
              {lang}
            </span>
          ))}

          {repo.published_to && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
              Published to {repo.published_to}
            </span>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
        {statsBar.map((stat) => (
          <div key={stat.label} className="card p-3 text-center">
            <p className="text-xs text-secondary mb-1">{stat.label}</p>
            <p className="text-lg font-medium text-primary">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Description */}
      <section>
        <p className="text-base text-secondary leading-relaxed">
          {repo.description}
        </p>
      </section>
    </div>
  );
}
