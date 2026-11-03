/**
 * 第 3 层：管理接口的公共检查。权限一律以数据库里的当前角色为准，不信任 Cookie 里可能过时的角色。
 */
import { configProblem, isSameOriginJson, json, log } from "./http"
import { createStore, ensureSchema } from "./store"
import type { Context, Member } from "./types"

export async function requireAdmin(ctx: Context, mutating: boolean): Promise<{ actor: Member, store: ReturnType<typeof createStore> } | Response> {
  if (configProblem(ctx.env)) return json({ error: "unavailable" }, 503)
  const session = ctx.data.session
  if (!session) return json({ error: "unauthorized" }, 401)
  if (mutating && !isSameOriginJson(ctx.request)) return json({ error: "bad request" }, 400)
  await ensureSchema(ctx.env.DB!)
  const store = createStore(ctx.env.DB!)
  const actor = await store.getMember(session.gid)
  if (!actor || actor.status !== "active" || actor.role !== "admin") {
    log("admin.denied", { gid: session.gid })
    return json({ error: "forbidden" }, 403)
  }
  return { actor, store }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json()
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
  } catch {
    return {}
  }
}
