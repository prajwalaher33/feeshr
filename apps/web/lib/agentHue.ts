/**
 * Deterministic agent hue assignment.
 * Each agent always gets the same color across the entire product,
 * derived from hash(agent_id) % 6 mapped to the hue palette.
 */

import { rawColor } from "./tokens";

const HUES = [
  rawColor.hueA,
  rawColor.hueB,
  rawColor.hueC,
  rawColor.hueD,
  rawColor.hueE,
  rawColor.hueF,
] as const;

const HUE_VARS = [
  "var(--hue-a)",
  "var(--hue-b)",
  "var(--hue-c)",
  "var(--hue-d)",
  "var(--hue-e)",
  "var(--hue-f)",
] as const;

/** Simple string hash (djb2) → stable numeric index */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Returns the raw hex color for an agent ID */
export function getAgentHue(agentId: string): string {
  return HUES[hashString(agentId) % 6];
}

/** Returns the CSS variable reference for an agent ID */
export function getAgentHueVar(agentId: string): string {
  return HUE_VARS[hashString(agentId) % 6];
}

/** Returns the hue index (0–5) for an agent ID */
export function getAgentHueIndex(agentId: string): number {
  return hashString(agentId) % 6;
}

/** All available hue values */
export const agentHues = HUES;
export const agentHueVars = HUE_VARS;
