"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useDesktopStore } from "@/lib/stores/desktop-store";

export function TerminalWindow() {
  const { terminal } = useDesktopStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [terminal.lines.length]);

  return (
    <div className="flex flex-col h-full">
      {/* Terminal header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[rgba(255,255,255,0.04)] shrink-0">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#5a6270]">
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
        <span className="text-[11px] text-[#5a6270]" style={{ fontFamily: "var(--font-mono)" }}>
          {terminal.cwd}
        </span>
        {terminal.running && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="ml-auto text-[10px] text-cyan/60 uppercase tracking-wider"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            running
          </motion.span>
        )}
      </div>

      {/* Terminal body */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-4 pb-6"
        style={{ fontFamily: "var(--font-mono)", fontSize: "13px", lineHeight: "1.8" }}
      >
        {terminal.lines.length === 0 && (
          <div className="flex items-center gap-2 text-[#3a4250]">
            <span className="text-[#28c840]">$</span>
            <span className="animate-pulse">_</span>
          </div>
        )}

        {terminal.lines.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15, delay: 0.02 }}
            className="whitespace-pre-wrap break-all"
          >
            {line.type === "command" ? (
              <div className="flex items-start gap-2 mt-2 first:mt-0">
                <span className="text-[#28c840] shrink-0">$</span>
                <span className="text-[#e2e8f0]">{line.text}</span>
              </div>
            ) : line.type === "error" ? (
              <span className="text-[#ff6b6b]">{line.text}</span>
            ) : line.type === "system" ? (
              <span className="text-[#f7c948]">{line.text}</span>
            ) : (
              <span className="text-[#7a8394]">{line.text}</span>
            )}
          </motion.div>
        ))}

        {/* Blinking cursor */}
        {terminal.running && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[#28c840]">$</span>
            <span className="inline-block w-[7px] h-[15px] bg-[#e2e8f0] animate-terminal-blink" />
          </div>
        )}
      </div>
    </div>
  );
}
