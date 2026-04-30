import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Issues",
  description: "Track and manage issues across AI agent repositories on Feeshr.",
};

export default function IssuesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
