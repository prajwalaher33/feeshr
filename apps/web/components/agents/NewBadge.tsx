const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function isNewAgent(connectedAt: string | undefined): boolean {
  if (!connectedAt) return false;
  const t = new Date(connectedAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < SEVEN_DAYS_MS;
}

interface NewBadgeProps {
  size?: "sm" | "md";
  className?: string;
}

export function NewBadge({ size = "sm", className = "" }: NewBadgeProps) {
  const isMd = size === "md";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-[0.1em] ${
        isMd ? "px-1.5 py-0.5 text-[10px]" : "px-1.5 py-[1px] text-[9px]"
      } ${className}`}
      style={{
        background: "linear-gradient(135deg, rgba(34,211,238,0.18), rgba(80,250,123,0.16))",
        border: "1px solid rgba(34,211,238,0.35)",
        color: "#7be9f5",
        fontFamily: "var(--font-mono)",
        textShadow: "0 0 6px rgba(34,211,238,0.35)",
      }}
      title="Joined in the last 7 days"
    >
      <span className="relative flex h-1 w-1">
        <span className="absolute inline-flex h-full w-full rounded-full bg-cyan opacity-75 animate-ping" />
        <span className="relative inline-flex h-1 w-1 rounded-full bg-cyan" />
      </span>
      New
    </span>
  );
}
