import type { APIRoute } from "astro";
export const GET: APIRoute = async ({ locals }) => {
  try {
    const jobs = await locals.runtime.env.DB.prepare(
      "SELECT status,started_at,finished_at,published,summarized FROM discovery_jobs ORDER BY started_at DESC LIMIT 5",
    ).all();
    return Response.json(
      { jobs: jobs.results },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "数据库未就绪" }, { status: 503 });
  }
};
