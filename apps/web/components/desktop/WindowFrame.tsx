"use client";

import { useState, useRef, useCallback } from "react";

interface WindowFrameProps {
  title: string;
  icon: React.ReactNode;
  active?: boolean;
  children: React.ReactNode;
  /** If true, the window starts minimized. */
  defaultMinimized?: boolean;
  className?: string;
}

/**
 * Reusable window chrome for the desktop view.
 * Provides a macOS-style title bar with minimize/maximize controls
 * and a resizable content area.
 */
export function WindowFrame({
  title,
  icon,
  active = true,
  children,
  defaultMinimized = false,
  className = "",
}: WindowFrameProps) {
  const [minimized, setMinimized] = useState(defaultMinimized);
  const [height, setHeight] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      dragRef.current = { startY: e.clientY, startH: height ?? rect.height };

      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const newH = Math.max(120, dragRef.current.startH + (ev.clientY - dragRef.current.startY));
        setHeight(newH);
      };
      const onUp = () => {
        dragRef.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [height],
  );

  return (
    <div
      ref={containerRef}
      className={`flex flex-col rounded-xl border overflow-hidden transition-all duration-200 ${
        active
          ? "border-border-hover shadow-[0_0_20px_rgba(34,211,238,0.08)]"
          : "border-border-subtle opacity-70"
      } ${className}`}
      style={height && !minimized ? { height } : undefined}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-surface border-b border-border-subtle shrink-0 select-none">
        {/* Traffic lights */}
        <div className="flex items-center gap-1.5 mr-2">
          <button
            className="w-3 h-3 rounded-full bg-coral/80 hover:bg-coral transition-colors"
            aria-label="Close"
          />
          <button
            onClick={() => setMinimized(!minimized)}
            className="w-3 h-3 rounded-full bg-amber/80 hover:bg-amber transition-colors"
            aria-label={minimized ? "Expand" : "Minimize"}
          />
          <button
            onClick={() => setHeight(null)}
            className="w-3 h-3 rounded-full bg-mint/80 hover:bg-mint transition-colors"
            aria-label="Reset size"
          />
        </div>

        <span className="text-secondary">{icon}</span>
        <span
          className="text-xs font-medium text-secondary truncate"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {title}
        </span>

        {active && (
          <span className="ml-auto relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-mint opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
          </span>
        )}
      </div>

      {/* Content */}
      {!minimized && (
        <div className="flex-1 overflow-auto bg-bg min-h-0">{children}</div>
      )}

      {/* Resize handle */}
      {!minimized && (
        <div
          onMouseDown={onResizeStart}
          className="h-1.5 cursor-ns-resize bg-surface hover:bg-border-hover transition-colors shrink-0"
        />
      )}
    </div>
  );
}
