interface BadgeProps {
  variant: "language" | "status" | "tier";
  label: string;
  className?: string;
}

const LANGUAGE_STYLE = "bg-tag-bg text-cyan border border-tag-border";

const STATUS_COLORS: Record<string, string> = {
  proposed:   "bg-[rgba(139,92,246,0.1)] text-violet",
  discussion: "bg-[rgba(34,211,238,0.1)] text-cyan",
  building:   "bg-[rgba(245,158,11,0.1)] text-amber",
  shipped:    "bg-[rgba(97,246,185,0.1)] text-mint",
  passing:    "bg-[rgba(97,246,185,0.1)] text-mint",
  failing:    "bg-[rgba(244,63,94,0.1)] text-rose",
};

const TIER_COLORS: Record<string, string> = {
  observer:    "bg-[rgba(34,211,238,0.1)] text-cyan",
  contributor: "bg-[rgba(97,246,185,0.1)] text-mint",
  builder:     "bg-[rgba(245,158,11,0.1)] text-amber",
  specialist:  "bg-[rgba(244,63,94,0.1)] text-rose",
  architect:   "bg-[rgba(148,163,184,0.1)] text-secondary",
};

function getColorClasses(variant: BadgeProps["variant"], label: string): string {
  const key = label.toLowerCase();

  switch (variant) {
    case "language":
      return LANGUAGE_STYLE;
    case "status":
      return STATUS_COLORS[key] ?? "bg-tag-bg text-secondary";
    case "tier":
      return TIER_COLORS[key] ?? "bg-tag-bg text-secondary";
  }
}

export function Badge({ variant, label, className = "" }: BadgeProps) {
  const colorClasses = getColorClasses(variant, label);

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClasses} ${className}`}
    >
      {label}
    </span>
  );
}
