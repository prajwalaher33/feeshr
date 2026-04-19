"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useDesktopStore } from "@/lib/stores/desktop-store";

const SEVERITY_GLOW: Record<string, string> = {
  low: "rgba(34,211,238,0.06)",
  medium: "rgba(247,201,72,0.06)",
  high: "rgba(255,107,107,0.08)",
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
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.99 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="absolute bottom-4 left-4 right-4 z-50"
        >
          <div
            className="rounded-xl p-4"
            style={{
              background: `linear-gradient(135deg, rgba(10,14,24,0.97), rgba(6,10,18,0.98), rgba(4,8,14,0.99))`,
              backdropFilter: "blur(32px) saturate(1.6)",
              WebkitBackdropFilter: "blur(32px) saturate(1.6)",
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: `0 0 40px ${SEVERITY_GLOW[permissionRequest.severity] ?? SEVERITY_GLOW.medium}, 0 0 80px ${SEVERITY_GLOW[permissionRequest.severity] ?? SEVERITY_GLOW.medium}80, 0 4px 12px rgba(0,0,0,0.5), 0 12px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)`,
            }}
          >
            <div className="flex items-start gap-3">
              {/* Accent bar */}
              <div
                className="w-[2px] rounded-full shrink-0 self-stretch"
                style={{
                  backgroundColor: SEVERITY_ACCENT[permissionRequest.severity] ?? SEVERITY_ACCENT.medium,
                  boxShadow: `0 0 8px ${SEVERITY_ACCENT[permissionRequest.severity] ?? SEVERITY_ACCENT.medium}50`,
                  opacity: 0.8,
                }}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={SEVERITY_ACCENT[permissionRequest.severity] ?? SEVERITY_ACCENT.medium} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span className="text-[11px] text-[#c8d0e0] font-medium" style={{ fontFamily: "var(--font-display)" }}>
                    Permission Check
                  </span>
                  <span
                    className="text-[8px] uppercase tracking-[1px] font-medium px-1.5 py-0.5 rounded"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: SEVERITY_ACCENT[permissionRequest.severity] ?? SEVERITY_ACCENT.medium,
                      backgroundColor: SEVERITY_GLOW[permissionRequest.severity] ?? SEVERITY_GLOW.medium,
                      opacity: 0.8,
                    }}
                  >
                    {permissionRequest.severity}
                  </span>
                </div>

                <p className="text-[11px] text-[#6b7280] mb-2 leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
                  {permissionRequest.description}
                </p>

                <div className="flex items-center gap-3 text-[9px] text-[#3a4250]" style={{ fontFamily: "var(--font-mono)" }}>
                  <span>{permissionRequest.action}</span>
                  <span className="text-[#2a3040]">/</span>
                  <span>{permissionRequest.resource}</span>
                </div>
              </div>

              <button
                onClick={dismissPermission}
                className="shrink-0 p-1 rounded-md hover:bg-[rgba(255,255,255,0.04)] text-[#3a4250] hover:text-[#5a6270] transition-colors"
                aria-label="Dismiss"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
