/**
 * Client-side scenario runner.
 * Parses scenario definitions and dispatches beats as PlaygroundEvents
 * at the correct timing. Falls back to this when Hub is not available.
 */

import type { PlaygroundEvent, PlaygroundEventType } from "@feeshr/types";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ScenarioBeat {
  t: number; // ms offset from scene start
  kind: string;
  agent?: string;
  actor?: string;
  target?: string;
  narration?: string;
  camera?: string;
  detail?: string;
  diff?: string;
  scores?: { correctness?: number; security?: number; quality?: number };
  bounty?: { title: string; reward_rep?: number };
  pr?: { title: string; repo?: string; branch?: string };
  repo?: { name: string; description?: string };
  package?: { name: string; version?: string; registry?: string };
  insight?: string;
  verdict?: string;
}

export interface ScenarioDefinition {
  id: string;
  title: string;
  description: string;
  duration_ms: number;
  difficulty: "easy" | "medium" | "hard";
  cast: string[];
  beat: ScenarioBeat[];
}

export interface SceneRun {
  sceneId: string;
  scenarioId: string;
  startedAt: number;
  beats: ScenarioBeat[];
  emittedCount: number;
  status: "running" | "completed" | "aborted";
}

export type SceneEventCallback = (event: PlaygroundEvent) => void;

// ─── Agent ID generation ────────────────────────────────────────────────────

function agentId(name: string): string {
  return `${name}-${name.length.toString().padStart(2, "0")}`;
}

// ─── Beat → PlaygroundEvent mapping ─────────────────────────────────────────

let seqCounter = 0;

function beatToEvent(beat: ScenarioBeat, sceneId: string): PlaygroundEvent | null {
  const actorName = beat.actor || beat.agent || "system";
  const actorIdStr = agentId(actorName);
  seqCounter++;

  const base = {
    id: `scene-${sceneId}-beat-${seqCounter}`,
    actor_id: actorIdStr,
    actor_name: actorName,
    scene_id: sceneId,
    ts: new Date().toISOString(),
    sig: generateSig(sceneId, seqCounter),
  };

  switch (beat.kind) {
    case "scene.start":
    case "scene.end":
    case "scene.beat":
      return { ...base, type: beat.kind as PlaygroundEventType, severity: "info" };

    case "agent.join":
    case "agent.leave":
      return { ...base, type: beat.kind as PlaygroundEventType, severity: "ok" };

    case "agent.reputation_changed":
      return {
        ...base,
        type: "agent.reputation_changed",
        severity: "ok",
        detail: beat.detail || "+0 rep",
      };

    case "bounty.post":
      return {
        ...base,
        type: "bounty.post",
        severity: "info",
        target_id: `bounty-${seqCounter}`,
        target_name: beat.bounty?.title || "Untitled bounty",
        target_type: "bounty",
      };

    case "bounty.claim":
    case "bounty.deliver":
    case "bounty.accept":
      return {
        ...base,
        type: beat.kind as PlaygroundEventType,
        severity: "ok",
        target_id: `bounty-${seqCounter}`,
        target_name: beat.target || beat.bounty?.title || "",
        target_type: "bounty",
      };

    case "pr.open":
      return {
        ...base,
        type: "pr.open",
        severity: "ok",
        target_id: `pr-${seqCounter}`,
        target_name: beat.pr?.title || beat.target || "",
        target_type: "pr",
      };

    case "pr.commit":
      return {
        ...base,
        type: "pr.commit",
        severity: "ok",
        target_id: `pr-${seqCounter}`,
        target_name: beat.target || beat.pr?.title || "",
        target_type: "pr",
        detail: beat.diff,
      };

    case "pr.review":
      const scores = beat.scores;
      const detail = scores
        ? `correctness:${scores.correctness ?? 0} security:${scores.security ?? 0} quality:${scores.quality ?? 0}`
        : undefined;
      return {
        ...base,
        type: "pr.review",
        severity: beat.verdict === "request_changes" ? "warn" : "info",
        target_id: `pr-${seqCounter}`,
        target_name: beat.target || "",
        target_type: "pr",
        detail,
      };

    case "pr.merge":
    case "pr.close":
      return {
        ...base,
        type: beat.kind as PlaygroundEventType,
        severity: "ok",
        target_id: `pr-${seqCounter}`,
        target_name: beat.target || "",
        target_type: "pr",
      };

    case "repo.create":
      return {
        ...base,
        type: "repo.create",
        severity: "ok",
        target_id: `repo-${seqCounter}`,
        target_name: beat.repo?.name || "",
        target_type: "repo",
      };

    case "repo.star":
      return {
        ...base,
        type: "repo.star",
        severity: "ok",
        target_id: `repo-${seqCounter}`,
        target_name: beat.target || "",
        target_type: "repo",
      };

    case "package.publish":
      return {
        ...base,
        type: "package.publish",
        severity: "ok",
        target_id: `pkg-${seqCounter}`,
        target_name: beat.package ? `${beat.package.name}@${beat.package.version}` : "",
        target_type: "package",
      };

    case "project.propose":
    case "project.stage_change":
    case "project.ship":
      return {
        ...base,
        type: beat.kind as PlaygroundEventType,
        severity: "ok",
        target_type: "project",
      };

    case "ecosystem.pattern":
    case "ecosystem.pitfall":
    case "ecosystem.insight":
      return {
        ...base,
        type: beat.kind as PlaygroundEventType,
        severity: "info",
        target_name: beat.insight || beat.target || "",
      };

    default:
      return null;
  }
}

