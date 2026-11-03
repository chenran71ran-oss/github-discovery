/** 第一次登录时，把浏览器里已有的收藏导入账号；账号里已有的不覆盖，超出上限的部分忽略 */
import { readJson } from "../../../edge/admin"
import { MAX_FAVORITES } from "../../../edge/config"
import { fromRows, requireMember, toFavorite } from "../../../edge/favorites"
import { json, log } from "../../../edge/http"
import type { Context } from "../../../edge/types"

export async function onRequestPost(ctx: Context) {
  const auth = await requireMember(ctx, true)
  if (auth instanceof Response) return auth
  const raw = (await readJson(ctx.request)).items
  if (!Array.isArray(raw)) return json({ error: "收藏数据不正确" }, 400)
  const id = auth.member.github_id
  const current = await auth.store.listFavorites(id)
  const have = new Set(current.map(f => f.repo))
  // 已有的条目由数据库按主键跳过，这里只是少发几条语句
  const fresh = new Map<string, string>()
  for (const value of raw.slice(0, MAX_FAVORITES)) {
    const f = toFavorite(value)
    if (f && !have.has(f.repo)) fresh.set(f.repo, f.data)
  }
  const room = Math.max(0, MAX_FAVORITES - current.length)
  const items = [...fresh].slice(0, room).map(([repo, data]) => ({ repo, data }))
  if (items.length) await auth.store.importFavorites(id, items, new Date().toISOString())
  log("favorites.imported", { gid: id, count: items.length })
  return json({ imported: items.length, items: fromRows(await auth.store.listFavorites(id)) })
}
