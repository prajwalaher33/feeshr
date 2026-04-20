/**
 * SceneConductor tests — runs with `node --test`.
 * Validates cinema-tier animation serialization and priority preemption.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ─── Inline implementation (can't import TS directly) ───────────────────────

const PRIORITY_RANK = { low: 0, medium: 1, high: 2 };

let activeEntry = null;
let activeTimeout = null;
const queue = [];

function processQueue() {
  if (activeEntry) return;
  if (queue.length === 0) return;
  queue.sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);
  const next = queue.shift();
  activeEntry = next;
  next.onStart();
  activeTimeout = setTimeout(() => {
    next.onEnd();
    activeEntry = null;
    activeTimeout = null;
    processQueue();
  }, next.duration);
}

function scheduleCinema(entry) {
  if (activeEntry && PRIORITY_RANK[entry.priority] > PRIORITY_RANK[activeEntry.priority]) {
    if (activeTimeout) clearTimeout(activeTimeout);
    activeEntry.onEnd();
    activeEntry = null;
    activeTimeout = null;
    queue.unshift(entry);
    processQueue();
  } else if (activeEntry) {
    queue.push(entry);
  } else {
    queue.push(entry);
    processQueue();
  }
  return () => {
    if (activeEntry?.id === entry.id) {
      if (activeTimeout) clearTimeout(activeTimeout);
      activeEntry.onEnd();
      activeEntry = null;
      activeTimeout = null;
      processQueue();
    } else {
      const idx = queue.findIndex(e => e.id === entry.id);
      if (idx !== -1) queue.splice(idx, 1);
    }
  };
}

function clearCinema() {
  if (activeTimeout) clearTimeout(activeTimeout);
  if (activeEntry) activeEntry.onEnd();
  activeEntry = null;
  activeTimeout = null;
  queue.length = 0;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("SceneConductor", () => {
  beforeEach(() => clearCinema());

  it("runs a single cinema entry", async () => {
    const log = [];
    scheduleCinema({
      id: "a",
      priority: "low",
      duration: 50,
      onStart: () => log.push("a-start"),
      onEnd: () => log.push("a-end"),
    });

    assert.deepEqual(log, ["a-start"]);
    await new Promise(r => setTimeout(r, 80));
    assert.deepEqual(log, ["a-start", "a-end"]);
  });

  it("queues entries and processes sequentially", async () => {
    const log = [];
    scheduleCinema({ id: "a", priority: "low", duration: 50, onStart: () => log.push("a-start"), onEnd: () => log.push("a-end") });
    scheduleCinema({ id: "b", priority: "low", duration: 50, onStart: () => log.push("b-start"), onEnd: () => log.push("b-end") });

    assert.deepEqual(log, ["a-start"]);
    await new Promise(r => setTimeout(r, 80));
    assert.ok(log.includes("a-end"));
    assert.ok(log.includes("b-start"));
    await new Promise(r => setTimeout(r, 80));
    assert.deepEqual(log, ["a-start", "a-end", "b-start", "b-end"]);
  });

  it("preempts lower priority with higher priority", async () => {
    const log = [];
    scheduleCinema({ id: "low", priority: "low", duration: 200, onStart: () => log.push("low-start"), onEnd: () => log.push("low-end") });

    // Fire high priority while low is playing
    scheduleCinema({ id: "high", priority: "high", duration: 50, onStart: () => log.push("high-start"), onEnd: () => log.push("high-end") });

    // Low should have been preempted
    assert.ok(log.includes("low-start"));
    assert.ok(log.includes("low-end"), "Low should be ended via preemption");
    assert.ok(log.includes("high-start"), "High should start immediately");

    await new Promise(r => setTimeout(r, 80));
    assert.ok(log.includes("high-end"));
  });

  it("cancel function removes entry from queue", async () => {
    const log = [];
    scheduleCinema({ id: "a", priority: "low", duration: 50, onStart: () => log.push("a-start"), onEnd: () => log.push("a-end") });
    const cancel = scheduleCinema({ id: "b", priority: "low", duration: 50, onStart: () => log.push("b-start"), onEnd: () => log.push("b-end") });

    // Cancel b before it starts
    cancel();

    await new Promise(r => setTimeout(r, 80));
    // Only a should have played
    assert.deepEqual(log, ["a-start", "a-end"]);
  });

  it("never plays two cinema animations simultaneously", async () => {
    const active = new Set();
    const violations = [];

    for (let i = 0; i < 5; i++) {
      scheduleCinema({
        id: `entry-${i}`,
        priority: ["low", "medium", "high"][i % 3],
        duration: 30,
        onStart: () => {
          if (active.size > 0) violations.push(`Concurrent at entry-${i}`);
          active.add(i);
        },
        onEnd: () => active.delete(i),
      });
    }

    await new Promise(r => setTimeout(r, 300));
    assert.equal(violations.length, 0, `Violations: ${violations.join(", ")}`);
  });
});
