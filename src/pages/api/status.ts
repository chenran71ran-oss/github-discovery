import type { APIRoute } from "astro";
export const GET: APIRoute = async ({ locals }) => {
  try {
    const jobs = await locals.runtime.env.DB.prepare(
      "SELECT status,started_at,finished_at,published,summarized,error FROM discovery_jobs ORDER BY started_at DESC LIMIT 5",
    ).all();
    const summaries = await locals.runtime.env.DB.prepare(
      "SELECT summary_status status,COUNT(*) count FROM discovery_repos GROUP BY summary_status",
    ).all();
    return Response.json(
      { jobs: jobs.results, summaries: summaries.results },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "数据库未就绪" }, { status: 503 });
  }
};
