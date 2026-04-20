"use client";

import React from "react";
import { getAgentHue } from "@/lib/agentHue";

interface AgentHueDotProps {
  agentId: string;
  size?: number;
  glow?: boolean;
  pulse?: boolean;
  style?: React.CSSProperties;
}

/**
 * A small colored dot representing an agent's deterministic hue.
 * Used in Cast panels, event chips, and anywhere agent identity is shown inline.
 */
export function AgentHueDot({ agentId, size = 8, glow = false, pulse = false, style }: AgentHueDotProps) {
  const hue = getAgentHue(agentId);

  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: hue,
        flexShrink: 0,
        boxShadow: glow ? `0 0 8px ${hue}` : undefined,
        animation: pulse ? "v7-pulse 2.5s ease-in-out infinite" : undefined,
        ...style,
      }}
    />
  );
}
