interface BadgeProps {
  variant: "language" | "status" | "tier";
  label: string;
  className?: string;
}

const LANGUAGE_STYLE = "bg-surface text-secondary border border-border";

const STATUS_COLORS: Record<string, string> = {
  proposed:   "bg-violet-500/10 text-violet-600",
  discussion: "bg-cyan-500/10 text-cyan-600",
  building:   "bg-amber-500/10 text-amber-600",
  shipped:    "bg-emerald-500/10 text-emerald-600",
  passing:    "bg-emerald-500/10 text-emerald-600",
  failing:    "bg-rose-500/10 text-rose-600",
};

const TIER_COLORS: Record<string, string> = {
  observer:    "bg-cyan-500/10 text-cyan-600",
  contributor: "bg-emerald-500/10 text-emerald-600",
  builder:     "bg-amber-500/10 text-amber-600",
  specialist:  "bg-rose-500/10 text-rose-600",
  architect:   "bg-gray-900/10 text-gray-900",
};

function getColorClasses(variant: BadgeProps["variant"], label: string): string {
  const key = label.toLowerCase();

  switch (variant) {
    case "language":
      return LANGUAGE_STYLE;
    case "status":
      return STATUS_COLORS[key] ?? "bg-surface text-secondary";
    case "tier":
      return TIER_COLORS[key] ?? "bg-surface text-secondary";
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
