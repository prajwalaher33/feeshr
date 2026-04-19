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
    <div className="flex flex-col h-full relative">
      {/* Subtle CRT scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-[1] rounded-xl"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.015) 2px, rgba(0,0,0,0.015) 4px)",
          mixBlendMode: "multiply",
        }}
      />

      {/* Terminal header */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 shrink-0 relative z-[2]"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.018) 0%, rgba(255,255,255,0.006) 60%, rgba(255,255,255,0.002) 100%)",
          boxShadow: "0 1px 0 rgba(0,0,0,0.2), 0 2px 6px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.025)",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#3a4250]" style={{ filter: "drop-shadow(0 0 3px rgba(58,66,80,0.3))" }}>
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
        <span
          className="text-[10px] text-[#4a5568]"
          style={{ fontFamily: "var(--font-mono)", textShadow: "0 0 8px rgba(74,85,104,0.2)" }}
        >
          {terminal.cwd}
        </span>
        {terminal.running && (
          <motion.div
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            className="ml-auto flex items-center gap-2"
          >
            <div
              className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-[rgba(255,255,255,0.04)] border-t-cyan/70"
              style={{ filter: "drop-shadow(0 0 4px rgba(34,211,238,0.4))" }}
            />
            <span
              className="text-[9px] text-cyan/50 uppercase tracking-[1.5px] font-medium"
              style={{ fontFamily: "var(--font-mono)", textShadow: "0 0 10px rgba(34,211,238,0.3)" }}
            >
              running
            </span>
          </motion.div>
        )}
      </div>

      {/* Terminal body */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-4 pb-6 relative z-[2]"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "12.5px",
          lineHeight: "1.85",
          background: "radial-gradient(ellipse 120% 80% at 50% 0%, rgba(34,211,238,0.008) 0%, transparent 60%)",
        }}
      >
        {terminal.lines.length === 0 && (
          <div className="flex items-center gap-2 text-[#2a3040]">
            <span className="text-[#28c840] font-bold" style={{ textShadow: "0 0 10px rgba(40,200,64,0.5), 0 0 20px rgba(40,200,64,0.2)" }}>$</span>
            <span
              className="inline-block w-[7px] h-[15px] animate-terminal-blink"
              style={{
                background: "linear-gradient(180deg, #d4d8e4, #a8b0c0)",
                boxShadow: "0 0 8px rgba(212,216,228,0.5), 0 0 16px rgba(212,216,228,0.15), 0 0 2px rgba(212,216,228,0.8)",
                borderRadius: "1px",
              }}
            />
          </div>
        )}

        {terminal.lines.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.14, delay: 0.02 }}
            className="whitespace-pre-wrap break-all"
          >
            {line.type === "command" ? (
              <div className="flex items-start gap-2 mt-3 first:mt-0">
                <span
                  className="text-[#28c840] shrink-0 font-bold"
                  style={{ textShadow: "0 0 10px rgba(40,200,64,0.5), 0 0 20px rgba(40,200,64,0.2)" }}
                >
                  $
                </span>
                <span
                  className="text-[#d4d8e4] font-medium"
                  style={{ textShadow: "0 0 6px rgba(212,216,228,0.08)" }}
                >
                  {line.text}
                </span>
              </div>
            ) : line.type === "error" ? (
              <span
                className="text-[#ff6b6b]/90"
                style={{ textShadow: "0 0 8px rgba(255,107,107,0.2)" }}
              >
                {line.text}
              </span>
            ) : line.type === "system" ? (
              <span
                className="text-[#f7c948]/80"
                style={{ textShadow: "0 0 8px rgba(247,201,72,0.2)" }}
              >
                {line.text}
              </span>
            ) : (
              <span className="text-[#5a6270]">{line.text}</span>
            )}
          </motion.div>
        ))}

        {/* Blinking cursor */}
        {terminal.running && (
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className="text-[#28c840] font-bold"
              style={{ textShadow: "0 0 10px rgba(40,200,64,0.5), 0 0 20px rgba(40,200,64,0.2)" }}
            >
              $
            </span>
            <span
              className="inline-block w-[7px] h-[15px] animate-terminal-blink"
              style={{
                background: "linear-gradient(180deg, #d4d8e4, #a8b0c0)",
                boxShadow: "0 0 8px rgba(212,216,228,0.5), 0 0 16px rgba(212,216,228,0.15), 0 0 2px rgba(212,216,228,0.8)",
                borderRadius: "1px",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
