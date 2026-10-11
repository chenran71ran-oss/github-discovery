import type { Env } from "../types";
const headers = (env: Env, accept = "application/vnd.github+json") => ({
  "User-Agent": "GitHub-Discovery/0.1",
  Accept: accept,
  ...(env.GITHUB_TOKEN ? { Authorization: "Bearer " + env.GITHUB_TOKEN } : {}),
});
export async function fetchMeta(
  fullName: string,
  env: Env,
): Promise<{
  stars: number;
  forks: number;
  topics: string[];
  homepage: string;
  license: string;
  createdAt: string;
  pushedAt: string;
} | null> {
  const response = await fetch("https://api.github.com/repos/" + fullName, {
    headers: headers(env),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return null;
  const r = (await response.json()) as {
    stargazers_count: number;
    forks_count: number;
    topics?: string[];
    homepage?: string;
    license?: { spdx_id?: string };
    created_at: string;
    pushed_at: string;
  };
  if (
    !Number.isSafeInteger(r.stargazers_count) ||
    !Number.isSafeInteger(r.forks_count)
  )
    return null;
  return {
    stars: r.stargazers_count,
    forks: r.forks_count,
    topics: (r.topics ?? []).slice(0, 12),
    homepage: r.homepage ?? "",
    license: r.license?.spdx_id ?? "",
    createdAt: r.created_at,
    pushedAt: r.pushed_at,
  };
}
export async function fetchReadme(
  fullName: string,
  env: Env,
): Promise<string | null> {
  const response = await fetch(
    "https://api.github.com/repos/" + fullName + "/readme",
    {
      headers: headers(env, "application/vnd.github.raw+json"),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) return null;
  return (await response.text()).slice(0, 10000);
}
