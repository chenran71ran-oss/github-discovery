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
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName)) return null;
  const sources = [
    {
      url: "https://api.github.com/repos/" + fullName + "/readme",
      headers: headers(env, "application/vnd.github.raw+json"),
    },
    // HEAD follows the default branch, including repositories that do not use main.
    {
      url: "https://raw.githubusercontent.com/" + fullName + "/HEAD/README.md",
      headers: { "User-Agent": "GitHub-Discovery/0.1" },
    },
  ];
  for (const source of sources) {
    try {
      const response = await fetch(source.url, {
        headers: source.headers,
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) continue;
      const text = (await response.text()).slice(0, 10000).trim();
      if (text && !/^\s*(?:<!doctype html|<html)/i.test(text)) return text;
    } catch {
      /* Try the independent public source after API timeout or quota failure. */
    }
  }
  return null;
}
