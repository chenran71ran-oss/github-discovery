/**
 * 第 3 层：收藏的规则。每个成员只能读写自己的收藏（按会话里的 GitHub ID），管理员也看不到别人的。
 * 收藏保存的是项目快照：项目掉出榜单后，收藏里仍能显示名字、简介和分类。
 */
import { MAX_FAVORITE_BYTES, REPO_NAME } from "./config"
import { configProblem, isSameOriginJson, json } from "./http"
import { createStore, ensureSchema } from "./store"
import type { Context, Favorite, Member } from "./types"

/** 当前成员（以数据库为准，必须是 active）；改动请求还要求同源 JSON */
export async function requireMember(ctx: Context, mutating: boolean): Promise<{ member: Member, store: ReturnType<typeof createStore> } | Response> {
  if (configProblem(ctx.env)) return json({ error: "unavailable" }, 503)
  const session = ctx.data.session
  if (!session) return json({ error: "unauthorized" }, 401)
  if (mutating && !isSameOriginJson(ctx.request)) return json({ error: "bad request" }, 400)
  await ensureSchema(ctx.env.DB!)
  const store = createStore(ctx.env.DB!)
  const member = await store.getMember(session.gid)
  if (member?.status !== "active") return json({ error: "unauthorized" }, 401)
  return { member, store }
}

export interface FavoriteInput {
  repo: string
  data: string
}

/** 校验并序列化一条收藏：必须是带合法全名的对象，序列化后不超过大小上限 */
export function toFavorite(value: unknown): FavoriteInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const repo = (value as { fullName?: unknown }).fullName
  if (typeof repo !== "string" || !REPO_NAME.test(repo)) return null
  const data = JSON.stringify(value)
  if (new TextEncoder().encode(data).length > MAX_FAVORITE_BYTES) return null
  return { repo, data }
}

/** 数据库行 → 前端使用的项目对象；损坏的行跳过 */
export function fromRows(rows: Favorite[]) {
  const items: unknown[] = []
  for (const row of rows) {
    try {
      const value = JSON.parse(row.data) as { fullName?: unknown }
      if (value && value.fullName === row.repo) items.push(value)
    } catch {
      // 跳过
    }
  }
  return items
}
