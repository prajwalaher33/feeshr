"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useDesktopStore } from "@/lib/stores/desktop-store";

export function BrowserWindow() {
  const { browser } = useDesktopStore();

  return (
    <div className="flex flex-col h-full">
      {/* Address bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[rgba(255,255,255,0.04)] shrink-0 bg-[rgba(255,255,255,0.01)]">
        {/* Nav buttons */}
        <div className="flex items-center gap-1.5">
          <button className="p-1 rounded-md hover:bg-[rgba(255,255,255,0.04)] text-[#5a6270] transition-colors" aria-label="Back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button className="p-1 rounded-md hover:bg-[rgba(255,255,255,0.04)] text-[#5a6270] transition-colors" aria-label="Forward">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          {browser.loading ? (
            <div className="p-1">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-[rgba(255,255,255,0.06)] border-t-cyan" />
            </div>
          ) : (
            <button className="p-1 rounded-md hover:bg-[rgba(255,255,255,0.04)] text-[#5a6270] transition-colors" aria-label="Reload">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          )}
        </div>

        {/* URL bar */}
        <div className="flex-1 flex items-center gap-2 px-3 py-[5px] bg-[rgba(255,255,255,0.03)] rounded-lg border border-[rgba(255,255,255,0.04)]">
          {browser.url.startsWith("https") && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-[#28c840] shrink-0">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" />
            </svg>
          )}
          <span
            className="text-[12px] text-[#7a8394] truncate"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {browser.url || "about:blank"}
          </span>
        </div>
      </div>

      {/* Loading bar */}
      <AnimatePresence>
        {browser.loading && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 0.7 }}
            exit={{ scaleX: 1, opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="h-[2px] bg-gradient-to-r from-cyan via-cyan to-transparent origin-left"
          />
        )}
      </AnimatePresence>

      {/* Page content */}
      <div className="flex-1 overflow-auto p-5">
        {!browser.url && !browser.content && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-[#2a3040]">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span className="text-[12px] text-[#3a4250]">No page loaded</span>
          </div>
        )}

        {browser.loading && !browser.content && (
          <div className="space-y-3">
            <motion.div animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }} className="h-6 w-3/4 bg-[rgba(255,255,255,0.03)] rounded" />
            <motion.div animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.1 }} className="h-4 w-full bg-[rgba(255,255,255,0.03)] rounded" />
            <motion.div animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }} className="h-4 w-5/6 bg-[rgba(255,255,255,0.03)] rounded" />
          </div>
        )}

        <AnimatePresence mode="wait">
          {browser.content && !browser.loading && (
            <motion.div
              key={browser.url}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="text-[13px] text-[#9aa5b4] leading-relaxed [&_h1]:text-[#e2e8f0] [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mb-3 [&_p]:mb-2.5 [&_strong]:text-[#e2e8f0] [&_a]:text-cyan [&_code]:text-cyan/80 [&_code]:bg-[rgba(255,255,255,0.04)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[12px]"
              style={{ fontFamily: "var(--font-body)" }}
              dangerouslySetInnerHTML={{ __html: browser.content }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
