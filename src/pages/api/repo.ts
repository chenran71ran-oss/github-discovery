import type { APIRoute } from "astro";
import { getRepoDetail } from "../../lib/db";
export const GET: APIRoute = async ({ url, locals }) => {
  const name = url.searchParams.get("name") ?? "";
  if (!/^[\w.-]+\/[\w.-]+$/.test(name))
    return Response.json({ error: "仓库名称无效" }, { status: 400 });
  try {
    const detail = await getRepoDetail(locals.runtime.env.DB, name);
    return detail
      ? Response.json(detail, {
          headers: { "Cache-Control": "public, max-age=60" },
        })
      : Response.json({ error: "未找到项目" }, { status: 404 });
  } catch {
    return Response.json({ error: "数据暂时不可用" }, { status: 503 });
  }
};
