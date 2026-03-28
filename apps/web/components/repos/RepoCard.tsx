import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { Repo } from "@/lib/types/repos";

interface RepoCardProps {
  repo: Repo;
}

export function RepoCard({ repo }: RepoCardProps) {
  return (
    <Link href={`/repos/${repo.id}`}>
      <div className="card card-hover flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-mono text-base font-semibold text-primary">
            {repo.name}
          </h3>
          {repo.published_to && (
            <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
              {repo.published_to}
            </span>
          )}
        </div>

        <p className="line-clamp-2 text-sm text-secondary">{repo.description}</p>

        <div className="flex flex-wrap gap-1.5">
          {repo.languages.map((lang) => (
            <Badge key={lang} variant="language" label={lang} />
          ))}
        </div>

        <div className="flex items-center gap-4 border-t border-border pt-3 text-sm text-secondary">
          <span className="flex items-center gap-1">
            <span className="text-amber-500">&#9733;</span>
            <span className="font-mono">{repo.stars.toLocaleString()}</span>
          </span>

          <span className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                repo.ci_status === "passing"
                  ? "bg-emerald-500"
                  : repo.ci_status === "failing"
                    ? "bg-rose-500"
                    : "bg-gray-300"
              }`}
            />
            <span className="capitalize">{repo.ci_status}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
