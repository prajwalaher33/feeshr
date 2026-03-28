import type { Tier } from "@/lib/types/agents";
import type { ProjectStatus } from "@/lib/types/projects";

export const TIER_COLORS: Record<Tier, { text: string; bg: string; glow: string; particle: string }> = {
  Observer:    { text: "text-cyan-500",    bg: "bg-cyan-50",    glow: "",  particle: "rgba(0,229,255,0.4)" },
  Contributor: { text: "text-emerald-500", bg: "bg-emerald-50", glow: "",  particle: "rgba(16,185,129,0.5)" },
  Builder:     { text: "text-amber-500",   bg: "bg-amber-50",   glow: "",  particle: "rgba(245,158,11,0.6)" },
  Specialist:  { text: "text-rose-500",    bg: "bg-rose-50",    glow: "",  particle: "rgba(239,68,68,0.7)" },
  Architect:   { text: "text-gray-900",    bg: "bg-gray-100",   glow: "",  particle: "rgba(17,24,39,0.9)" },
};

export const STATUS_COLORS: Record<ProjectStatus, { text: string; bg: string }> = {
  proposed:   { text: "text-violet-400",  bg: "bg-violet-400/10" },
  discussion: { text: "text-cyan-400",    bg: "bg-cyan-400/10" },
  building:   { text: "text-amber-400",   bg: "bg-amber-400/10" },
  shipped:    { text: "text-emerald-400", bg: "bg-emerald-400/10" },
};

export const EVENT_COLORS: Record<string, string> = {
  agent_connected:             "bg-cyan-400",
  agent_profile_updated:       "bg-cyan-400",
  onboarding_suggestions_created: "bg-cyan-400",
  consultation_requested:      "bg-blue-400",
  consultation_result:         "bg-blue-400",
  pr_submitted:                "bg-violet-400",
  pr_reviewed:                 "bg-amber-400",
  pr_merged:                   "bg-emerald-400",
  review_assigned:             "bg-amber-300",
  review_submitted:            "bg-amber-400",
  merge_completed:             "bg-emerald-400",
  ci_started:                  "bg-violet-300",
  ci_completed:                "bg-violet-400",
  repo_created:                "bg-cyan-400",
  project_proposed:            "bg-violet-400",
  project_discussion:          "bg-cyan-400",
  bounty_posted:               "bg-amber-400",
  bounty_completed:            "bg-emerald-400",
  ecosystem_problem:           "bg-rose-400",
  ecosystem_problem_detected:  "bg-rose-400",
  package_published:           "bg-emerald-400",
  reputation_milestone:        "bg-amber-400",
  reputation_updated:          "bg-amber-400",
  trust_updated:               "bg-amber-300",
  security_finding:            "bg-rose-400",
  lock_acquired:               "bg-blue-400",
  lock_released:               "bg-blue-300",
  lock_expired:                "bg-gray-400",
  workflow_started:            "bg-violet-400",
  workflow_step_started:       "bg-violet-300",
  workflow_step_completed:     "bg-violet-400",
  workflow_blocked:            "bg-rose-300",
  pitfall_recorded:            "bg-amber-400",
  project_memory_recorded:     "bg-cyan-300",
  team_formed:                 "bg-emerald-400",
  system_alert:                "bg-rose-500",
};
