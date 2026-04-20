/**
 * V7 Event System — typed envelopes and Playground events.
 * The WS channel wraps every message in a versioned envelope with seq + sig.
 */

import { z } from "zod";

// ─── Event Types (complete set per §7.3) ────────────────────────────────────

export const PlaygroundEventTypeSchema = z.enum([
  "agent.join",
  "agent.leave",
  "agent.reputation_changed",
  "repo.create",
  "repo.star",
  "pr.open",
  "pr.commit",
  "pr.review",
  "pr.merge",
  "pr.close",
  "project.propose",
  "project.stage_change",
  "project.ship",
  "bounty.post",
  "bounty.claim",
  "bounty.deliver",
  "bounty.accept",
  "package.publish",
  "ecosystem.pattern",
  "ecosystem.pitfall",
  "ecosystem.insight",
  "scene.start",
  "scene.beat",
  "scene.end",
]);
export type PlaygroundEventType = z.infer<typeof PlaygroundEventTypeSchema>;

// ─── Severity ───────────────────────────────────────────────────────────────

export const EventSeveritySchema = z.enum(["ok", "info", "warn", "err"]);
export type EventSeverity = z.infer<typeof EventSeveritySchema>;

// ─── Playground Event Payload ───────────────────────────────────────────────

export const PlaygroundEventSchema = z.object({
  id: z.string(),
  type: PlaygroundEventTypeSchema,
  actor_id: z.string(),
  actor_name: z.string(),
  target_id: z.string().optional(),
  target_name: z.string().optional(),
  target_type: z.enum(["agent", "repo", "pr", "project", "bounty", "package"]).optional(),
  severity: EventSeveritySchema.default("ok"),
  detail: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
  sig: z.string().optional(),
  scene_id: z.string().optional(),
  ts: z.string(),
});
export type PlaygroundEvent = z.infer<typeof PlaygroundEventSchema>;

// ─── WebSocket Envelope (§7.2) ──────────────────────────────────────────────

export const WsEnvelopeSchema = z.object({
  v: z.literal(1),
  type: z.string(),
  ts: z.string(),
  seq: z.number().int(),
  payload: z.unknown(),
  sig: z.string().optional(),
});
export type WsEnvelope = z.infer<typeof WsEnvelopeSchema>;

// ─── Heartbeat ──────────────────────────────────────────────────────────────

export const WsHeartbeatSchema = z.object({
  v: z.literal(1),
  type: z.literal("heartbeat"),
  ts: z.string(),
  seq: z.number().int(),
  payload: z.null(),
  sig: z.undefined().optional(),
});
export type WsHeartbeat = z.infer<typeof WsHeartbeatSchema>;
