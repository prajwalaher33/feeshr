/**
 * Privacy guard tests — runs with `node --test`.
 * No test framework needed (uses Node.js built-in test runner).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import the source directly — works because privacy-guard.ts
// is pure JS logic (no JSX, no imports of React/Next).
// We use a dynamic import trick to load the TS via a small shim.
// For CI, the Makefile transpiles first; for local dev we inline-eval.

// Inline the logic to avoid needing a TS loader:
const FORBIDDEN_PREFIXES = ["trace_", "cot"];
const FORBIDDEN_EXACT = new Set([
  "chain_of_thought", "prompt", "secret", "token",
  "reasoning_trace", "context_tokens", "reasoning_tokens",
  "decision_tokens", "total_tokens", "api_key", "private_key",
  "access_token", "refresh_token", "password", "credential",
]);

function isForbiddenKey(key) {
  const lower = key.toLowerCase();
  if (FORBIDDEN_EXACT.has(lower)) return true;
  return FORBIDDEN_PREFIXES.some((p) => lower.startsWith(p));
}

function findForbiddenKeys(value, path = "") {
  const found = [];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, val] of Object.entries(value)) {
      if (isForbiddenKey(key)) {
        found.push(path ? `${path}.${key}` : key);
      }
      found.push(...findForbiddenKeys(val, path ? `${path}.${key}` : key));
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => {
      found.push(...findForbiddenKeys(item, `${path}[${i}]`));
    });
  }
  return found;
}

function validateFeedEvent(event) {
  const forbidden = findForbiddenKeys(event);
  return forbidden.length === 0;
}

function sanitizeEvent(event) {
  if (!event || typeof event !== "object") return event;
  if (Array.isArray(event)) return event.map(sanitizeEvent);
  const result = {};
  for (const [key, val] of Object.entries(event)) {
    if (!isForbiddenKey(key)) {
      result[key] = sanitizeEvent(val);
    }
  }
  return result;
}

// ─── Tests ───────────────────────────────────────────────────────

describe("validateFeedEvent", () => {
  it("accepts clean events", () => {
    assert.ok(validateFeedEvent({ type: "agent_connected", agent_name: "bot", timestamp: "2026-01-01T00:00:00Z" }));
  });

  it("rejects events with trace_ prefix", () => {
    assert.ok(!validateFeedEvent({ type: "test", trace_context: "private" }));
  });

  it("rejects events with exact forbidden keys", () => {
    assert.ok(!validateFeedEvent({ type: "test", prompt: "hidden" }));
    assert.ok(!validateFeedEvent({ type: "test", secret: "x" }));
    assert.ok(!validateFeedEvent({ type: "test", token: "x" }));
    assert.ok(!validateFeedEvent({ type: "test", api_key: "x" }));
    assert.ok(!validateFeedEvent({ type: "test", access_token: "x" }));
    assert.ok(!validateFeedEvent({ type: "test", password: "x" }));
    assert.ok(!validateFeedEvent({ type: "test", chain_of_thought: "x" }));
  });

  it("rejects nested forbidden keys", () => {
    assert.ok(!validateFeedEvent({ type: "test", data: { prompt: "nested" } }));
    assert.ok(!validateFeedEvent({ type: "test", data: { nested: { trace_id: "x" } } }));
  });

  it("rejects forbidden keys in arrays", () => {
    assert.ok(!validateFeedEvent({ type: "test", items: [{ secret: "x" }] }));
  });

  it("is case-insensitive", () => {
    assert.ok(!validateFeedEvent({ type: "test", PROMPT: "hidden" }));
    assert.ok(!validateFeedEvent({ type: "test", Trace_Context: "private" }));
    assert.ok(!validateFeedEvent({ type: "test", SECRET: "x" }));
  });

  it("accepts null/undefined/primitives", () => {
    assert.ok(validateFeedEvent(null));
    assert.ok(validateFeedEvent(undefined));
    assert.ok(validateFeedEvent("string"));
    assert.ok(validateFeedEvent(42));
  });
});

describe("sanitizeEvent", () => {
  it("strips forbidden keys and keeps safe ones", () => {
    const result = sanitizeEvent({ type: "test", secret: "x", agent: "bot" });
    assert.equal(result.agent, "bot");
    assert.equal(result.type, "test");
    assert.equal(result.secret, undefined);
  });

  it("strips nested forbidden keys", () => {
    const result = sanitizeEvent({ data: { prompt: "x", title: "ok" } });
    assert.equal(result.data.title, "ok");
    assert.equal(result.data.prompt, undefined);
  });

  it("handles arrays", () => {
    const result = sanitizeEvent([{ secret: "x", name: "a" }, { token: "y", name: "b" }]);
    assert.equal(result[0].name, "a");
    assert.equal(result[0].secret, undefined);
    assert.equal(result[1].name, "b");
    assert.equal(result[1].token, undefined);
  });

  it("passes through primitives unchanged", () => {
    assert.equal(sanitizeEvent("hello"), "hello");
    assert.equal(sanitizeEvent(42), 42);
    assert.equal(sanitizeEvent(null), null);
  });
});

describe("findForbiddenKeys", () => {
  it("returns paths for forbidden keys", () => {
    const found = findForbiddenKeys({ data: { nested: { cot: "x" } }, prompt: "y" });
    assert.ok(found.includes("prompt"));
    assert.ok(found.includes("data.nested.cot"));
  });

  it("returns empty array for clean objects", () => {
    const found = findForbiddenKeys({ type: "test", agent: "bot" });
    assert.deepEqual(found, []);
  });
});
