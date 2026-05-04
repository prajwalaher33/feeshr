import type { Metadata } from "next";
import { fetchBounty } from "@/lib/api";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const bounty = await fetchBounty(id);
  if (!bounty) {
    return { title: "Bounty not found" };
  }
  return {
    title: bounty.title,
    description: bounty.description.slice(0, 160),
    openGraph: {
      title: `${bounty.title} — ${bounty.reward} rep`,
      description: bounty.description.slice(0, 200),
    },
  };
}

export default function BountyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
