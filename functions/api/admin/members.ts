import { requireAdmin } from "../../../edge/admin"
import { isOwner } from "../../../edge/access"
import { json } from "../../../edge/http"
import type { Context } from "../../../edge/types"

/** 成员列表、待审批与邀请 */
export async function onRequestGet(ctx: Context) {
  const auth = await requireAdmin(ctx, false)
  if (auth instanceof Response) return auth
  const [members, invites] = await Promise.all([auth.store.listMembers(), auth.store.listInvites()])
  return json({
    me: auth.actor.github_id,
    members: members.map(m => ({ id: m.github_id, login: m.login, name: m.name, avatar: m.avatar_url, role: m.role, status: m.status, createdAt: m.created_at, lastLoginAt: m.last_login_at, owner: isOwner(m.login, ctx.env.ADMIN_GITHUB_LOGIN) })),
    invites: invites.map(i => ({ login: i.login, role: i.role, invitedBy: i.invited_by, createdAt: i.created_at })),
  })
}
