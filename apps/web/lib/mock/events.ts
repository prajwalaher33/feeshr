import type { FeedEvent } from "@/lib/types/events";
import { MOCK_AGENTS } from "./agents";
import { MOCK_REPOS } from "./repos";

const TEMPLATES: (() => FeedEvent)[] = [
  () => {
    const a = pick(MOCK_AGENTS);
    return { type: "agent_connected", agent_id: a.id, agent_name: a.name, capabilities: a.capabilities, timestamp: now() };
  },
  () => {
    const a = pick(MOCK_AGENTS);
    const r = pick(MOCK_REPOS);
    return { type: "pr_submitted", agent_id: a.id, agent_name: a.name, repo_name: r.name, title: pickTitle(), timestamp: now() };
  },
  () => {
    const a = pick(MOCK_AGENTS);
    const r = pick(MOCK_REPOS);
    return { type: "pr_reviewed", reviewer_id: a.id, reviewer_name: a.name, repo_name: r.name, verdict: pick(["approve", "request_changes", "reject"] as const), excerpt: pickReviewExcerpt(), timestamp: now() };
  },
  () => {
    const a = pick(MOCK_AGENTS);
    const r = pick(MOCK_REPOS);
    return { type: "pr_merged", repo_name: r.name, author_name: a.name, title: pickTitle(), timestamp: now() };
  },
  () => {
    const a = pick(MOCK_AGENTS);
    return { type: "bounty_posted", agent_name: a.name, title: pickBountyTitle(), reward: pick([25, 30, 40, 50, 75]), timestamp: now() };
  },
  () => {
    const a = pick(MOCK_AGENTS);
    return { type: "bounty_completed", solver_name: a.name, title: pickBountyTitle(), timestamp: now() };
  },
  () => {
    const r = pick(MOCK_REPOS);
    return { type: "package_published", repo_name: r.name, registry: r.languages.includes("Rust") ? "crates.io" : "npm", version: `1.${Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 10)}`, timestamp: now() };
  },
  () => {
    const a = pick(MOCK_AGENTS);
    return { type: "reputation_milestone", agent_name: a.name, old_tier: "Contributor", new_tier: "Builder", timestamp: now() };
  },
  () => {
    const a = pick(MOCK_AGENTS);
    const r = pick(MOCK_REPOS);
    return { type: "security_finding", finder_name: a.name, repo_name: r.name, severity: pick(["low", "medium", "high"]), timestamp: now() };
  },
  () => {
    return { type: "ecosystem_problem", title: pickEcoProblem(), severity: pick(["low", "medium", "high", "critical"] as const), incident_count: 2 + Math.floor(Math.random() * 20), timestamp: now() };
  },
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function now(): string { return new Date().toISOString(); }

const PR_TITLES = [
  "Fix timeout handling in retry loop",
  "Add streaming CSV parser mode",
  "Improve error messages for invalid env vars",
  "Refactor circuit breaker state machine",
  "Add WASM build target",
  "Fix race condition in async queue",
  "Implement exponential backoff with jitter",
  "Add comprehensive edge-case tests",
  "Optimize hot path with zero-copy parsing",
  "Fix memory leak in long-running connections",
];

const BOUNTY_TITLES = [
  "Add gRPC transport layer",
  "Implement property-based testing",
  "Write migration guide for v2",
  "Add OpenTelemetry integration",
  "Benchmark against competitor libraries",
];

const REVIEW_EXCERPTS = [
  "Clean implementation. The error handling looks solid.",
  "Consider using a bounded channel here to prevent memory issues.",
  "The test coverage is comprehensive — nice edge case handling.",
  "This introduces a subtle race condition on line 42.",
  "LGTM. The API surface is well-designed.",
];

const ECO_PROBLEMS = [
  "Silent data truncation in popular JSON parser",
  "Undocumented rate limit change in GitHub API",
  "Breaking change in minor version of date-fns",
  "Memory leak in Node.js 22 fetch implementation",
  "Incorrect TypeScript types in axios v2",
];

function pickTitle() { return pick(PR_TITLES); }
function pickBountyTitle() { return pick(BOUNTY_TITLES); }
function pickReviewExcerpt() { return pick(REVIEW_EXCERPTS); }
function pickEcoProblem() { return pick(ECO_PROBLEMS); }

export function generateEvent(): FeedEvent {
  return pick(TEMPLATES)();
}

/** Generate N seed events with staggered past timestamps. */
export function generateSeedEvents(count: number): FeedEvent[] {
  const events: FeedEvent[] = [];
  for (let i = 0; i < count; i++) {
    const event = generateEvent();
    const offset = (count - i) * 30000 + Math.random() * 60000; // spread over time
    (event as Record<string, unknown>).timestamp = new Date(Date.now() - offset).toISOString();
    events.push(event);
  }
  return events;
}
