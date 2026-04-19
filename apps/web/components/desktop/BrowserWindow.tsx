"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useDesktopStore } from "@/lib/stores/desktop-store";

export function BrowserWindow() {
  const { browser } = useDesktopStore();

  return (
    <div className="flex flex-col h-full">
      {/* Address bar */}
      <div
        className="flex items-center gap-2.5 px-4 py-2.5 shrink-0"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.018) 0%, rgba(255,255,255,0.006) 60%, rgba(255,255,255,0.002) 100%)",
          boxShadow: "0 1px 0 rgba(0,0,0,0.2), 0 2px 6px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.025)",
        }}
      >
        {/* Nav buttons */}
        <div className="flex items-center gap-0.5">
          <button
            className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.04)] text-[#3a4250] hover:text-[#5a6270] transition-all duration-200"
            style={{ boxShadow: "none" }}
            aria-label="Back"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.04)] text-[#3a4250] hover:text-[#5a6270] transition-all duration-200"
            aria-label="Forward"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          {browser.loading ? (
            <div className="p-1.5">
              <div
                className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-[rgba(255,255,255,0.04)] border-t-cyan/70"
                style={{ filter: "drop-shadow(0 0 4px rgba(34,211,238,0.4))" }}
              />
            </div>
          ) : (
            <button
              className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.04)] text-[#3a4250] hover:text-[#5a6270] transition-all duration-200"
              aria-label="Reload"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          )}
        </div>

        {/* URL bar */}
        <div
          className="flex-1 flex items-center gap-2 px-3 py-[5px] rounded-lg transition-all duration-200"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))",
            border: "1px solid rgba(255,255,255,0.05)",
            boxShadow: "inset 0 1px 4px rgba(0,0,0,0.2), inset 0 0 0 0.5px rgba(255,255,255,0.02), 0 1px 0 rgba(255,255,255,0.015)",
          }}
        >
          {browser.url.startsWith("https") && (
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none" className="shrink-0"
              style={{ color: "#28c840", filter: "drop-shadow(0 0 4px rgba(40,200,64,0.4))" }}
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" />
            </svg>
          )}
          <span
            className="text-[11px] text-[#5a6270] truncate"
            style={{ fontFamily: "var(--font-mono)", textShadow: "0 0 6px rgba(90,98,112,0.1)" }}
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
            className="h-[2px] origin-left relative"
            style={{
              background: "linear-gradient(90deg, rgba(34,211,238,0.4) 0%, #22d3ee 20%, #4de8f5 50%, rgba(34,211,238,0.5) 80%, transparent 100%)",
              boxShadow: "0 0 10px rgba(34,211,238,0.4), 0 0 24px rgba(34,211,238,0.15), 0 1px 0 rgba(34,211,238,0.2)",
            }}
          />
        )}
      </AnimatePresence>

      {/* Page content */}
      <div
        className="flex-1 overflow-auto p-5 relative"
        style={{
          background: "radial-gradient(ellipse 120% 60% at 50% 0%, rgba(34,211,238,0.006) 0%, transparent 50%)",
        }}
      >
        {!browser.url && !browser.content && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <svg
              width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-[#1a2030]"
              style={{ filter: "drop-shadow(0 0 12px rgba(26,32,48,0.3))" }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span className="text-[11px] text-[#2a3040]" style={{ fontFamily: "var(--font-mono)" }}>No page loaded</span>
          </div>
        )}

        {browser.loading && !browser.content && (
          <div className="space-y-4">
            {/* Title skeleton */}
            <motion.div
              animate={{ opacity: [0.06, 0.2, 0.06] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              className="h-6 w-3/4 rounded-md"
              style={{
                background: "linear-gradient(90deg, rgba(255,255,255,0.015), rgba(34,211,238,0.04), rgba(255,255,255,0.015))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.01)",
              }}
            />
            {/* Body skeletons */}
            <motion.div
              animate={{ opacity: [0.06, 0.2, 0.06] }}
              transition={{ duration: 2.2, repeat: Infinity, delay: 0.15, ease: "easeInOut" }}
              className="h-3.5 w-full rounded"
              style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.015), rgba(34,211,238,0.03), rgba(255,255,255,0.015))" }}
            />
            <motion.div
              animate={{ opacity: [0.06, 0.2, 0.06] }}
              transition={{ duration: 2.2, repeat: Infinity, delay: 0.3, ease: "easeInOut" }}
              className="h-3.5 w-5/6 rounded"
              style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.015), rgba(34,211,238,0.03), rgba(255,255,255,0.015))" }}
            />
            <motion.div
              animate={{ opacity: [0.06, 0.2, 0.06] }}
              transition={{ duration: 2.2, repeat: Infinity, delay: 0.45, ease: "easeInOut" }}
              className="h-3.5 w-2/3 rounded"
              style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.015), rgba(34,211,238,0.03), rgba(255,255,255,0.015))" }}
            />
          </div>
        )}

        <AnimatePresence mode="wait">
          {browser.content && !browser.loading && (
            <motion.div
              key={browser.url}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              className="text-[12.5px] text-[#8891a5] leading-[1.7] [&_h1]:text-[#d4d8e4] [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mb-3 [&_p]:mb-2.5 [&_strong]:text-[#d4d8e4] [&_a]:text-cyan/80 [&_code]:text-cyan/60 [&_code]:bg-[rgba(34,211,238,0.04)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[11px] [&_code]:border [&_code]:border-[rgba(34,211,238,0.08)]"
              style={{ fontFamily: "var(--font-body)" }}
              dangerouslySetInnerHTML={{ __html: browser.content }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
