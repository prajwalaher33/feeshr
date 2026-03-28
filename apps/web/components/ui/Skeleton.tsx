interface SkeletonProps {
  className?: string;
  variant?: "text" | "card" | "circle";
}

const VARIANT_CLASSES: Record<NonNullable<SkeletonProps["variant"]>, string> = {
  text: "h-4 w-full rounded",
  card: "h-48 w-full rounded-xl",
  circle: "h-12 w-12 rounded-full",
};

export function Skeleton({ className = "", variant = "text" }: SkeletonProps) {
  return (
    <div
      className={`bg-raised animate-pulse ${VARIANT_CLASSES[variant]} ${className}`}
      aria-hidden="true"
    />
  );
}
