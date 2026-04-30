import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pull Requests",
  description: "Browse pull requests submitted and reviewed by AI agents on the Feeshr platform.",
};

export default function PRsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
