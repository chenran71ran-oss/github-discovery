// Derived from Softween's scraper; DOM selection replaces fragile exact-class regexes.
import { load } from "cheerio/slim";
import { z } from "zod";
import type { Period, TrendingRepo } from "../../../shared/contracts";
export function parseNumber(text: string): number {
  const cleaned = text.replace(/,/g, "").trim();
  const m = cleaned.match(/^(\d+(?:\.\d+)?)([km])?/i);
  return m
    ? Math.round(
        Number(m[1]) *
          (m[2]?.toLowerCase() === "k"
            ? 1000
            : m[2]?.toLowerCase() === "m"
              ? 1000000
              : 1),
      )
    : 0;
}
export function parseTrendingHtml(html: string): TrendingRepo[] {
  const $ = load(html);
  const result: TrendingRepo[] = [];
  $("article.Box-row").each((_, el) => {
    const a = $(el);
    const fullName = (a.find("h2 a").attr("href") ?? "")
      .replace(/^\//, "")
      .trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(fullName)) return;
    const [owner, name] = fullName.split("/");
    const text = a.text();
    const p = text.match(/([\d,]+)\s+stars\s+(today|this week|this month)/i);
    result.push({
      fullName,
      owner,
      name,
      description: a.find("p").first().text().trim(),
      language: a.find('[itemprop="programmingLanguage"]').text().trim(),
      stars: parseNumber(a.find('a[href$="/stargazers"]').text()),
      forks: parseNumber(a.find('a[href$="/forks"]').text()),
      periodStars: p ? parseNumber(p[1]) : 0,
      rank: result.length + 1,
    });
  });
  return result;
}
export async function fetchText(
  url: string,
  headers: Record<string, string> = {},
): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "GitHub-Discovery/0.1",
      Accept: "text/html",
      ...headers,
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Upstream HTTP " + response.status);
  return response.text();
}
const backupItem = z.object({
  title: z.string(),
  url: z.string(),
  description: z.string().optional(),
  language: z.string().nullable().optional(),
  stars: z.union([z.number(), z.string()]),
  forks: z.union([z.number(), z.string()]),
  addStars: z.union([z.number(), z.string()]),
});
const backupSchema = z.object({
  pubDate: z.string(),
  items: z.array(backupItem).min(5).max(100),
});
export function parseBackup(data: unknown): {
  repos: TrendingRepo[];
  publishedAt: string;
} {
  const parsed = backupSchema.parse(data);
  const at = Date.parse(parsed.pubDate);
  if (
    !Number.isFinite(at) ||
    Date.now() - at > 36 * 3600000 ||
    at > Date.now() + 3600000
  )
    throw new Error("Backup is stale or has an invalid timestamp");
  const repos = parsed.items.map((r, i) => {
    const fullName = r.url
      .replace(/^https:\/\/github.com\//, "")
      .replace(/\/$/, "");
    if (!/^[\w.-]+\/[\w.-]+$/.test(fullName))
      throw new Error("Invalid backup repository");
    const [owner, name] = fullName.split("/");
    return {
      fullName,
      owner,
      name,
      description: r.description ?? "",
      language: r.language ?? "",
      stars: parseNumber(String(r.stars)),
      forks: parseNumber(String(r.forks)),
      periodStars: parseNumber(String(r.addStars)),
      rank: i + 1,
    };
  });
  return { repos, publishedAt: new Date(at).toISOString() };
}
export async function fetchTrending(
  period: Period,
): Promise<{ repos: TrendingRepo[]; source: string }> {
  try {
    const repos = parseTrendingHtml(
      await fetchText("https://github.com/trending?since=" + period),
    );
    if (repos.length < 5)
      throw new Error("Trending returned too few repositories");
    return { repos, source: "github-trending" };
  } catch {
    const response = await fetch(
      "https://raw.githubusercontent.com/isboyjc/github-trending-api/main/data/" +
        period +
        "/all.json",
      { signal: AbortSignal.timeout(15000) },
    );
    if (!response.ok) throw new Error("Trending and backup are unavailable");
    const backup = parseBackup(await response.json());
    return {
      repos: backup.repos,
      source: "isboyjc-json (" + backup.publishedAt + ")",
    };
  }
}
