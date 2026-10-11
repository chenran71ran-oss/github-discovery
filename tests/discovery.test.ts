import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  afterEach,
} from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync } from "node:fs";
import { runJob } from "../worker/src/index";
import worker from "../worker/src/index";
import { publishSnapshot } from "../worker/src/lib/db";
import { getListing } from "../src/lib/db";
import {
  parseBackup,
  parseNumber,
  parseTrendingHtml,
} from "../worker/src/lib/scraper";
import { parseSummaryResponse } from "../worker/src/lib/ai-summarizer";
import { querySchema, type TrendingRepo } from "../shared/contracts";
import type { D1Database } from "@cloudflare/workers-types";
let mf: Miniflare, db: D1Database;
const sample = (name: string, i = 0): TrendingRepo => ({
  fullName: "owner/" + name,
  owner: "owner",
  name,
  description: "self-hosted dashboard",
  language: i % 2 ? "Python" : "TypeScript",
  stars: 1000 + i,
  forks: 50,
  periodStars: 100 + i,
  rank: i + 1,
});
const repos = Array.from({ length: 5 }, (_, i) => sample("repo" + i, i));
beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("ok")}}',
    d1Databases: ["DB"],
    compatibilityDate: "2026-10-01",
  });
  db = (await mf.getD1Database("DB")) as unknown as D1Database;
  const sql = readFileSync(
    new URL("../migrations/0001_discovery.sql", import.meta.url),
    "utf8",
  );
  for (const stmt of sql.split(";").filter((s) => s.trim()))
    await db.prepare(stmt).run();
});
afterAll(async () => {
  await mf?.dispose();
});
beforeEach(async () => {
  for (const table of [
    "discovery_jobs",
    "discovery_entries",
    "discovery_snapshots",
    "discovery_metrics",
    "discovery_repos",
  ])
    await db.prepare("DELETE FROM " + table).run();
});
describe("production data flow", () => {
  it("preserves daily and weekly membership and combines date + language + category + search", async () => {
    const at = "2026-10-09T06:15:00.000Z";
    await publishSnapshot(db, "daily", repos, "github-trending", at);
    await publishSnapshot(db, "weekly", repos, "github-trending", at);
    const result = await getListing(
      db,
      querySchema.parse({
        period: "weekly",
        date: "2026-10-09",
        language: "TypeScript",
        category: "Self-hosted",
        q: "repo2",
      }),
    );
    expect(result.repos.map((r) => r.fullName)).toEqual(["owner/repo2"]);
    expect(result.period).toBe("weekly");
    expect(result.total).toBe(5);
    expect(
      (await getListing(db, querySchema.parse({ period: "daily" }))).repos,
    ).toHaveLength(5);
  });
  it("rolls back a failed publish and keeps the last complete snapshot", async () => {
    await publishSnapshot(
      db,
      "daily",
      repos,
      "github-trending",
      "2026-10-08T06:00:00.000Z",
    );
    await expect(
      publishSnapshot(
        db,
        "daily",
        [repos[0], ...repos],
        "github-trending",
        "2026-10-09T06:00:00.000Z",
      ),
    ).rejects.toThrow();
    const result = await getListing(db, querySchema.parse({}));
    expect(result.capturedAt).toBe("2026-10-08T06:00:00.000Z");
    expect(result.repos).toHaveLength(5);
    expect(
      (await db
        .prepare("SELECT COUNT(*) n FROM discovery_snapshots")
        .first<{ n: number }>())!.n,
    ).toBe(1);
  });
  it("uses observed approximately 24h deltas and excludes repos without a baseline", async () => {
    const at = "2026-10-09T06:00:00.000Z";
    await publishSnapshot(db, "daily", repos, "github-trending", at);
    for (const [name, stars, forks, time] of [
      ["owner/repo0", 1000, 50, "2026-10-08T06:00:00.000Z"],
      ["owner/repo0", 1200, 70, at],
      ["owner/repo1", 1100, 50, at],
    ] as const)
      await db
        .prepare(
          "INSERT INTO discovery_metrics(full_name,stars,forks,captured_at) VALUES(?,?,?,?)",
        )
        .bind(name, stars, forks, time)
        .run();
    const result = await getListing(
      db,
      querySchema.parse({ period: "rising" }),
    );
    expect(result.sampled).toBe(1);
    expect(result.repos).toHaveLength(1);
    expect(result.repos[0].delta24h).toBe(200);
    expect(result.repos[0].intervalHours).toBe(24);
    expect(result.repos[0].risingScore).toBeGreaterThan(0);
  });
  it("shows accumulating state when no valid 24h baseline exists", async () => {
    await publishSnapshot(
      db,
      "daily",
      repos,
      "github-trending",
      "2026-10-09T06:00:00.000Z",
    );
    const result = await getListing(
      db,
      querySchema.parse({ period: "rising" }),
    );
    expect(result.ready).toBe(false);
    expect(result.repos).toEqual([]);
  });
});
describe("upstream boundaries", () => {
  it("parses varied class order, HTML entities, counters and original ranking", () => {
    const html =
      '<article class="extra Box-row"><h2><a href="/acme/project"> acme / project </a></h2><p class="color-fg-muted col-9">Tools &amp; apps</p><span itemprop="programmingLanguage">TypeScript</span><a href="/acme/project/stargazers">12,345</a><a href="/acme/project/forks">1.2k</a><span>678 stars this week</span></article>';
    const [r] = parseTrendingHtml(html);
    expect(r).toMatchObject({
      fullName: "acme/project",
      description: "Tools & apps",
      stars: 12345,
      forks: 1200,
      periodStars: 678,
      rank: 1,
    });
  });
  it("parses the real backup envelope and rejects stale data", () => {
    const payload = {
      pubDate: new Date().toUTCString(),
      items: repos.map((r) => ({
        title: r.fullName,
        url: "https://github.com/" + r.fullName,
        stars: "1,000",
        forks: "50",
        addStars: "100",
      })),
    };
    expect(parseBackup(payload).repos).toHaveLength(5);
    expect(() =>
      parseBackup({ ...payload, pubDate: "Wed, 26 Aug 2026 13:56:53 GMT" }),
    ).toThrow();
    expect(parseNumber("1.5k")).toBe(1500);
  });
  it("validates AI output instead of inventing a fallback Chinese summary", () => {
    expect(parseSummaryResponse("not json")).toBeNull();
    expect(
      parseSummaryResponse(
        JSON.stringify({
          summary: "这是一个工具项目。",
          useCase: "搭建监控面板",
          techStack: ["TypeScript"],
          highlights: ["自动采集"],
          categories: ["unknown"],
        }),
      ),
    ).toBeNull();
    expect(
      parseSummaryResponse(
        JSON.stringify({
          summary: "这是一个工具项目。",
          useCase: "搭建监控面板",
          techStack: ["TypeScript"],
          highlights: ["自动采集"],
          categories: ["Dashboard"],
        }),
      ),
    ).not.toBeNull();
  });
  it("rejects invalid calendar dates and unsupported periods", () => {
    expect(querySchema.safeParse({ date: "2026-02-31" }).success).toBe(false);
    expect(querySchema.safeParse({ period: "yearly" }).success).toBe(false);
  });
});

