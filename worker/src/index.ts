// Fork integration: Softween mailer becomes a collector without Gmail or subscribers.
import { Hono } from "hono";
import { periods, type TrendingRepo } from "../../shared/contracts";
import type { Env } from "./types";
import { fetchTrending } from "./lib/scraper";
import { publishSnapshot } from "./lib/db";
import { fetchMeta } from "./lib/github-api";
import { summarizePending } from "./lib/ai-summarizer";
const app = new Hono<{ Bindings: Env }>();
app.get("/", (c) =>
  c.json({ name: "github-discovery-collector", status: "ok" }),
);
app.post("/trigger", async (c) => {
  if (!c.env.TRIGGER_SECRET)
    return c.json({ error: "TRIGGER_SECRET is not configured" }, 503);
  if (c.req.header("Authorization") !== "Bearer " + c.env.TRIGGER_SECRET)
    return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const mode = body.mode === "summarize" ? "summarize" : "collect";
  // Await completion while the caller is connected; never hide minutes of work in HTTP waitUntil (30s).
  const result = await runJob(c.env, mode);
  return c.json(result, result.busy ? 409 : result.success ? 200 : 502);
});
export async function runJob(env: Env, mode: "collect" | "summarize") {
  const id = crypto.randomUUID(),
    at = new Date().toISOString();
  // One database-wide lease also serializes cron and manual requests. Recover abandoned jobs.
  await env.DB.prepare(
    "UPDATE discovery_jobs SET status='expired',finished_at=? WHERE status='running' AND julianday(started_at)<julianday('now','-20 minutes')",
  )
    .bind(at)
    .run();
  try {
    await env.DB.prepare(
      "INSERT INTO discovery_jobs(id,status,started_at) VALUES(?,'running',?)",
    )
      .bind(id, at)
      .run();
  } catch {
    return {
      success: false,
      busy: true,
      id: null,
      published: 0,
      summarized: 0,
    };
  }
  let published = 0,
    summarized = 0;
  const errors: string[] = [];
  try {
    if (mode === "collect") {
      const results = await Promise.allSettled(
        periods.map(async (period) => ({
          period,
          ...(await fetchTrending(period)),
        })),
      );
      const unique = new Map<string, TrendingRepo>();
      for (const result of results) {
        if (result.status === "rejected") {
          errors.push("One period unavailable; retained previous snapshot");
          continue;
        }
        const { period, repos, source } = result.value;
        try {
          await publishSnapshot(env.DB, period, repos, source, at);
          published++;
          for (const repo of repos)
            if (!unique.has(repo.fullName)) unique.set(repo.fullName, repo);
        } catch {
          errors.push("Snapshot write failed; retained previous snapshot");
        }
      }
      // Track some previous-day projects even after they leave Trending. Limit external request budget.
      const budget = env.GITHUB_TOKEN
        ? Math.min(32, Math.max(8, Number(env.META_BATCH_SIZE) || 24))
        : 6;
      const recent = await env.DB.prepare(
        "SELECT full_name FROM discovery_metrics WHERE captured_at>=datetime('now','-2 days') GROUP BY full_name ORDER BY MAX(captured_at) DESC LIMIT ?",
      )
        .bind(Math.floor(budget / 3))
        .all<{ full_name: string }>();
      const names = [
        ...new Set([
          ...recent.results.map((x) => x.full_name),
          ...unique.keys(),
        ]),
      ].slice(0, budget);
      for (let i = 0; i < names.length; i += 4) {
        await Promise.all(
          names.slice(i, i + 4).map(async (name) => {
            try {
              const meta = await fetchMeta(name, env);
              if (!meta) return;
              await env.DB.batch([
                env.DB.prepare(
                  "UPDATE discovery_repos SET topics=?,homepage=?,license=?,created_at=?,pushed_at=? WHERE full_name=?",
                ).bind(
                  JSON.stringify(meta.topics),
                  meta.homepage,
                  meta.license,
                  meta.createdAt,
                  meta.pushedAt,
                  name,
                ),
                env.DB.prepare(
                  "INSERT OR IGNORE INTO discovery_metrics(full_name,captured_at,stars,forks) VALUES(?,?,?,?)",
                ).bind(name, at, meta.stars, meta.forks),
              ]);
            } catch {
              /* Metadata failure cannot erase the published ranking. */
            }
          }),
        );
      }
    }
    const summaryResult = await summarizePending(env);
    summarized = summaryResult.done;
    errors.push(...summaryResult.errors);
    const success =
      mode === "summarize"
        ? summarized > 0 || errors.length === 0
        : published > 0;
    await env.DB.prepare(
      "UPDATE discovery_jobs SET status=?,finished_at=?,published=?,summarized=?,error=? WHERE id=?",
    )
      .bind(
        success ? (errors.length ? "partial" : "success") : "failed",
        new Date().toISOString(),
        published,
        summarized,
        errors.length ? errors.join("; ") : null,
        id,
      )
      .run();
    return {
      success,
      busy: false,
      id,
      published,
      summarized,
      partial: errors.length > 0,
    };
  } catch {
    await env.DB.prepare(
      "UPDATE discovery_jobs SET status='failed',finished_at=?,error='Job failed' WHERE id=?",
    )
      .bind(new Date().toISOString(), id)
      .run();
    return { success: false, busy: false, id, published, summarized };
  }
}
export default {
  fetch: app.fetch,
  scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      runJob(
        env,
        controller.cron === "45 * * * *" ? "summarize" : "collect",
      ).then((r) => {
        console.log(JSON.stringify(r));
      }),
    );
  },
};
