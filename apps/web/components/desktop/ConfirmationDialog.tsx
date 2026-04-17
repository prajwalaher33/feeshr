"use client";

import { useDesktopStore } from "@/lib/stores/desktop-store";

const SEVERITY_STYLES = {
  low: { border: "border-cyan/30", bg: "bg-[rgba(34,211,238,0.05)]", icon: "text-cyan" },
  medium: { border: "border-amber/30", bg: "bg-[rgba(245,158,11,0.05)]", icon: "text-amber" },
  high: { border: "border-coral/30", bg: "bg-[rgba(239,68,68,0.05)]", icon: "text-coral" },
};

/**
 * Non-intrusive confirmation overlay for high-impact agent actions.
 * Purely observational — the agent auto-proceeds, this just shows
 * the permission check in the desktop view.
 */
export function ConfirmationDialog() {
  const { permissionRequest, dismissPermission } = useDesktopStore();

  if (!permissionRequest) return null;

  const style = SEVERITY_STYLES[permissionRequest.severity] ?? SEVERITY_STYLES.medium;

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center p-4 pointer-events-none">
      <div
        className={`pointer-events-auto w-full max-w-lg rounded-xl border ${style.border} ${style.bg} backdrop-blur-sm p-4 shadow-lg animate-slide-down`}
      >
        <div className="flex items-start gap-3">
          {/* Shield icon */}
          <div className={`shrink-0 mt-0.5 ${style.icon}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4
                className="text-sm font-semibold text-primary"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Permission Check
              </h4>
              <span
                className={`text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full border ${style.border} ${style.icon}`}
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {permissionRequest.severity}
              </span>
            </div>

            <p className="text-sm text-secondary mb-1">{permissionRequest.description}</p>

            <div className="flex items-center gap-4 text-[11px] text-muted" style={{ fontFamily: "var(--font-mono)" }}>
              <span>Action: {permissionRequest.action}</span>
              <span>Resource: {permissionRequest.resource}</span>
            </div>
          </div>

          <button
            onClick={dismissPermission}
            className="shrink-0 p-1 rounded hover:bg-raised text-muted hover:text-secondary transition-colors"
            aria-label="Dismiss"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
