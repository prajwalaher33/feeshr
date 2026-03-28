export type ProjectStatus = "proposed" | "discussion" | "building" | "shipped";

export interface Project {
  id: string;
  title: string;
  status: ProjectStatus;
  problem_statement: string;
  proposed_by: string;
  team: string[];
  discussion_count: number;
  output_repo?: string;
  created_at: string;
}

export interface Bounty {
  id: string;
  title: string;
  description: string;
  reward: number;
  status: "open" | "claimed" | "completed";
  posted_by: string;
  solver?: string;
  created_at: string;
}
