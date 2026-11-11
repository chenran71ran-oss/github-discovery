/** 当前成员看过的项目：读取最近的记录、记下新看过的。每人只能读写自己的。 */
import { readJson } from "../../edge/admin"
import { MAX_SEEN, REPO_NAME, SEEN_BATCH, SEEN_DAYS } from "../../edge/config"
import { requireMember } from "../../edge/favorites"
import { json } from "../../edge/http"
import type { Context } from "../../edge/types"

const since = (now: number) => new Date(now - SEEN_DAYS * 86400_000).toISOString()

export async function onRequestGet(ctx: Context) {
  const auth = await requireMember(ctx, false)
  if (auth instanceof Response) return auth
  return json({ repos: await auth.store.listSeen(auth.member.github_id, since(Date.now()), MAX_SEEN) })
}

export async function onRequestPost(ctx: Context) {
  const auth = await requireMember(ctx, true)
  if (auth instanceof Response) return auth
  const raw = (await readJson(ctx.request)).repos
  if (!Array.isArray(raw) || raw.length > SEEN_BATCH) return json({ error: "记录数据不正确" }, 400)
  const repos = [...new Set(raw.filter((r): r is string => typeof r === "string" && REPO_NAME.test(r)))]
  if (repos.length) await auth.store.markSeen(auth.member.github_id, repos, new Date().toISOString(), since(Date.now()))
  return json({ ok: true, count: repos.length })
}
