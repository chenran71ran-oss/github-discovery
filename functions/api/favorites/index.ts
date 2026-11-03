/** 当前成员的收藏：读取、收藏一个项目、取消收藏 */
import { readJson } from "../../../edge/admin"
import { MAX_FAVORITES, REPO_NAME } from "../../../edge/config"
import { fromRows, requireMember, toFavorite } from "../../../edge/favorites"
import { json } from "../../../edge/http"
import type { Context } from "../../../edge/types"

export async function onRequestGet(ctx: Context) {
  const auth = await requireMember(ctx, false)
  if (auth instanceof Response) return auth
  return json({ items: fromRows(await auth.store.listFavorites(auth.member.github_id)) })
}

export async function onRequestPut(ctx: Context) {
  const auth = await requireMember(ctx, true)
  if (auth instanceof Response) return auth
  const favorite = toFavorite((await readJson(ctx.request)).repo)
  if (!favorite) return json({ error: "项目数据不正确" }, 400)
  const id = auth.member.github_id
  const existing = await auth.store.hasFavorite(id, favorite.repo)
  if (!existing && await auth.store.countFavorites(id) >= MAX_FAVORITES) return json({ error: `收藏已达上限（${MAX_FAVORITES} 个）` }, 409)
  await auth.store.putFavorite(id, favorite.repo, favorite.data, new Date().toISOString())
  return json({ ok: true })
}

export async function onRequestDelete(ctx: Context) {
  const auth = await requireMember(ctx, true)
  if (auth instanceof Response) return auth
  const repo = (await readJson(ctx.request)).fullName
  if (typeof repo !== "string" || !REPO_NAME.test(repo)) return json({ error: "项目名不正确" }, 400)
  await auth.store.deleteFavorite(auth.member.github_id, repo)
  return json({ ok: true })
}
