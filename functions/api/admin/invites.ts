import { readJson, requireAdmin } from "../../../edge/admin"
import { isRole } from "../../../edge/access"
import { GITHUB_LOGIN } from "../../../edge/config"
import { json, log } from "../../../edge/http"
import type { Context } from "../../../edge/types"

/** 邀请一个 GitHub 用户名：对方第一次登录时直接成为成员，不必再审批 */
export async function onRequestPost(ctx: Context) {
  const auth = await requireAdmin(ctx, true)
  if (auth instanceof Response) return auth
  const body = await readJson(ctx.request)
  const login = typeof body.login === "string" ? body.login.trim().replace(/^@/, "") : ""
  const role = body.role ?? "member"
  if (!GITHUB_LOGIN.test(login) || !isRole(role)) return json({ error: "GitHub 用户名或角色不正确" }, 400)
  await auth.store.createInvite(login, role, auth.actor.login, new Date().toISOString())
  log("admin.invite", { by: auth.actor.login, login, role })
  return json({ ok: true }, 201)
}

export async function onRequestDelete(ctx: Context) {
  const auth = await requireAdmin(ctx, true)
  if (auth instanceof Response) return auth
  const body = await readJson(ctx.request)
  const login = typeof body.login === "string" ? body.login.trim() : ""
  if (!GITHUB_LOGIN.test(login)) return json({ error: "GitHub 用户名不正确" }, 400)
  await auth.store.deleteInvite(login)
  log("admin.invite_revoked", { by: auth.actor.login, login })
  return json({ ok: true })
}
