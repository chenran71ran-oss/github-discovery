import type { D1Database } from "@cloudflare/workers-types";
import {
  classify,
  risingScore,
  summarySchema,
  type DiscoveryQuery,
  type Listing,
  type Repo,
} from "../../shared/contracts";
interface Row {
  full_name: string;
  owner: string;
  name: string;
  description: string;
  language: string;
  topics: string;
  homepage: string;
  license: string;
  created_at: string;
  pushed_at: string;
  readme: string | null;
  summary: string | null;
  summary_status: Repo["summaryStatus"];
  stars: number;
  forks: number;
  period_stars: number;
  rank: number;
}
function array(text: string): string[] {
  try {
    const v = JSON.parse(text);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
export function parseRepo(row: Row): Repo {
  let summary = null;
  try {
    const v = summarySchema.safeParse(JSON.parse(row.summary ?? "null"));
    if (v.success) summary = v.data;
  } catch {}
  return {
    fullName: row.full_name,
    owner: row.owner,
    name: row.name,
    description: row.description,
    language: row.language,
    stars: row.stars,
    forks: row.forks,
    periodStars: row.period_stars,
    rank: row.rank,
    url: "https://github.com/" + row.full_name,
    summary,
    topics: array(row.topics),
    homepage: row.homepage,
    license: row.license,
    createdAt: row.created_at,
    pushedAt: row.pushed_at,
    readme: row.readme,
    summaryStatus: row.summary_status,
    delta24h: null,
    intervalHours: null,
    risingScore: null,
  };
}
const selectRepo = "r.*, e.rank, e.stars, e.forks, e.period_stars";
export async function getListing(
  db: D1Database,
  query: DiscoveryQuery,
): Promise<Listing> {
  const dates = await db
    .prepare(
      "SELECT DISTINCT date(captured_at,'+8 hours') date FROM discovery_snapshots WHERE status='ready' ORDER BY date DESC LIMIT 90",
    )
    .all<{ date: string }>();
  const empty: Listing = {
    repos: [],
    period: query.period,
    capturedAt: null,
    source: null,
    stale: false,
    total: 0,
    languages: [],
    dates: dates.results.map((x) => x.date),
    sampled: 0,
    ready: false,
  };
  const period = query.period === "rising" ? "daily" : query.period;
  const snapshot = query.date
    ? await db
        .prepare(
          "SELECT * FROM discovery_snapshots WHERE status='ready' AND period=? AND date(captured_at,'+8 hours')=? ORDER BY captured_at DESC LIMIT 1",
        )
        .bind(period, query.date)
        .first<{ id: string; captured_at: string; source: string }>()
    : await db
        .prepare(
          "SELECT * FROM discovery_snapshots WHERE status='ready' AND period=? ORDER BY captured_at DESC LIMIT 1",
        )
        .bind(period)
        .first<{ id: string; captured_at: string; source: string }>();
  if (!snapshot) return empty;
  let repos: Repo[];
  let sampled = 0;
  if (query.period === "rising") {
    const rows = await db
      .prepare(
        `SELECT r.*,0 rank,m.stars,m.forks,0 period_stars,m.captured_at current_at,b.captured_at baseline_at,b.stars baseline_stars,b.forks baseline_forks
 FROM discovery_metrics m JOIN discovery_repos r ON r.full_name=m.full_name
 JOIN discovery_metrics b ON b.full_name=m.full_name AND b.captured_at=(SELECT x.captured_at FROM discovery_metrics x WHERE x.full_name=m.full_name AND (julianday(m.captured_at)-julianday(x.captured_at))*24 BETWEEN 22 AND 26 ORDER BY x.captured_at DESC LIMIT 1)
 WHERE m.captured_at=(SELECT MAX(x.captured_at) FROM discovery_metrics x WHERE x.full_name=m.full_name AND x.captured_at<=?) AND (julianday(?)-julianday(m.captured_at))*24 BETWEEN 0 AND 8`,
      )
      .bind(snapshot.captured_at, snapshot.captured_at)
      .all<
        Row & {
          current_at: string;
          baseline_at: string;
          baseline_stars: number;
          baseline_forks: number;
        }
      >();
    sampled = rows.results.length;
    repos = rows.results
      .map((row) => ({
        ...parseRepo(row),
        delta24h: row.stars - row.baseline_stars,
        intervalHours:
          (Date.parse(row.current_at) - Date.parse(row.baseline_at)) / 3600000,
        risingScore: risingScore(
          row.stars - row.baseline_stars,
          row.baseline_stars,
          row.forks - row.baseline_forks,
        ),
      }))
      .filter((r) => (r.delta24h ?? 0) > 0)
      .sort((a, b) => (b.risingScore ?? 0) - (a.risingScore ?? 0))
      .map((r, i) => ({ ...r, rank: i + 1 }));
  } else {
    const rows = await db
      .prepare(
        `SELECT ${selectRepo} FROM discovery_entries e JOIN discovery_repos r ON r.full_name=e.full_name WHERE e.snapshot_id=? ORDER BY e.rank`,
      )
      .bind(snapshot.id)
      .all<Row>();
    repos = rows.results.map((row) => ({ ...parseRepo(row), readme: null }));
  }
  const total = repos.length;
  const languages = [
    ...new Set(repos.map((r) => r.language).filter(Boolean)),
  ].sort();
  const q = query.q.toLocaleLowerCase();
  repos = repos.filter(
    (r) =>
      (!query.language || r.language === query.language) &&
      (!query.category ||
        (r.summary?.categories ?? classify(r.description, r.topics)).includes(
          query.category,
        )) &&
      (!q ||
        (
          r.fullName +
          " " +
          r.description +
          " " +
          (r.summary?.summary ?? "") +
          " " +
          (r.summary?.useCase ?? "") +
          " " +
          (r.summary?.techStack.join(" ") ?? "") +
          " " +
          r.topics.join(" ")
        )
          .toLocaleLowerCase()
          .includes(q)),
  );
  if (query.sort === "stars") repos.sort((a, b) => b.stars - a.stars);
  if (query.sort === "growth")
    repos.sort(
      (a, b) => (b.delta24h ?? b.periodStars) - (a.delta24h ?? a.periodStars),
    );
  return {
    ...empty,
    repos,
    total,
    languages,
    sampled,
    ready: query.period !== "rising" || sampled > 0,
    capturedAt: snapshot.captured_at,
    source: snapshot.source,
    stale: Date.now() - Date.parse(snapshot.captured_at) > 9 * 3600000,
  };
}
export async function getRepoDetail(
  db: D1Database,
  fullName: string,
): Promise<{
  repo: Repo;
  history: {
    capturedAt: string;
    stars: number;
    period: string;
    rank: number;
  }[];
} | null> {
  const row = await db
    .prepare(
      `SELECT ${selectRepo} FROM discovery_repos r JOIN discovery_entries e ON e.full_name=r.full_name JOIN discovery_snapshots s ON s.id=e.snapshot_id WHERE r.full_name=? AND s.status='ready' ORDER BY s.captured_at DESC,e.rank LIMIT 1`,
    )
    .bind(fullName)
    .first<Row>();
  if (!row) return null;
  const history = await db
    .prepare(
      "SELECT s.captured_at capturedAt,e.stars,s.period,e.rank FROM discovery_entries e JOIN discovery_snapshots s ON s.id=e.snapshot_id WHERE e.full_name=? AND s.status='ready' ORDER BY s.captured_at DESC LIMIT 60",
    )
    .bind(fullName)
    .all<{ capturedAt: string; stars: number; period: string; rank: number }>();
  return { repo: parseRepo(row), history: history.results };
}
