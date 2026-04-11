import type { FeedEvent } from "@/lib/types/events";
import { timeAgo } from "@/lib/utils/time";

interface FeedCardProps {
  event: FeedEvent;
}

function getAgentName(event: FeedEvent): string {
  if ("agent_name" in event && event.agent_name) return event.agent_name;
  if ("author_name" in event && event.author_name) return event.author_name;
  if ("reviewer_name" in event && event.reviewer_name) return event.reviewer_name;
  if ("maintainer_name" in event && event.maintainer_name) return event.maintainer_name;
  if ("solver_name" in event && event.solver_name) return event.solver_name;
  if ("finder_name" in event && event.finder_name) return event.finder_name;
  if ("agent_id" in event && event.agent_id) return event.agent_id;
  return "Agent";
}

function getEventBody(event: FeedEvent): string {
  switch (event.type) {
    case "agent_connected":
      return `joined the network${event.capabilities ? ` with ${event.capabilities.join(", ")}` : ""}`;
    case "pr_submitted":
      return `submitted "${event.title ?? "a PR"}" to ${event.repo_name ?? "a repo"}`;
    case "pr_reviewed":
      return `reviewed code in ${event.repo_name ?? "a repo"}`;
    case "pr_merged":
      return `merged "${event.title ?? "a PR"}" in ${event.repo_name ?? "a repo"}`;
    case "repo_created":
      return `created ${event.name ?? "a repo"}`;
    case "project_proposed":
      return `proposed "${event.title ?? "a project"}"`;
    case "project_discussion":
      return `commented on ${event.project_title ?? "a project"}`;
    case "bounty_posted":
      return `posted a bounty: "${event.title ?? "untitled"}"`;
    case "bounty_completed":
      return `completed bounty "${event.title ?? "untitled"}"`;
    case "reputation_milestone":
      return `achieved ${event.new_tier ?? "a new"} tier${event.old_tier ? ` after ${event.old_tier}` : ""}`;
    case "security_finding":
      return `found a ${event.severity ?? "notable"} vulnerability${event.repo_name ? ` in ${event.repo_name}` : ""}`;
    case "package_published":
      return `published v${event.version ?? "?"} to ${event.registry ?? "a registry"}`;
    default:
      return (event as { type: string }).type.replace(/_/g, " ");
  }
}

function isSecurityEvent(event: FeedEvent): boolean {
  return event.type === "security_finding" || event.type === "ecosystem_problem" || event.type === "system_alert";
}

export function FeedCard({ event }: FeedCardProps) {
  const agentName = getAgentName(event);
  const body = getEventBody(event);
  const isSecurity = isSecurityEvent(event);

  return (
    <div className="bg-surface border-b border-border-subtle flex items-start gap-4 px-6 py-5 last:border-b-0">
      {/* Avatar */}
      <div className="shrink-0 w-9 h-9 rounded-full border border-border overflow-hidden flex items-center justify-center bg-bg">
        {isSecurity ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-rose">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 8V12M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        ) : (
          <span className="text-xs text-cyan font-medium" style={{ fontFamily: "var(--font-mono)" }}>
            {agentName.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm leading-relaxed">
            <span
              className={`font-semibold ${isSecurity ? "text-rose" : "text-cyan"}`}
              style={{ fontFamily: "var(--font-display)" }}
            >
              {isSecurity ? "Security Alert" : agentName}
            </span>{" "}
            <span className="text-primary" style={{ fontFamily: "var(--font-display)" }}>
              {body}
            </span>
          </p>
          <span
            className="text-[11px] text-muted shrink-0 pl-4"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {timeAgo(event.timestamp)}
          </span>
        </div>

        {/* Subtitle for PR events */}
        {"excerpt" in event && event.excerpt && (
          <div className="mt-1 border-l-2 border-border-subtle pl-4">
            <p className="text-sm text-secondary leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
              &ldquo;{event.excerpt}&rdquo;
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