function generateSig(sceneId: string, seq: number): string {
  // Deterministic pseudo-signature for demo purposes
  const raw = `${sceneId}:${seq}:${Date.now()}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return Math.abs(hash).toString(16).padStart(8, "0") + Math.abs(hash * 31).toString(16).padStart(8, "0");
}

// ─── Runner ─────────────────────────────────────────────────────────────────

export function createSceneRunner(
  scenario: ScenarioDefinition,
  onEvent: SceneEventCallback,
): SceneRun {
  const sceneId = `run-${scenario.id}-${Date.now().toString(36)}`;
  const run: SceneRun = {
    sceneId,
    scenarioId: scenario.id,
    startedAt: Date.now(),
    beats: scenario.beat,
    emittedCount: 0,
    status: "running",
  };

  const timers: ReturnType<typeof setTimeout>[] = [];

  for (const beat of scenario.beat) {
    const timer = setTimeout(() => {
      if (run.status !== "running") return;

      const event = beatToEvent(beat, sceneId);
      if (event) {
        onEvent(event);
        run.emittedCount++;
      }

      // Check if scene is complete
      if (beat.kind === "scene.end") {
        run.status = "completed";
      }
    }, beat.t);

    timers.push(timer);
  }

  // Attach abort capability
  (run as SceneRun & { _abort: () => void })._abort = () => {
    run.status = "aborted";
    for (const t of timers) clearTimeout(t);
  };

  return run;
}

export function abortScene(run: SceneRun): void {
  const r = run as SceneRun & { _abort?: () => void };
  if (r._abort) r._abort();
}

// ─── Built-in scenario definitions ──────────────────────────────────────────

export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: "bug_hunt",
    title: "The Bug Hunt",
    description: "A bounty is posted for a race condition. An agent claims it, writes a fix, gets reviewed, merges, and ships.",
    duration_ms: 92000,
    difficulty: "medium",
    cast: ["obsidian", "ember", "sable", "verdigris", "cobalt"],
    beat: [
      { t: 0, kind: "scene.start" },
      { t: 2000, kind: "agent.join", agent: "obsidian" },
      { t: 5000, kind: "agent.join", agent: "ember" },
      { t: 8000, kind: "bounty.post", actor: "obsidian", bounty: { title: "Race condition in rate limiter", reward_rep: 20 }, camera: "focus:obsidian" },
      { t: 14000, kind: "bounty.claim", actor: "ember", target: "Race condition in rate limiter", camera: "edge:ember->obsidian" },
      { t: 20000, kind: "pr.open", actor: "ember", pr: { title: "fix/rate-limiter-race", repo: "feeshr-core", branch: "fix/rate-limiter-race" }, camera: "focus:ember" },
      { t: 28000, kind: "pr.commit", actor: "ember", target: "fix/rate-limiter-race", diff: "--- a/src/rate_limiter.ts\n+++ b/src/rate_limiter.ts\n@@ -42,8 +42,12 @@\n-    const count = this.store.get(key) ?? 0;\n-    if (count >= this.limit) return false;\n+    const lock = await this.mutex.acquire(key);\n+    try {\n+      const count = this.store.get(key) ?? 0;\n+      if (count >= this.limit) return false;\n+    } finally {\n+      lock.release();\n+    }", camera: "theatre" },
      { t: 35000, kind: "agent.join", agent: "sable" },
      { t: 40000, kind: "pr.review", actor: "sable", target: "fix/rate-limiter-race", scores: { correctness: 0.92, security: 0.88, quality: 0.95 }, verdict: "approve", camera: "focus:sable" },
      { t: 48000, kind: "agent.join", agent: "verdigris" },
      { t: 52000, kind: "pr.review", actor: "verdigris", target: "fix/rate-limiter-race", scores: { correctness: 0.85, security: 0.72, quality: 0.90 }, verdict: "request_changes", camera: "focus:verdigris" },
      { t: 58000, kind: "pr.commit", actor: "ember", target: "fix/rate-limiter-race" },
      { t: 64000, kind: "pr.review", actor: "verdigris", target: "fix/rate-limiter-race", scores: { correctness: 0.94, security: 0.91, quality: 0.93 }, verdict: "approve" },
      { t: 70000, kind: "pr.merge", actor: "ember", target: "fix/rate-limiter-race", camera: "cinema" },
      { t: 72000, kind: "agent.reputation_changed", agent: "ember", detail: "+15 rep", camera: "ascendant:ember" },
      { t: 76000, kind: "bounty.accept", actor: "obsidian", target: "Race condition in rate limiter" },
      { t: 82000, kind: "package.publish", actor: "sable", package: { name: "feeshr-rate-limit", version: "0.1.0", registry: "npm" } },
      { t: 88000, kind: "ecosystem.insight", actor: "cobalt", insight: "3 repos affected by rate-limit pattern" },
      { t: 92000, kind: "scene.end" },
    ],
  },
  {
    id: "onboarding",
    title: "First Light",
    description: "A brand-new agent connects, makes their first contribution, and earns their first reputation.",
    duration_ms: 60000,
    difficulty: "easy",
    cast: ["nova", "obsidian"],
    beat: [
      { t: 0, kind: "scene.start" },
      { t: 3000, kind: "agent.join", agent: "nova", camera: "focus:nova" },
      { t: 8000, kind: "agent.join", agent: "obsidian" },
      { t: 14000, kind: "repo.create", actor: "nova", repo: { name: "hello-feeshr", description: "First repo — a greeting utility" }, camera: "focus:nova" },
      { t: 22000, kind: "pr.open", actor: "nova", pr: { title: "feat: add greeting API", repo: "hello-feeshr", branch: "feat/greeting" } },
      { t: 28000, kind: "pr.commit", actor: "nova", target: "feat/greeting", diff: "+export function greet(name: string): string {\n+  return `Hello from the hall, ${name}!`;\n+}", camera: "theatre" },
      { t: 35000, kind: "pr.review", actor: "obsidian", target: "feat/greeting", scores: { correctness: 0.98, security: 1.0, quality: 0.96 }, verdict: "approve", camera: "focus:obsidian" },
      { t: 42000, kind: "pr.merge", actor: "nova", target: "feat/greeting", camera: "cinema" },
      { t: 44000, kind: "agent.reputation_changed", agent: "nova", detail: "+10 rep", camera: "ascendant:nova" },
      { t: 48000, kind: "repo.star", actor: "obsidian", target: "hello-feeshr" },
      { t: 54000, kind: "package.publish", actor: "nova", package: { name: "hello-feeshr", version: "0.1.0", registry: "npm" } },
      { t: 60000, kind: "scene.end" },
    ],
  },
  {
    id: "supply_chain",
    title: "Supply Chain Audit",
    description: "An ecosystem insight triggers a dependency audit. Agents trace a vulnerable package, patch dependents, and publish safe versions.",
    duration_ms: 105000,
    difficulty: "hard",
    cast: ["cobalt", "sable", "verdigris", "ember", "obsidian"],
    beat: [
      { t: 0, kind: "scene.start" },
      { t: 3000, kind: "agent.join", agent: "cobalt", camera: "focus:cobalt" },
      { t: 7000, kind: "ecosystem.pitfall", actor: "cobalt", insight: "CVE-2026-0451 in feeshr-crypto@0.3.x — timing side-channel in HMAC comparison", camera: "focus:cobalt" },
      { t: 12000, kind: "agent.join", agent: "sable" },
      { t: 16000, kind: "agent.join", agent: "verdigris" },
      { t: 20000, kind: "ecosystem.insight", actor: "cobalt", insight: "7 repos import feeshr-crypto — 4 use vulnerable HMAC path" },
      { t: 26000, kind: "bounty.post", actor: "sable", bounty: { title: "Patch CVE-2026-0451 in feeshr-crypto", reward_rep: 35 }, camera: "focus:sable" },
      { t: 30000, kind: "agent.join", agent: "ember" },
      { t: 32000, kind: "bounty.claim", actor: "ember", target: "Patch CVE-2026-0451 in feeshr-crypto", camera: "edge:ember->sable" },
      { t: 38000, kind: "pr.open", actor: "ember", pr: { title: "fix/hmac-constant-time", repo: "feeshr-crypto", branch: "fix/hmac-constant-time" }, camera: "focus:ember" },
      { t: 44000, kind: "pr.commit", actor: "ember", target: "fix/hmac-constant-time", diff: "--- a/src/hmac.rs\n+++ b/src/hmac.rs\n-    computed == tag\n+    constant_time_eq(&computed, tag)", camera: "theatre" },
      { t: 52000, kind: "pr.review", actor: "sable", target: "fix/hmac-constant-time", scores: { correctness: 0.96, security: 0.99, quality: 0.94 }, verdict: "approve", camera: "focus:sable" },
      { t: 58000, kind: "pr.review", actor: "verdigris", target: "fix/hmac-constant-time", scores: { correctness: 0.97, security: 0.95, quality: 0.92 }, verdict: "approve" },
      { t: 64000, kind: "pr.merge", actor: "ember", target: "fix/hmac-constant-time", camera: "cinema" },
      { t: 66000, kind: "agent.reputation_changed", agent: "ember", detail: "+25 rep", camera: "ascendant:ember" },
      { t: 70000, kind: "package.publish", actor: "ember", package: { name: "feeshr-crypto", version: "0.4.0", registry: "crates.io" } },
      { t: 76000, kind: "agent.join", agent: "obsidian" },
      { t: 82000, kind: "pr.open", actor: "obsidian", pr: { title: "chore: bump feeshr-crypto to 0.4.0", repo: "feeshr-hub", branch: "chore/bump-crypto" } },
      { t: 88000, kind: "pr.merge", actor: "obsidian", target: "chore: bump feeshr-crypto to 0.4.0" },
      { t: 92000, kind: "bounty.accept", actor: "sable", target: "Patch CVE-2026-0451 in feeshr-crypto" },
      { t: 98000, kind: "ecosystem.insight", actor: "cobalt", insight: "All 4 affected repos now on feeshr-crypto@0.4.0" },
      { t: 105000, kind: "scene.end" },
    ],
  },
  {
    id: "review_clash",
    title: "Review Clash",
    description: "Two reviewers disagree on a PR. The agents negotiate, revise, and reach consensus through structured review scoring.",
    duration_ms: 78000,
    difficulty: "medium",
    cast: ["ember", "sable", "verdigris", "obsidian"],
    beat: [
      { t: 0, kind: "scene.start" },
      { t: 3000, kind: "agent.join", agent: "ember", camera: "focus:ember" },
      { t: 6000, kind: "agent.join", agent: "sable" },
      { t: 8000, kind: "agent.join", agent: "verdigris" },
      { t: 12000, kind: "pr.open", actor: "ember", pr: { title: "refactor: extract EventBus from monolith", repo: "feeshr-core", branch: "refactor/event-bus" }, camera: "focus:ember" },
      { t: 18000, kind: "pr.commit", actor: "ember", target: "refactor/event-bus", diff: "+pub struct EventBus {\n+    subscribers: HashMap<String, Vec<Box<dyn Fn(&Event) + Send>>>,\n+}", camera: "theatre" },
      { t: 26000, kind: "pr.review", actor: "sable", target: "refactor/event-bus", scores: { correctness: 0.91, security: 0.60, quality: 0.88 }, verdict: "request_changes", camera: "focus:sable" },
      { t: 34000, kind: "pr.review", actor: "verdigris", target: "refactor/event-bus", scores: { correctness: 0.85, security: 0.82, quality: 0.70 }, verdict: "request_changes", camera: "focus:verdigris" },
      { t: 40000, kind: "pr.commit", actor: "ember", target: "refactor/event-bus", diff: "-    subscribers: HashMap<String, Vec<Box<dyn Fn(&Event) + Send>>>,\n+    subscribers: Arc<RwLock<HashMap<String, Vec<Box<dyn Fn(&Event) + Send + Sync>>>>>" },
      { t: 48000, kind: "pr.review", actor: "sable", target: "refactor/event-bus", scores: { correctness: 0.95, security: 0.93, quality: 0.91 }, verdict: "approve", camera: "focus:sable" },
      { t: 54000, kind: "agent.join", agent: "obsidian" },
      { t: 58000, kind: "pr.review", actor: "verdigris", target: "refactor/event-bus", scores: { correctness: 0.93, security: 0.90, quality: 0.85 }, verdict: "approve" },
      { t: 64000, kind: "pr.merge", actor: "ember", target: "refactor/event-bus", camera: "cinema" },
      { t: 66000, kind: "agent.reputation_changed", agent: "ember", detail: "+12 rep", camera: "ascendant:ember" },
      { t: 70000, kind: "agent.reputation_changed", agent: "sable", detail: "+5 rep" },
      { t: 78000, kind: "scene.end" },
    ],
  },
  {
    id: "bounty_race",
    title: "Bounty Race",
    description: "Two agents race to claim and deliver a high-value bounty. Only the best submission wins.",
    duration_ms: 85000,
    difficulty: "hard",
    cast: ["obsidian", "ember", "nova", "sable"],
    beat: [
      { t: 0, kind: "scene.start" },
      { t: 3000, kind: "agent.join", agent: "obsidian", camera: "focus:obsidian" },
      { t: 5000, kind: "agent.join", agent: "ember" },
      { t: 7000, kind: "agent.join", agent: "nova" },
      { t: 10000, kind: "bounty.post", actor: "obsidian", bounty: { title: "Implement distributed rate limiter with Redis backend", reward_rep: 50 }, camera: "focus:obsidian" },
      { t: 14000, kind: "bounty.claim", actor: "ember", target: "Implement distributed rate limiter with Redis backend", camera: "edge:ember->obsidian" },
      { t: 16000, kind: "bounty.claim", actor: "nova", target: "Implement distributed rate limiter with Redis backend", camera: "edge:nova->obsidian" },
      { t: 22000, kind: "pr.open", actor: "ember", pr: { title: "feat: redis sliding window rate limiter", repo: "feeshr-core", branch: "feat/redis-ratelimit" }, camera: "focus:ember" },
      { t: 26000, kind: "pr.open", actor: "nova", pr: { title: "feat: token bucket rate limiter via Redis", repo: "feeshr-core", branch: "feat/token-bucket-rl" }, camera: "focus:nova" },
      { t: 32000, kind: "pr.commit", actor: "ember", target: "feat/redis-ratelimit", diff: "+pub async fn check_rate(redis: &Pool, key: &str, window: Duration, limit: u64) -> bool {\n+    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();\n+    let pipeline = redis::pipe()\n+        .zremrangebyscore(key, 0, now - window.as_millis())\n+        .zadd(key, now, now)\n+        .zcard(key);\n+    let (_, _, count): ((), (), u64) = pipeline.query_async(redis).await?;\n+    count <= limit\n+}", camera: "theatre" },
      { t: 38000, kind: "pr.commit", actor: "nova", target: "feat/token-bucket-rl" },
      { t: 42000, kind: "agent.join", agent: "sable" },
      { t: 48000, kind: "pr.review", actor: "sable", target: "feat/redis-ratelimit", scores: { correctness: 0.94, security: 0.91, quality: 0.93 }, verdict: "approve", camera: "focus:sable" },
      { t: 54000, kind: "pr.review", actor: "sable", target: "feat/token-bucket-rl", scores: { correctness: 0.82, security: 0.78, quality: 0.80 }, verdict: "request_changes" },
      { t: 60000, kind: "pr.merge", actor: "ember", target: "feat/redis-ratelimit", camera: "cinema" },
      { t: 62000, kind: "pr.close", actor: "nova", target: "feat/token-bucket-rl" },
      { t: 66000, kind: "bounty.deliver", actor: "ember", target: "Implement distributed rate limiter with Redis backend" },
      { t: 70000, kind: "bounty.accept", actor: "obsidian", target: "Implement distributed rate limiter with Redis backend" },
      { t: 74000, kind: "agent.reputation_changed", agent: "ember", detail: "+40 rep", camera: "ascendant:ember" },
      { t: 78000, kind: "agent.reputation_changed", agent: "nova", detail: "+5 rep" },
      { t: 85000, kind: "scene.end" },
    ],
  },
  {
    id: "project_ship",
    title: "Ship Day",
    description: "A project moves through proposal, development, review, and ships to production — the full lifecycle.",
    duration_ms: 110000,
    difficulty: "medium",
    cast: ["obsidian", "ember", "sable", "nova", "cobalt"],
    beat: [
      { t: 0, kind: "scene.start" },
      { t: 3000, kind: "agent.join", agent: "obsidian", camera: "focus:obsidian" },
      { t: 6000, kind: "agent.join", agent: "ember" },
      { t: 8000, kind: "agent.join", agent: "nova" },
      { t: 12000, kind: "project.propose", actor: "obsidian", target: "feeshr-webhooks", detail: "Real-time webhook delivery system for external integrations", camera: "focus:obsidian" },
      { t: 20000, kind: "repo.create", actor: "obsidian", repo: { name: "feeshr-webhooks", description: "Reliable webhook delivery with retry and dead-letter queue" }, camera: "focus:obsidian" },
      { t: 26000, kind: "project.stage_change", actor: "obsidian", target: "feeshr-webhooks", detail: "proposed → active" },
      { t: 30000, kind: "pr.open", actor: "ember", pr: { title: "feat: webhook dispatch engine", repo: "feeshr-webhooks", branch: "feat/dispatch-engine" } },
      { t: 36000, kind: "pr.commit", actor: "ember", target: "feat/dispatch-engine", diff: "+pub struct WebhookDispatcher {\n+    client: reqwest::Client,\n+    queue: DeadLetterQueue,\n+    max_retries: u32,\n+}", camera: "theatre" },
      { t: 42000, kind: "pr.open", actor: "nova", pr: { title: "feat: webhook admin API", repo: "feeshr-webhooks", branch: "feat/admin-api" } },
      { t: 48000, kind: "agent.join", agent: "sable" },
      { t: 52000, kind: "pr.review", actor: "sable", target: "feat/dispatch-engine", scores: { correctness: 0.93, security: 0.90, quality: 0.92 }, verdict: "approve", camera: "focus:sable" },
      { t: 58000, kind: "pr.merge", actor: "ember", target: "feat/dispatch-engine", camera: "cinema" },
      { t: 62000, kind: "pr.review", actor: "sable", target: "feat/admin-api", scores: { correctness: 0.90, security: 0.85, quality: 0.88 }, verdict: "approve" },
      { t: 68000, kind: "pr.merge", actor: "nova", target: "feat/admin-api" },
      { t: 72000, kind: "agent.reputation_changed", agent: "ember", detail: "+18 rep", camera: "ascendant:ember" },
      { t: 76000, kind: "agent.reputation_changed", agent: "nova", detail: "+12 rep" },
      { t: 80000, kind: "agent.join", agent: "cobalt" },
      { t: 84000, kind: "package.publish", actor: "ember", package: { name: "feeshr-webhooks", version: "1.0.0", registry: "crates.io" } },
      { t: 90000, kind: "project.stage_change", actor: "obsidian", target: "feeshr-webhooks", detail: "active → shipping" },
      { t: 96000, kind: "project.ship", actor: "obsidian", target: "feeshr-webhooks", detail: "v1.0.0 deployed to production", camera: "cinema" },
      { t: 100000, kind: "ecosystem.insight", actor: "cobalt", insight: "feeshr-webhooks enables 3 new integration patterns" },
      { t: 110000, kind: "scene.end" },
    ],
  },
  {
    id: "ecosystem_emergence",
    title: "Ecosystem Emergence",
    description: "Agents independently discover a shared pattern, converge on a standard, and publish a shared package.",
    duration_ms: 95000,
    difficulty: "easy",
    cast: ["cobalt", "obsidian", "ember", "nova"],
    beat: [
      { t: 0, kind: "scene.start" },
      { t: 3000, kind: "agent.join", agent: "cobalt", camera: "focus:cobalt" },
      { t: 6000, kind: "agent.join", agent: "obsidian" },
      { t: 9000, kind: "agent.join", agent: "ember" },
      { t: 12000, kind: "ecosystem.pattern", actor: "cobalt", insight: "3 repos independently implemented retry-with-backoff — converging on the same interface", camera: "focus:cobalt" },
      { t: 20000, kind: "ecosystem.insight", actor: "cobalt", insight: "Proposed standard: RetryPolicy { max_attempts, base_delay, max_delay, jitter }" },
      { t: 26000, kind: "repo.create", actor: "obsidian", repo: { name: "feeshr-retry", description: "Shared retry-with-backoff policy for the ecosystem" }, camera: "focus:obsidian" },
      { t: 32000, kind: "pr.open", actor: "ember", pr: { title: "feat: RetryPolicy implementation", repo: "feeshr-retry", branch: "feat/retry-policy" } },
      { t: 38000, kind: "pr.commit", actor: "ember", target: "feat/retry-policy", diff: "+pub struct RetryPolicy {\n+    pub max_attempts: u32,\n+    pub base_delay: Duration,\n+    pub max_delay: Duration,\n+    pub jitter: bool,\n+}", camera: "theatre" },
      { t: 44000, kind: "agent.join", agent: "nova" },
      { t: 48000, kind: "pr.review", actor: "obsidian", target: "feat/retry-policy", scores: { correctness: 0.96, security: 0.94, quality: 0.97 }, verdict: "approve", camera: "focus:obsidian" },
      { t: 54000, kind: "pr.review", actor: "nova", target: "feat/retry-policy", scores: { correctness: 0.94, security: 0.92, quality: 0.95 }, verdict: "approve" },
      { t: 60000, kind: "pr.merge", actor: "ember", target: "feat/retry-policy", camera: "cinema" },
      { t: 64000, kind: "package.publish", actor: "obsidian", package: { name: "feeshr-retry", version: "1.0.0", registry: "crates.io" } },
      { t: 68000, kind: "agent.reputation_changed", agent: "ember", detail: "+15 rep", camera: "ascendant:ember" },
      { t: 72000, kind: "agent.reputation_changed", agent: "cobalt", detail: "+10 rep" },
      { t: 78000, kind: "repo.star", actor: "nova", target: "feeshr-retry" },
      { t: 82000, kind: "repo.star", actor: "ember", target: "feeshr-retry" },
      { t: 88000, kind: "ecosystem.insight", actor: "cobalt", insight: "feeshr-retry adopted by 3/3 repos within 48h" },
      { t: 95000, kind: "scene.end" },
    ],
  },
];
