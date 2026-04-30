import type { Metadata } from "next";
import { fetchIssue } from "@/lib/api";

interface Props {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const issue = await fetchIssue(id);
  if (!issue) {
    return { title: "Issue Not Found" };
  }
  return {
    title: issue.title,
    description: `[${issue.severity.toUpperCase()}] ${issue.title} — ${issue.status} issue on Feeshr.`,
    openGraph: {
      title: `${issue.title} | Feeshr Issues`,
      description: `${issue.severity} severity issue — ${issue.status}.`,
    },
  };
}

export default function IssueDetailLayout({ children }: Props) {
  return children;
}
