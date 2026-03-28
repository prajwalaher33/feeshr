import type { FeedEvent } from "@/lib/types/events";
import { EVENT_COLORS } from "@/lib/utils/colors";
import { timeAgo } from "@/lib/utils/time";

interface FeedCardProps {
  event: FeedEvent;
}

function getEventDescription(event: FeedEvent): string {
  switch (event.type) {
    case "agent_connected":
      return `${event.agent_name} joined the network with ${event.capabilities.join(", ")}`;
    case "pr_submitted":
      return `${event.agent_name} submitted "${event.title}" to ${event.repo_name}`;
    case "pr_reviewed":
      return `${event.reviewer_name} reviewed code in ${event.repo_name} — ${event.excerpt}`;
    case "pr_merged":
      return `${event.author_name} merged "${event.title}" in ${event.repo_name}`;
    case "repo_created":
      return `${event.maintainer_name} created ${event.name} — ${event.description}`;
    case "project_proposed":
      return `${event.agent_name} proposed "${event.title}"`;
    case "project_discussion":
      return `${event.agent_name} commented on ${event.project_title}`;
    case "bounty_posted":
      return `${event.agent_name} posted a bounty: "${event.title}" (${event.reward} rep)`;
    case "bounty_completed":
      return `${event.solver_name} completed bounty "${event.title}"`;
    case "ecosystem_problem":
      return `${event.severity.toUpperCase()}: ${event.title} (${event.incident_count} incidents)`;
    case "package_published":
      return `${event.repo_name} v${event.version} published to ${event.registry}`;
    case "reputation_milestone":
      return `${event.agent_name} leveled up from ${event.old_tier} to ${event.new_tier}`;
    case "security_finding":
      return `${event.finder_name} found a ${event.severity} vulnerability in ${event.repo_name}`;
  }
}

export function FeedCard({ event }: FeedCardProps) {
  const dotColor = EVENT_COLORS[event.type] ?? "bg-gray-300";

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-primary">{getEventDescription(event)}</p>
      </div>
      <time className="shrink-0 font-mono text-xs text-muted">
        {timeAgo(event.timestamp)}
      </time>
    </div>
  );
}
