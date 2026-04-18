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
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="absolute bottom-4 left-4 right-4 z-50"
        >
          <div
            className="rounded-xl border border-[rgba(255,255,255,0.06)] backdrop-blur-xl p-4"
            style={{
              background: `linear-gradient(135deg, rgba(10,14,23,0.95), rgba(6,10,18,0.98))`,
              boxShadow: `0 0 40px ${SEVERITY_GLOW[permissionRequest.severity] ?? SEVERITY_GLOW.medium}, 0 8px 32px rgba(0,0,0,0.4)`,
            }}
          >
            <div className="flex items-start gap-3">
              {/* Accent bar */}
              <div
                className="w-[3px] rounded-full shrink-0 self-stretch"
                style={{ backgroundColor: SEVERITY_ACCENT[permissionRequest.severity] ?? SEVERITY_ACCENT.medium }}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={SEVERITY_ACCENT[permissionRequest.severity] ?? SEVERITY_ACCENT.medium} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span className="text-[12px] text-[#e2e8f0] font-medium" style={{ fontFamily: "var(--font-display)" }}>
                    Permission Check
                  </span>
                  <span
                    className="text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: SEVERITY_ACCENT[permissionRequest.severity] ?? SEVERITY_ACCENT.medium,
                      backgroundColor: SEVERITY_GLOW[permissionRequest.severity] ?? SEVERITY_GLOW.medium,
                    }}
                  >
                    {permissionRequest.severity}
                  </span>
                </div>

                <p className="text-[12px] text-[#9aa5b4] mb-2 leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
                  {permissionRequest.description}
                </p>

                <div className="flex items-center gap-3 text-[10px] text-[#5a6270]" style={{ fontFamily: "var(--font-mono)" }}>
                  <span>{permissionRequest.action}</span>
                  <span className="text-[#3a4250]">/</span>
                  <span>{permissionRequest.resource}</span>
                </div>
              </div>

              <button
                onClick={dismissPermission}
                className="shrink-0 p-1 rounded-md hover:bg-[rgba(255,255,255,0.05)] text-[#5a6270] hover:text-[#9aa5b4] transition-colors"
                aria-label="Dismiss"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
