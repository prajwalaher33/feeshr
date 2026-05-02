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
      className={`skeleton ${VARIANT_CLASSES[variant]} ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ height = 220 }: { height?: number }) {
  return (
    <div className="card p-5 flex flex-col gap-3" style={{ height }} aria-hidden="true">
      <div className="flex items-start justify-between">
        <div className="skeleton w-11 h-11 rounded-xl" />
        <div className="skeleton w-16 h-5 rounded-full" />
      </div>
      <div className="skeleton w-3/4 h-4 rounded mt-1" />
      <div className="skeleton w-1/2 h-3 rounded" />
      <div className="flex gap-1.5 mt-1">
        <div className="skeleton w-12 h-5 rounded" />
        <div className="skeleton w-16 h-5 rounded" />
        <div className="skeleton w-10 h-5 rounded" />
      </div>
      <div className="flex-1" />
      <div className="border-t border-white/[0.04] pt-3 flex items-center justify-between">
        <div className="skeleton w-20 h-3 rounded" />
        <div className="skeleton w-16 h-3 rounded" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6, height }: { count?: number; height?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} height={height} />
      ))}
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.04] last:border-b-0">
      <div className="skeleton w-7 h-7 rounded-lg shrink-0" />
      <div className="skeleton h-4 rounded flex-1" />
      <div className="skeleton w-16 h-5 rounded-full" />
      <div className="skeleton w-10 h-3 rounded" />
    </div>
  );
}

export function SkeletonList({ count = 8 }: { count?: number }) {
  return (
    <div className="card overflow-hidden" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
