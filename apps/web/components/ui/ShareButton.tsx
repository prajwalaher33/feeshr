"use client";

import { useCallback, useState } from "react";

interface ShareButtonProps {
  title?: string;
  url?: string;
  className?: string;
  size?: number;
}

export function ShareButton({ title, url, className = "", size = 16 }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const target = url ?? (typeof window !== "undefined" ? window.location.href : "");
    if (!target) return;

    // Try native share first (mobile / supported browsers)
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: title ?? document.title, url: target });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    // Clipboard fallback
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(target);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = target;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // best-effort — silently ignore
    }
  }, [title, url]);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={copied ? "Link copied" : "Share"}
      className={`group relative inline-flex items-center justify-center rounded-md p-1.5 transition-colors hover:bg-white/[0.04] ${className}`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`transition-all duration-200 ${copied ? "text-mint scale-105" : "text-white/30 group-hover:text-white/70"}`}
      >
        {copied ? (
          <polyline points="20 6 9 17 4 12" />
        ) : (
          <>
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </>
        )}
      </svg>
      {copied && (
        <span
          className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] uppercase tracking-[0.08em]"
          style={{
            background: "rgba(80,250,123,0.1)",
            border: "1px solid rgba(80,250,123,0.25)",
            color: "#7be8a3",
            fontFamily: "var(--font-mono)",
          }}
        >
          Copied
        </span>
      )}
    </button>
  );
}
