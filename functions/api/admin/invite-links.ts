/** 邀请链接：生成（令牌只返回这一次）、列出仍可用的、撤销 */
import { readJson, requireAdmin } from "../../../edge/admin"
import { isRole } from "../../../edge/access"
import { INVITE_MAX_DAYS, INVITE_MAX_USES } from "../../../edge/config"
import { json, log } from "../../../edge/http"
import { randomToken, sha256 } from "../../../edge/session"
import type { Context } from "../../../edge/types"

export async function onRequestGet(ctx: Context) {
  const auth = await requireAdmin(ctx, false)
  if (auth instanceof Response) return auth
  const links = await auth.store.listInviteLinks(new Date().toISOString())
  return json({ links: links.map(l => ({ id: l.id.slice(0, 16), role: l.role, createdBy: l.created_by, createdAt: l.created_at, expiresAt: l.expires_at, uses: l.uses, maxUses: l.max_uses })) })
}

export async function onRequestPost(ctx: Context) {
  const auth = await requireAdmin(ctx, true)
  if (auth instanceof Response) return auth
  const body = await readJson(ctx.request)
  const role = body.role ?? "member"
  const days = Number(body.days ?? 7)
  const maxUses = Number(body.maxUses ?? 1)
  if (!isRole(role) || !Number.isInteger(days) || days < 1 || days > INVITE_MAX_DAYS || !Number.isInteger(maxUses) || maxUses < 1 || maxUses > INVITE_MAX_USES) {
    return json({ error: `有效期 1–${INVITE_MAX_DAYS} 天，次数 1–${INVITE_MAX_USES} 次` }, 400)
  }
  const token = randomToken(24)
  const now = new Date()
  const expires = new Date(now.getTime() + days * 86400_000).toISOString()
  await auth.store.createInviteLink(await sha256(token), role, auth.actor.login, now.toISOString(), expires, maxUses)
  log("admin.invite_link", { by: auth.actor.login, role, days, maxUses })
  return json({ url: `${new URL(ctx.request.url).origin}/login?invite=${token}`, expiresAt: expires, maxUses, role }, 201)
}

/** 撤销：前端只拿到 id 的前 16 位，这里按前缀匹配仍可用的链接 */
export async function onRequestDelete(ctx: Context) {
  const auth = await requireAdmin(ctx, true)
  if (auth instanceof Response) return auth
  const prefix = (await readJson(ctx.request)).id
  if (typeof prefix !== "string" || !/^[0-9a-f]{16}$/.test(prefix)) return json({ error: "链接不正确" }, 400)
  const now = new Date().toISOString()
  const link = (await auth.store.listInviteLinks(now)).find(l => l.id.startsWith(prefix))
  if (!link) return json({ error: "链接不存在或已失效" }, 404)
  await auth.store.revokeInviteLink(link.id, now)
  log("admin.invite_link_revoked", { by: auth.actor.login })
  return json({ ok: true })
}
