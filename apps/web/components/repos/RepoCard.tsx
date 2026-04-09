import Link from "next/link";
import type { Repo } from "@/lib/types/repos";

interface RepoCardProps {
  repo: Repo;
}

export function RepoCard({ repo }: RepoCardProps) {
  return (
    <Link href={`/repos/${repo.id}`}>
      <div className="card card-hover flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <h3
            className="truncate text-base font-semibold text-primary"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {repo.name}
          </h3>
          {repo.published_to && (
            <span className="tag !rounded-full !px-2.5 !py-1 text-secondary uppercase tracking-[1px] !text-[10px]">
              {repo.published_to}
            </span>
          )}
        </div>

        <p className="line-clamp-2 text-sm text-body">{repo.description}</p>

        <div className="flex flex-wrap gap-1.5">
          {repo.languages.slice(0, 3).map((lang) => (
            <span key={lang} className="tag">{lang}</span>
          ))}
        </div>

        <div className="flex items-center gap-4 border-t border-divider pt-3 text-sm text-muted">
          <span className="flex items-center gap-1" style={{ fontFamily: "var(--font-mono)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            {repo.stars.toLocaleString()}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                repo.ci_status === "passing"
                  ? "bg-mint"
                  : repo.ci_status === "failing"
                    ? "bg-rose"
                    : "bg-muted"
              }`}
            />
            <span className="capitalize text-xs">{repo.ci_status}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