afterEach(() => vi.restoreAllMocks());
describe("collector orchestration", () => {
  it("publishes healthy periods and keeps the previous monthly snapshot after a source failure", async () => {
    await publishSnapshot(
      db,
      "monthly",
      repos,
      "github-trending",
      "2026-10-08T06:00:00.000Z",
    );
    const html = repos
      .map(
        (r) =>
          `<article class="Box-row"><h2><a href="/${r.fullName}">${r.name}</a></h2><p>self-hosted dashboard</p><span itemprop="programmingLanguage">${r.language}</span><a href="/${r.fullName}/stargazers">1500</a><a href="/${r.fullName}/forks">50</a><span>100 stars today</span></article>`,
      )
      .join("");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (
        url.includes("since=monthly") ||
        url.includes("raw.githubusercontent.com")
      )
        return new Response("", { status: 503 });
      if (url.includes("github.com/trending")) return new Response(html);
      return Response.json({
        stargazers_count: 1500,
        forks_count: 50,
        topics: ["self-hosted"],
        created_at: "2020-01-01T00:00:00Z",
        pushed_at: "2026-10-09T00:00:00Z",
      });
    });
    const result = await runJob({ DB: db }, "collect");
    expect(result.success).toBe(true);
    expect(result.published).toBe(2);
    expect(
      (await getListing(db, querySchema.parse({ period: "monthly" })))
        .capturedAt,
    ).toBe("2026-10-08T06:00:00.000Z");
    expect(
      (await getListing(db, querySchema.parse({ period: "weekly" }))).repos,
    ).toHaveLength(5);
  });
  it("blocks concurrent jobs using the database-wide lease", async () => {
    await db
      .prepare(
        "INSERT INTO discovery_jobs(id,status,started_at) VALUES('other','running',?)",
      )
      .bind(new Date().toISOString())
      .run();
    const result = await runJob({ DB: db }, "collect");
    expect(result.busy).toBe(true);
    expect(result.published).toBe(0);
  });
  it("rejects manual triggers when the secret is missing or wrong", async () => {
    const missing = await worker.fetch(
      new Request("http://collector/trigger", { method: "POST" }),
      { DB: db },
      {} as ExecutionContext,
    );
    expect(missing.status).toBe(503);
    const wrong = await worker.fetch(
      new Request("http://collector/trigger", {
        method: "POST",
        headers: { Authorization: "Bearer wrong" },
      }),
      { DB: db, TRIGGER_SECRET: "correct" },
      {} as ExecutionContext,
    );
    expect(wrong.status).toBe(401);
  });
});
