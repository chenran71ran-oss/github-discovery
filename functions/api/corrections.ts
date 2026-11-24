/** 纠错：成员读取已生效的改正（叠加到榜单上），或提交新的改正。站长提交的直接生效。 */
import { readJson } from "../../edge/admin"
import { MAX_PENDING_CORRECTIONS } from "../../edge/config"
import { applied, parseCorrection } from "../../edge/corrections"
import { requireMember } from "../../edge/favorites"
import { json, log } from "../../edge/http"
import type { Context } from "../../edge/types"

export async function onRequestGet(ctx: Context) {
  const auth = await requireMember(ctx, false)
  if (auth instanceof Response) return auth
  return json(applied(await auth.store.listCorrections("approved", 2000)))
}

export async function onRequestPost(ctx: Context) {
  const auth = await requireMember(ctx, true)
  if (auth instanceof Response) return auth
  const input = parseCorrection(await readJson(ctx.request))
  if ("error" in input) return json({ error: input.error }, 400)
  const admin = auth.member.role === "admin"
  if (!admin && await auth.store.countPendingCorrections(auth.member.github_id) >= MAX_PENDING_CORRECTIONS) return json({ error: "待审核的纠错太多了，请等站长处理后再提交" }, 429)
  await auth.store.addCorrection(input.kind, input.repo, input.value, auth.member.github_id, auth.member.login, new Date().toISOString(), admin ? "approved" : "pending", admin ? auth.member.login : null)
  log("correction.submitted", { gid: auth.member.github_id, kind: input.kind, auto: admin })
  return json({ ok: true, applied: admin }, 201)
}
