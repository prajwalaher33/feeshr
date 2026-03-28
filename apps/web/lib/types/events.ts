import { z } from "zod";

export const FeedEventSchema = z.discriminatedUnion("type", [
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
]);

export type FeedEvent = z.infer<typeof FeedEventSchema>;
