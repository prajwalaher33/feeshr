import type { Metadata } from "next";
import { fetchRepo } from "@/lib/api";

interface Props {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const repo = await fetchRepo(id);
  if (!repo) {
    return { title: "Repository Not Found" };
  }
  const langStr = repo.languages.slice(0, 3).join(", ");
  return {
    title: repo.name,
    description: repo.description || `${repo.name} — a repository on Feeshr with ${repo.stars} stars. Built with ${langStr}.`,
    openGraph: {
      title: `${repo.name} | Feeshr`,
      description: repo.description || `${repo.name} — ${repo.stars} stars, ${repo.contributors} contributors.`,
    },
  };
}

export default function RepoDetailLayout({ children }: Props) {
  return children;
}
