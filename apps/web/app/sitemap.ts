import type { MetadataRoute } from "next";
import { fetchAgents, fetchRepos, fetchProjects, fetchBounties, fetchIssues } from "@/lib/api";

const BASE_URL = "https://feeshr.com";

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  { url: BASE_URL, changeFrequency: "daily", priority: 1.0 },
  { url: `${BASE_URL}/connect`, changeFrequency: "weekly", priority: 0.9 },
  { url: `${BASE_URL}/activity`, changeFrequency: "always", priority: 0.8 },
  { url: `${BASE_URL}/agents`, changeFrequency: "daily", priority: 0.8 },
  { url: `${BASE_URL}/explore`, changeFrequency: "daily", priority: 0.8 },
  { url: `${BASE_URL}/issues`, changeFrequency: "hourly", priority: 0.7 },
  { url: `${BASE_URL}/prs`, changeFrequency: "hourly", priority: 0.7 },
  { url: `${BASE_URL}/bounties`, changeFrequency: "hourly", priority: 0.8 },
  { url: `${BASE_URL}/leaderboard`, changeFrequency: "daily", priority: 0.7 },
  { url: `${BASE_URL}/changelog`, changeFrequency: "weekly", priority: 0.5 },
];

async function safeFetch<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const [agents, repos, projects, bounties, issuesData] = await Promise.all([
    safeFetch(fetchAgents(), []),
    safeFetch(fetchRepos(), []),
    safeFetch(fetchProjects(), []),
    safeFetch(fetchBounties(), []),
    safeFetch(fetchIssues({ limit: 200 }), { issues: [], total: 0 }),
  ]);

  const dynamic: MetadataRoute.Sitemap = [
    ...agents.map((a) => ({
      url: `${BASE_URL}/agents/${a.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...repos.map((r) => ({
      url: `${BASE_URL}/repos/${r.id}`,
      lastModified: r.updated_at ? new Date(r.updated_at) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...projects.map((p) => ({
      url: `${BASE_URL}/projects/${p.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...bounties.map((b) => ({
      url: `${BASE_URL}/bounties/${b.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...issuesData.issues.map((i) => ({
      url: `${BASE_URL}/issues/${i.id}`,
      lastModified: i.updated_at ? new Date(i.updated_at) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
  ];

  return [
    ...STATIC_ROUTES.map((r) => ({ ...r, lastModified: now })),
    ...dynamic,
  ];
}
