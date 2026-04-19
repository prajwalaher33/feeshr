"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useDesktopStore } from "@/lib/stores/desktop-store";

const SEVERITY_GLOW: Record<string, string> = {
  low: "rgba(34,211,238,0.08)",
  medium: "rgba(247,201,72,0.08)",
  high: "rgba(255,107,107,0.1)",
};

const SEVERITY_ACCENT: Record<string, string> = {
  low: "#22d3ee",
  medium: "#f7c948",
  high: "#ff6b6b",
};

export function ConfirmationDialog() {
  const { permissionRequest, dismissPermission } = useDesktopStore();

  return (
    <AnimatePresence>
      {permissionRequest && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="absolute bottom-4 left-4 right-4 z-50"
        >
          <div
            className="rounded-xl p-4 relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(10,14,24,0.97), rgba(6,10,18,0.98), rgba(4,8,14,0.99))",
              backdropFilter: "blur(40px) saturate(1.8)",
              WebkitBackdropFilter: "blur(40px) saturate(1.8)",
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow: `
                0 0 50px ${SEVERITY_GLOW[permissionRequest.severity] ?? SEVERITY_GLOW.medium},
                0 0 100px ${SEVERITY_GLOW[permissionRequest.severity] ?? SEVERITY_GLOW.medium}60,
                0 4px 16px rgba(0,0,0,0.5),
                0 12px 48px rgba(0,0,0,0.4),
                0 24px 80px rgba(0,0,0,0.2),
                inset 0 1px 0 rgba(255,255,255,0.05),
                inset 0 -1px 0 rgba(0,0,0,0.15)
              `,
            }}
          >
            {/* Top edge highlight */}
            <div
              className="absolute top-0 left-0 right-0 h-[1px]"
              style={{
                background: `linear-gradient(90deg, transparent 10%, ${SEVERITY_ACCENT[permissionRequest.severity] ?? SEVERITY_ACCENT.medium}15 30%, ${SEVERITY_ACCENT[permissionRequest.severity] ?? SEVERITY_ACCENT.medium}25 50%, ${SEVERITY_ACCENT[permissionRequest.severity] ?? SEVERITY_ACCENT.medium}15 70%, transparent 90%)`,
              }}
            />

            <div className="flex items-start gap-3 relative">
              {/* Accent bar */}
              <div
                className="w-[2.5px] rounded-full shrink-0 self-stretch"
                style={{
                  background: `linear-gradient(180deg, ${SEVERITY_ACCENT[permissionRequest.severity] ?? SEVERITY_ACCENT.medium}, ${SEVERITY_ACCENT[permissionRequest.severity] ?? SEVERITY_ACCENT.medium}60)`,
                  boxShadow: `0 0 10px ${SEVERITY_ACCENT[permissionRequest.severity] ?? SEVERITY_ACCENT.medium}60, 0 0 20px ${SEVERITY_ACCENT[permissionRequest.severity] ?? SEVERITY_ACCENT.medium}20`,
                }}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <svg
                    width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke={SEVERITY_ACCENT[permissionRequest.severity] ?? SEVERITY_ACCENT.medium}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ filter: `drop-shadow(0 0 4px ${SEVERITY_ACCENT[permissionRequest.severity] ?? SEVERITY_ACCENT.medium}50)` }}
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span
                    className="text-[11px] text-[#c8d0e0] font-semibold"
                    style={{
                      fontFamily: "var(--font-display)",
                      textShadow: "0 0 8px rgba(200,208,224,0.1)",
                    }}
                  >
                    Permission Check
                  </span>
                  <span
                    className="text-[8px] uppercase tracking-[1px] font-bold px-2 py-0.5 rounded-md"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: SEVERITY_ACCENT[permissionRequest.severity] ?? SEVERITY_ACCENT.medium,
                      background: `linear-gradient(135deg, ${SEVERITY_GLOW[permissionRequest.severity] ?? SEVERITY_GLOW.medium}, ${SEVERITY_GLOW[permissionRequest.severity] ?? SEVERITY_GLOW.medium}80)`,
                      border: `1px solid ${SEVERITY_ACCENT[permissionRequest.severity] ?? SEVERITY_ACCENT.medium}20`,
                      boxShadow: `0 0 8px ${SEVERITY_ACCENT[permissionRequest.severity] ?? SEVERITY_ACCENT.medium}15, inset 0 1px 0 rgba(255,255,255,0.03)`,
                      textShadow: `0 0 6px ${SEVERITY_ACCENT[permissionRequest.severity] ?? SEVERITY_ACCENT.medium}40`,
                    }}
                  >
                    {permissionRequest.severity}
                  </span>
                </div>

                <p
                  className="text-[11px] text-[#7a8394] mb-2.5 leading-relaxed"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {permissionRequest.description}
                </p>

                <div className="flex items-center gap-2 text-[9px]" style={{ fontFamily: "var(--font-mono)" }}>
                  <span
                    className="px-2 py-0.5 rounded"
                    style={{
                      color: "#6b7280",
                      background: "rgba(255,255,255,0.025)",
                      border: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    {permissionRequest.action}
                  </span>
                  <span className="text-[#2a3040]">/</span>
                  <span
                    className="px-2 py-0.5 rounded"
                    style={{
                      color: "#6b7280",
                      background: "rgba(255,255,255,0.025)",
                      border: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    {permissionRequest.resource}
                  </span>
                </div>
              </div>

              <button
                onClick={dismissPermission}
                className="shrink-0 p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] text-[#3a4250] hover:text-[#6b7280] transition-all duration-200"
                style={{
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
                }}
                aria-label="Dismiss"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
