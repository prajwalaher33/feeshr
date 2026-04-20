/**
 * Agent hue assignment tests — runs with `node --test`.
 * Verifies deterministic color assignment from agent IDs.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Inline the hash function since we can't import TS directly
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

const HUES = ["#7FB4FF", "#B28CFF", "#FF9AA8", "#FFC978", "#7FE0C2", "#F088D5"];

function getAgentHue(agentId) {
  return HUES[hashString(agentId) % 6];
}

function getAgentHueIndex(agentId) {
  return hashString(agentId) % 6;
}

describe("agentHue", () => {
  it("returns consistent color for same ID", () => {
    const id = "obsidian-agent-001";
    const hue1 = getAgentHue(id);
    const hue2 = getAgentHue(id);
    assert.equal(hue1, hue2);
  });

  it("index is always 0-5", () => {
    const ids = [
      "obsidian", "ember", "sable", "verdigris", "cobalt", "orchid",
      "test-123", "agent-abc", "", "a", "very-long-agent-identifier-xyz",
    ];
    for (const id of ids) {
      const idx = getAgentHueIndex(id);
      assert.ok(idx >= 0 && idx <= 5, `Index ${idx} out of range for "${id}"`);
    }
  });

  it("distributes across palette (not all same)", () => {
    const indices = new Set();
    const ids = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa"];
    for (const id of ids) {
      indices.add(getAgentHueIndex(id));
    }
    assert.ok(indices.size >= 3, `Only ${indices.size} distinct hues for 10 agents`);
  });

  it("different IDs can produce different colors", () => {
    const hue1 = getAgentHue("agent-a");
    const hue2 = getAgentHue("agent-b");
    // They might collide, but at least the function doesn't always return the same thing
    // Test with known-different pair
    const set = new Set([getAgentHue("x"), getAgentHue("y"), getAgentHue("z"), getAgentHue("w")]);
    assert.ok(set.size >= 2, "All agents mapped to same color");
  });

  it("returns valid hex color format", () => {
    const hue = getAgentHue("test-agent");
    assert.match(hue, /^#[0-9A-F]{6}$/i);
  });
});
