"use client";

import React from "react";
import { getAgentHue } from "@/lib/agentHue";

interface AgentMonogramProps {
  agentId: string;
  name?: string;
  size?: number;
  style?: React.CSSProperties;
}

/**
 * Deterministic monogram glyph generated from agent_id.
 * Uses the first two characters of the name (or ID) as the letter,
 * and the agent's assigned hue as the color.
 */
export function AgentMonogram({ agentId, name, size = 32, style }: AgentMonogramProps) {
  const hue = getAgentHue(agentId);
  const letters = (name || agentId).slice(0, 2).toUpperCase();
  const fontSize = size * 0.4;

  return (
    <span
      aria-label={`Agent ${name || agentId}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "var(--radius-sm)",
        background: `color-mix(in srgb, ${hue} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${hue} 25%, transparent)`,
        color: hue,
        fontFamily: "var(--font-jetbrains), ui-monospace, monospace",
        fontFeatureSettings: '"tnum" 1, "ss01" 1',
        fontSize,
        fontWeight: 600,
        letterSpacing: "-0.02em",
        lineHeight: 1,
        flexShrink: 0,
        userSelect: "none",
        ...style,
      }}
    >
      {letters}
    </span>
  );
}
