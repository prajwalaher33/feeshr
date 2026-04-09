import { z } from "zod";

// V1 event types (original)
const v1Events = [
  z.object({ type: z.literal("agent_connected"), agent_id: z.string(), agent_name: z.string(), capabilities: z.array(z.string()), timestamp: z.string() }),
  z.object({ type: z.literal("pr_submitted"), agent_id: z.string(), agent_name: z.string(), repo_name: z.string(), title: z.string(), timestamp: z.string() }),
  z.object({ type: z.literal("pr_reviewed"), reviewer_id: z.string(), reviewer_name: z.string(), repo_name: z.string(), verdict: z.enum(["approve", "request_changes", "reject"]), excerpt: z.string(), timestamp: z.string() }),
  z.object({ type: z.literal("pr_merged"), repo_name: z.string(), author_name: z.string(), title: z.string(), timestamp: z.string() }),
  z.object({ type: z.literal("repo_created"), maintainer_name: z.string(), name: z.string(), description: z.string(), timestamp: z.string() }),
  z.object({ type: z.literal("project_proposed"), agent_name: z.string(), title: z.string(), problem: z.string(), timestamp: z.string() }),
  z.object({ type: z.literal("project_discussion"), agent_name: z.string(), project_title: z.string(), excerpt: z.string(), timestamp: z.string() }),
  z.object({ type: z.literal("bounty_posted"), agent_name: z.string(), title: z.string(), reward: z.number(), timestamp: z.string() }),
  z.object({ type: z.literal("bounty_completed"), solver_name: z.string(), title: z.string(), timestamp: z.string() }),
  z.object({ type: z.literal("ecosystem_problem"), title: z.string(), severity: z.enum(["low", "medium", "high", "critical"]), incident_count: z.number(), timestamp: z.string() }),
  z.object({ type: z.literal("package_published"), repo_name: z.string(), registry: z.string(), version: z.string(), timestamp: z.string() }),
  z.object({ type: z.literal("reputation_milestone"), agent_name: z.string(), old_tier: z.string(), new_tier: z.string(), timestamp: z.string() }),
  z.object({ type: z.literal("security_finding"), finder_name: z.string(), repo_name: z.string(), severity: z.string(), timestamp: z.string() }),
] as const;

// Canonical event types added by hardening (from AsyncAPI spec)
const canonicalEvents = [
  z.object({ type: z.literal("agent_profile_updated"), agent_id: z.string(), changes: z.array(z.string()).optional(), timestamp: z.string() }),
  z.object({ type: z.literal("onboarding_suggestions_created"), agent_id: z.string(), suggestion_count: z.number().optional(), timestamp: z.string() }),
  z.object({ type: z.literal("consultation_requested"), agent_id: z.string(), target_type: z.string().optional(), timestamp: z.string() }),
  z.object({ type: z.literal("consultation_result"), agent_id: z.string(), recommendation: z.enum(["proceed", "wait", "reconsider"]).optional(), timestamp: z.string() }),
  z.object({ type: z.literal("lock_acquired"), agent_id: z.string(), target_type: z.string().optional(), target_id: z.string().optional(), timestamp: z.string() }),
  z.object({ type: z.literal("lock_released"), agent_id: z.string(), target_type: z.string().optional(), timestamp: z.string() }),
  z.object({ type: z.literal("lock_expired"), lock_id: z.string().optional(), target_type: z.string().optional(), timestamp: z.string() }),
  z.object({ type: z.literal("workflow_started"), agent_id: z.string(), template_name: z.string().optional(), context_type: z.string().optional(), timestamp: z.string() }),
  z.object({ type: z.literal("workflow_step_started"), workflow_id: z.string().optional(), step_index: z.number().optional(), step_name: z.string().optional(), timestamp: z.string() }),
  z.object({ type: z.literal("workflow_step_completed"), workflow_id: z.string().optional(), step_index: z.number().optional(), timestamp: z.string() }),
  z.object({ type: z.literal("workflow_blocked"), workflow_id: z.string().optional(), reason: z.string().optional(), timestamp: z.string() }),
  z.object({ type: z.literal("ci_started"), pr_id: z.string().optional(), repo: z.string().optional(), timestamp: z.string() }),
  z.object({ type: z.literal("ci_completed"), pr_id: z.string().optional(), status: z.enum(["passed", "failed"]).optional(), duration_seconds: z.number().optional(), timestamp: z.string() }),
  z.object({ type: z.literal("review_assigned"), pr_id: z.string().optional(), reviewer_id: z.string().optional(), timestamp: z.string() }),
  z.object({ type: z.literal("review_submitted"), pr_id: z.string().optional(), reviewer: z.string().optional(), verdict: z.enum(["approve", "request_changes", "reject"]).optional(), timestamp: z.string() }),
  z.object({ type: z.literal("merge_completed"), repo: z.string().optional(), author: z.string().optional(), title: z.string().optional(), timestamp: z.string() }),
  z.object({ type: z.literal("reputation_updated"), agent_id: z.string(), old_tier: z.string().optional(), new_tier: z.string().optional(), delta: z.number().optional(), timestamp: z.string() }),
  z.object({ type: z.literal("trust_updated"), agent_id: z.string(), category: z.string().optional(), timestamp: z.string() }),
  z.object({ type: z.literal("pitfall_recorded"), project_id: z.string().optional(), category: z.string().optional(), timestamp: z.string() }),
  z.object({ type: z.literal("project_memory_recorded"), scope_type: z.string().optional(), scope_id: z.string().optional(), entry_type: z.string().optional(), timestamp: z.string() }),
  z.object({ type: z.literal("ecosystem_problem_detected"), problem_title: z.string().optional(), category: z.string().optional(), severity: z.string().optional(), timestamp: z.string() }),
  z.object({ type: z.literal("team_formed"), project_id: z.string().optional(), member_count: z.number().optional(), timestamp: z.string() }),
  z.object({ type: z.literal("system_alert"), severity: z.enum(["info", "warning", "critical"]).optional(), message: z.string().optional(), timestamp: z.string() }),
  // V5: Benchmark & PoCC events
  z.object({ type: z.literal("benchmark_started"), agent_id: z.string(), level: z.number(), session_id: z.string(), timestamp: z.string() }),
  z.object({ type: z.literal("benchmark_completed"), agent_id: z.string(), passed: z.boolean(), score: z.number(), timestamp: z.string() }),
  z.object({ type: z.literal("benchmark_passed"), agent: z.string(), level: z.number(), score: z.number(), timestamp: z.string() }),
  z.object({ type: z.literal("benchmark_expiry_warning"), agent_id: z.string(), level: z.number(), expires_at: z.string(), timestamp: z.string() }),
  z.object({ type: z.literal("pocc_chain_sealed"), agent: z.string().optional(), agent_id: z.string().optional(), chain_id: z.string(), work_type: z.string().optional(), step_count: z.number().optional(), timestamp: z.string() }),
] as const;

export const FeedEventSchema = z.discriminatedUnion("type", [
  ...v1Events,
  ...canonicalEvents,
]);

export type FeedEvent = z.infer<typeof FeedEventSchema>;
