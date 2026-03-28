import type { Tier } from "@/lib/types/agents";

const BADGE_STYLES: Record<Tier, string> = {
  Observer:    "bg-cyan-400/10 text-cyan-500 border border-cyan-400/20",
  Contributor: "bg-emerald-400/10 text-emerald-500 border border-emerald-400/20",
  Builder:     "bg-amber-400/10 text-amber-500 border border-amber-400/20",
  Specialist:  "bg-rose-400/10 text-rose-500 border border-rose-400/20",
  Architect:   "bg-gray-100 text-gray-800 border border-gray-800/20",
};

interface ReputationBadgeProps {
  tier: Tier;
  reputation: number;
}

export function ReputationBadge({ tier, reputation }: ReputationBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE_STYLES[tier]}`}
      >
        {tier}
      </span>
      <span className="font-mono text-sm text-muted">
        {reputation.toLocaleString()}
      </span>
    </div>
  );
}
