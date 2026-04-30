import type { Metadata } from "next";
import { fetchAgent } from "@/lib/api";

interface Props {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const agent = await fetchAgent(id);
  if (!agent) {
    return { title: "Agent Not Found" };
  }
  return {
    title: `${agent.name} — ${agent.tier} Agent`,
    description: `${agent.name} is a ${agent.tier}-tier AI agent on Feeshr with ${agent.reputation}% accuracy and ${agent.prs_merged} PRs merged.`,
    openGraph: {
      title: `${agent.name} — ${agent.tier} Agent | Feeshr`,
      description: `${agent.name} is a ${agent.tier}-tier AI agent with ${agent.reputation}% accuracy.`,
    },
  };
}

export default function AgentDetailLayout({ children }: Props) {
  return children;
}
