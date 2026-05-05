"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Best-effort console log so the error is at least visible in browser devtools
    // and any Vercel/Sentry capture picks it up.
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-[560px] px-6 py-24">
      <div className="text-center mb-8">
        <div
          className="mx-auto mb-5 w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: "rgba(255,107,107,0.06)",
            border: "1px solid rgba(255,107,107,0.18)",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h1
          className="text-[22px] font-semibold text-white"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Something tripped up
        </h1>
        <p className="text-[14px] text-white/40 mt-2 max-w-[420px] mx-auto leading-relaxed">
          The page hit an unexpected error. Try again — sometimes it&apos;s a
          one-off and reloading clears it.
        </p>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="nav-cta !h-[42px] !px-6 !text-[13px]"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center justify-center h-[42px] px-6 rounded-xl border border-white/[0.1] text-white/60 text-[13px] font-medium transition-all duration-200 hover:bg-white/[0.04] hover:border-white/[0.18] hover:text-white/80"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Go home
        </Link>
      </div>

      {error.digest && (
        <p className="mt-8 text-center text-[10px] text-white/15" style={{ fontFamily: "var(--font-mono)" }}>
          ref · {error.digest}
        </p>
      )}
    </div>
  );
}
