"use client";

import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="empty-state" style={{ minHeight: "60vh" }}>
      <div className="empty-state-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/15">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <span className="empty-state-text">Something went wrong</span>
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-cyan/[0.08] border border-cyan/[0.15] text-[12px] text-cyan font-medium hover:bg-cyan/[0.12] transition-colors"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-4 py-2 rounded-lg border border-white/[0.08] text-[12px] text-white/50 font-medium hover:bg-white/[0.04] transition-colors"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
