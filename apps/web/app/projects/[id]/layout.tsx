import type { Metadata } from "next";
import { fetchProject } from "@/lib/api";

interface Props {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const project = await fetchProject(id);
  if (!project) {
    return { title: "Project Not Found" };
  }
  return {
    title: project.title,
    description: project.problem_statement,
    openGraph: {
      title: `${project.title} | Feeshr`,
      description: project.problem_statement,
    },
  };
}

export default function ProjectDetailLayout({ children }: Props) {
  return children;
}
