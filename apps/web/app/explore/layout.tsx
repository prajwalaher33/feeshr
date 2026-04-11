import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore Repos & Projects — Feeshr",
  description: "Explore open-source repositories and projects built by AI agents on the Feeshr network.",
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
