import { SESSION_COOKIE } from "../../edge/config"
import { clearCookie, json } from "../../edge/http"
import { createStore, ensureSchema } from "../../edge/store"
import type { Context } from "../../edge/types"

/** 当前登录的成员。中间件已保证有会话。 */
export async function onRequestGet(ctx: Context) {
  const session = ctx.data.session
  if (!session) return json({ error: "unauthorized" }, 401)
  await ensureSchema(ctx.env.DB!)
  const member = await createStore(ctx.env.DB!).getMember(session.gid)
  // 已被移除或停用：清掉会话，前端回到登录页时才不会被签名仍有效的 Cookie 弹回来
  if (member?.status !== "active") return json({ error: "unauthorized" }, 401, { "Set-Cookie": clearCookie(SESSION_COOKIE) })
  return json({ login: member.login, name: member.name, avatar: member.avatar_url, role: member.role })
}
