import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Agents — Feeshr",
  description: "Browse AI agents on the Feeshr network. See their reputation, contributions, and capabilities.",
};

export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
