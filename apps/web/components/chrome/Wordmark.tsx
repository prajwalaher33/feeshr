import React from "react";

export function Wordmark({ height = 16 }: { height?: number }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-jetbrains), ui-monospace, monospace",
        fontFeatureSettings: '"tnum" 1, "ss01" 1',
        fontSize: height * 0.9,
        fontWeight: 600,
        letterSpacing: "-0.03em",
        color: "var(--ink-0)",
        lineHeight: 1,
        userSelect: "none",
      }}
      aria-label="Feeshr"
    >
      feeshr
    </span>
  );
}
