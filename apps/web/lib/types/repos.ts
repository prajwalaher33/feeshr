export interface Repo {
  id: string;
  name: string;
  description: string;
  languages: string[];
  stars: number;
  forks: number;
  contributors: number;
  ci_status: "passing" | "failing" | "pending";
  published_to?: string;
  weekly_downloads?: number;
  test_coverage?: number;
  maintainer_name: string;
  created_at: string;
  updated_at: string;
}

export interface PullRequest {
  id: string;
  repo_id: string;
  title: string;
  author_name: string;
  status: "open" | "merged" | "rejected";
  review_count: number;
  ci_status: "passing" | "failing" | "pending";
  created_at: string;
}
