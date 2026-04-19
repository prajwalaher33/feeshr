"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useDesktopStore } from "@/lib/stores/desktop-store";

export function BrowserWindow() {
  const { browser } = useDesktopStore();

  return (
    <div className="flex flex-col h-full">
      {/* Address bar */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: "linear-gradient(180deg, rgba(255,255,255,0.012), rgba(255,255,255,0.004))", boxShadow: "0 1px 0 rgba(0,0,0,0.15)" }}>
        {/* Nav buttons */}
        <div className="flex items-center gap-1">
          <button className="p-1 rounded-md hover:bg-[rgba(255,255,255,0.03)] text-[#3a4250] transition-colors" aria-label="Back">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button className="p-1 rounded-md hover:bg-[rgba(255,255,255,0.03)] text-[#3a4250] transition-colors" aria-label="Forward">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          {browser.loading ? (
            <div className="p-1">
              <div className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-[rgba(255,255,255,0.04)] border-t-cyan/60" />
            </div>
          ) : (
            <button className="p-1 rounded-md hover:bg-[rgba(255,255,255,0.03)] text-[#3a4250] transition-colors" aria-label="Reload">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          )}
        </div>

        {/* URL bar */}
        <div className="flex-1 flex items-center gap-2 px-3 py-[4px] rounded-lg" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.025), rgba(255,255,255,0.012))", border: "1px solid rgba(255,255,255,0.04)", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.15), 0 1px 0 rgba(255,255,255,0.01)" }}>
          {browser.url.startsWith("https") && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="text-[#28c840]/70 shrink-0">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" />
            </svg>
          )}
          <span
            className="text-[11px] text-[#5a6270] truncate"
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
            className="h-[1.5px] origin-left"
            style={{ background: "linear-gradient(90deg, #22d3ee 0%, #4de8f5 40%, rgba(34,211,238,0.3) 80%, transparent 100%)", boxShadow: "0 0 8px rgba(34,211,238,0.3), 0 0 20px rgba(34,211,238,0.1)" }}
          />
        )}
      </AnimatePresence>

      {/* Page content */}
      <div className="flex-1 overflow-auto p-5">
        {!browser.url && !browser.content && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-[#1a2030]">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span className="text-[11px] text-[#2a3040]">No page loaded</span>
          </div>
        )}

        {browser.loading && !browser.content && (
          <div className="space-y-3">
            <motion.div animate={{ opacity: [0.08, 0.25, 0.08] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="h-5 w-3/4 rounded" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.02), rgba(34,211,238,0.03), rgba(255,255,255,0.02))" }} />
            <motion.div animate={{ opacity: [0.08, 0.25, 0.08] }} transition={{ duration: 2, repeat: Infinity, delay: 0.15, ease: "easeInOut" }} className="h-3.5 w-full rounded" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.02), rgba(34,211,238,0.03), rgba(255,255,255,0.02))" }} />
            <motion.div animate={{ opacity: [0.08, 0.25, 0.08] }} transition={{ duration: 2, repeat: Infinity, delay: 0.3, ease: "easeInOut" }} className="h-3.5 w-5/6 rounded" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.02), rgba(34,211,238,0.03), rgba(255,255,255,0.02))" }} />
          </div>
        )}

        <AnimatePresence mode="wait">
          {browser.content && !browser.loading && (
            <motion.div
              key={browser.url}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="text-[12.5px] text-[#8891a5] leading-[1.7] [&_h1]:text-[#d4d8e4] [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mb-3 [&_p]:mb-2.5 [&_strong]:text-[#d4d8e4] [&_a]:text-cyan/80 [&_code]:text-cyan/60 [&_code]:bg-[rgba(255,255,255,0.03)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[11px]"
              style={{ fontFamily: "var(--font-body)" }}
              dangerouslySetInnerHTML={{ __html: browser.content }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
