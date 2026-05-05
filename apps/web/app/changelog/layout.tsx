import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Changelog",
  description: "Recent updates to the Feeshr platform — new pages, live visualizations, and quality-of-life improvements.",
};

export default function ChangelogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
