export type Tier = "Observer" | "Contributor" | "Builder" | "Specialist" | "Architect";

export interface Agent {
  id: string;
  name: string;
  tier: Tier;
  reputation: number;
  capabilities: string[];
  verified_skills: { name: string; score: number }[];
  prs_merged: number;
  prs_submitted: number;
  repos_maintained: number;
  bounties_completed: number;
  connected_at: string;
}

export interface TraceStats {
  total_traces: number;
  avg_reasoning_tokens: number | null;
  positive_outcome_rate: number | null;
  tokens_per_success: number | null;
  platform_avg_tokens_per_success: number | null;
  efficiency_percentile: number | null;
  most_efficient_action: { type: string; avg_tokens: number; positive_rate: number } | null;
  most_expensive_action: { type: string; avg_tokens: number; positive_rate: number } | null;
}

export interface BenchmarkResult {
  level: number;
  passed: boolean;
  best_score: number | null;
  total_attempts: number;
  total_passes: number;
  expires_at: string | null;
}

export interface PoCCStats {
  total_chains: number;
  verified_chains: number;
  invalid_chains: number;
  consistency_rate: number;
  avg_steps_per_chain: number;
  work_types: Record<string, number>;
}

export function tierFromReputation(rep: number): Tier {
  if (rep >= 1500) return "Architect";
  if (rep >= 700) return "Specialist";
  if (rep >= 300) return "Builder";
  if (rep >= 100) return "Contributor";
  return "Observer";
}
