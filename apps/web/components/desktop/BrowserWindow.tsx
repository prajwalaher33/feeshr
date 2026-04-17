"use client";

import { useDesktopStore } from "@/lib/stores/desktop-store";
import { WindowFrame } from "./WindowFrame";

const BROWSER_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

export function BrowserWindow() {
  const { browser, activeTool } = useDesktopStore();

  return (
    <WindowFrame
      title={browser.title || "Browser"}
      icon={BROWSER_ICON}
      active={activeTool === "browser"}
    >
      <div className="flex flex-col h-full">
        {/* Address bar */}
        <div className="flex items-center gap-2 px-3 py-2 bg-surface border-b border-border-subtle shrink-0">
          {/* Nav buttons */}
          <div className="flex items-center gap-1">
            <button className="p-1 rounded hover:bg-raised text-muted" aria-label="Back">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button className="p-1 rounded hover:bg-raised text-muted" aria-label="Forward">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            {browser.loading ? (
              <div className="p-1">
                <div className="h-3 w-3 animate-spin rounded-full border border-border border-t-cyan" />
              </div>
            ) : (
              <button className="p-1 rounded hover:bg-raised text-muted" aria-label="Reload">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              </button>
            )}
          </div>

          {/* URL bar */}
          <div className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-bg rounded-md border border-border-subtle">
            {browser.url.startsWith("https") && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="text-mint shrink-0">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" />
              </svg>
            )}
            <span
              className="text-[11px] text-secondary truncate"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {browser.url || "about:blank"}
            </span>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-4">
          {!browser.url && !browser.content && (
            <div className="flex flex-col items-center justify-center h-full text-muted gap-2">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span className="text-xs">No page loaded</span>
            </div>
          )}

          {browser.loading && (
            <div className="space-y-3 animate-pulse">
              <div className="h-6 w-3/4 bg-raised rounded" />
              <div className="h-4 w-full bg-raised rounded" />
              <div className="h-4 w-5/6 bg-raised rounded" />
              <div className="h-4 w-2/3 bg-raised rounded" />
            </div>
          )}

          {browser.content && !browser.loading && (
            <div
              className="prose-invert text-sm text-secondary [&_h1]:text-primary [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mb-3 [&_p]:mb-2 [&_p]:leading-relaxed [&_strong]:text-primary [&_a]:text-cyan [&_code]:text-cyan-light [&_code]:bg-raised [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs"
              style={{ fontFamily: "var(--font-body)" }}
              dangerouslySetInnerHTML={{ __html: browser.content }}
            />
          )}
        </div>
      </div>
    </WindowFrame>
  );
}
