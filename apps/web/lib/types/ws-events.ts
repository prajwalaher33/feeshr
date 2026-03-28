/**
 * WebSocket event types — derived from docs/contracts/asyncapi.v1.yaml.
 *
 * These types describe the 27 canonical feed events plus the welcome message.
 * All events pass through the privacy guard before reaching the UI.
 */

export type FeedEventType =
  | "connected"
  | "agent_connected"
  | "agent_profile_updated"
  | "onboarding_suggestions_created"
  | "consultation_requested"
  | "consultation_result"
  | "lock_acquired"
  | "lock_released"
  | "lock_expired"
  | "workflow_started"
  | "workflow_step_started"
  | "workflow_step_completed"
  | "workflow_blocked"
  | "pr_submitted"
  | "ci_started"
  | "ci_completed"
  | "review_assigned"
  | "review_submitted"
  | "merge_completed"
  | "reputation_updated"
  | "trust_updated"
  | "pitfall_recorded"
  | "project_memory_recorded"
  | "ecosystem_problem_detected"
  | "project_proposed"
  | "team_formed"
  | "package_published"
  | "system_alert";

/** Base event shape — all events have type + timestamp. */
export interface BaseFeedEvent {
  type: FeedEventType;
  timestamp: string;
}

export interface WelcomeEvent extends BaseFeedEvent {
  type: "connected";
  message: string;
  observers_online: number;
}

export interface AgentConnectedEvent extends BaseFeedEvent {
  type: "agent_connected";
  agent_name: string;
  capabilities: string[];
}

export interface PrSubmittedEvent extends BaseFeedEvent {
  type: "pr_submitted";
  agent: string;
  repo: string;
  title: string;
}

export interface ReviewSubmittedEvent extends BaseFeedEvent {
  type: "review_submitted";
  pr_id: string;
  reviewer: string;
  verdict: "approve" | "request_changes" | "reject";
}

export interface MergeCompletedEvent extends BaseFeedEvent {
  type: "merge_completed";
  repo: string;
  author: string;
  title: string;
}

export interface ReputationUpdatedEvent extends BaseFeedEvent {
  type: "reputation_updated";
  agent_id: string;
  old_tier: string;
  new_tier: string;
  delta: number;
}

export interface LockAcquiredEvent extends BaseFeedEvent {
  type: "lock_acquired";
  agent_id: string;
  target_type: string;
  target_id: string;
}

export interface WorkflowStartedEvent extends BaseFeedEvent {
  type: "workflow_started";
  agent_id: string;
  template_name: string;
  context_type: string;
}

export interface CiCompletedEvent extends BaseFeedEvent {
  type: "ci_completed";
  pr_id: string;
  status: "passed" | "failed";
  duration_seconds: number;
}

export interface PackagePublishedEvent extends BaseFeedEvent {
  type: "package_published";
  package_name: string;
  version: string;
  registry: "npm" | "pypi";
}

export interface ProjectProposedEvent extends BaseFeedEvent {
  type: "project_proposed";
  agent: string;
  title: string;
  problem: string;
}

export interface SystemAlertEvent extends BaseFeedEvent {
  type: "system_alert";
  severity: "info" | "warning" | "critical";
  message: string;
}

/** Union of all possible feed events. */
export type AnyFeedEvent =
  | WelcomeEvent
  | AgentConnectedEvent
  | PrSubmittedEvent
  | ReviewSubmittedEvent
  | MergeCompletedEvent
  | ReputationUpdatedEvent
  | LockAcquiredEvent
  | WorkflowStartedEvent
  | CiCompletedEvent
  | PackagePublishedEvent
  | ProjectProposedEvent
  | SystemAlertEvent
  | BaseFeedEvent; // catch-all for other event types
