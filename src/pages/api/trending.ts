import type { APIRoute } from "astro";
import { querySchema } from "../../../shared/contracts";
import { getListing } from "../../lib/db";
export const GET: APIRoute = async ({ url, locals }) => {
  const query = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success)
    return Response.json({ error: "筛选参数无效" }, { status: 400 });
  try {
    const listing = await getListing(locals.runtime.env.DB, query.data);
    return Response.json(listing, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
    });
  } catch {
    return Response.json(
      { error: "数据暂时不可用，请稍后重试" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
};
