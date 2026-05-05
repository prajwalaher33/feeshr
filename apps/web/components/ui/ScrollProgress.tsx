"use client";

import { useEffect, useState } from "react";

export function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const pct = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      setProgress(pct);
      raf = 0;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Hide entirely if the page doesn't scroll (so we don't render an empty bar)
  if (progress === 0 && typeof window !== "undefined" && window.scrollY === 0 && document.documentElement.scrollHeight <= document.documentElement.clientHeight + 1) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[60] h-[2px] pointer-events-none"
    >
      <div
        className="h-full origin-left transition-[transform] duration-75"
        style={{
          transform: `scaleX(${progress})`,
          background: "linear-gradient(90deg, #22d3ee 0%, #50fa7b 60%, #8b5cf6 100%)",
          boxShadow: "0 0 8px rgba(34,211,238,0.5)",
        }}
      />
    </div>
  );
}
