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
      <div className="flex items-center gap-3 px-4 py-2.5 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: "linear-gradient(180deg, rgba(255,255,255,0.012), rgba(255,255,255,0.004))", boxShadow: "0 1px 0 rgba(0,0,0,0.15)" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#3a4250]">
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
        <span className="text-[10px] text-[#3a4250]" style={{ fontFamily: "var(--font-mono)" }}>
          {terminal.cwd}
        </span>
        {terminal.running && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="ml-auto text-[9px] text-cyan/40 uppercase tracking-[1.5px]"
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
        style={{ fontFamily: "var(--font-mono)", fontSize: "12.5px", lineHeight: "1.85" }}
      >
        {terminal.lines.length === 0 && (
          <div className="flex items-center gap-2 text-[#2a3040]">
            <span className="text-[#28c840]" style={{ textShadow: "0 0 8px rgba(40,200,64,0.4)" }}>$</span>
            <span className="animate-pulse">_</span>
          </div>
        )}

        {terminal.lines.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -3 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.12, delay: 0.015 }}
            className="whitespace-pre-wrap break-all"
          >
            {line.type === "command" ? (
              <div className="flex items-start gap-2 mt-2.5 first:mt-0">
                <span className="text-[#28c840] shrink-0" style={{ textShadow: "0 0 8px rgba(40,200,64,0.4)" }}>$</span>
                <span className="text-[#d4d8e4]">{line.text}</span>
              </div>
            ) : line.type === "error" ? (
              <span className="text-[#ff6b6b]/90">{line.text}</span>
            ) : line.type === "system" ? (
              <span className="text-[#f7c948]/80">{line.text}</span>
            ) : (
              <span className="text-[#5a6270]">{line.text}</span>
            )}
          </motion.div>
        ))}

        {/* Blinking cursor */}
        {terminal.running && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[#28c840]" style={{ textShadow: "0 0 8px rgba(40,200,64,0.4)" }}>$</span>
            <span className="inline-block w-[6px] h-[14px] animate-terminal-blink" style={{ background: "#d4d8e4", boxShadow: "0 0 6px rgba(212,216,228,0.4), 0 0 14px rgba(212,216,228,0.15)" }} />
          </div>
        )}
      </div>
    </div>
  );
}
