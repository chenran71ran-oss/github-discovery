import { readJson, requireAdmin } from "../../../../edge/admin"
import { checkChange, isRole, isStatus } from "../../../../edge/access"
import { json, log } from "../../../../edge/http"
import type { Context } from "../../../../edge/types"

async function target(ctx: Context) {
  const auth = await requireAdmin(ctx, true)
  if (auth instanceof Response) return auth
  const id = Number(ctx.params.id)
  if (!Number.isSafeInteger(id) || id <= 0) return json({ error: "成员不存在" }, 404)
  const member = await auth.store.getMember(id)
  if (!member) return json({ error: "成员不存在" }, 404)
  const problem = checkChange(auth.actor, member, ctx.env.ADMIN_GITHUB_LOGIN)
  if (problem) return json({ error: problem }, 403)
  return { ...auth, member }
}

/** 通过审批、停用、恢复或修改角色：{ status?, role? } */
export async function onRequestPatch(ctx: Context) {
  const t = await target(ctx)
  if (t instanceof Response) return t
  const body = await readJson(ctx.request)
  const role = body.role ?? t.member.role
  const status = body.status ?? t.member.status
  if (!isRole(role) || !isStatus(status)) return json({ error: "角色或状态不正确" }, 400)
  await t.store.setAccess(t.member.github_id, role, status)
  log("admin.member_changed", { by: t.actor.login, login: t.member.login, role, status })
  return json({ ok: true })
}

/** 移除成员：对方之后再登录会重新进入待审批 */
export async function onRequestDelete(ctx: Context) {
  const t = await target(ctx)
  if (t instanceof Response) return t
  await t.store.removeMember(t.member.github_id)
  log("admin.member_removed", { by: t.actor.login, login: t.member.login })
  return json({ ok: true })
}
