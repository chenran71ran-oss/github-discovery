import { json } from "../../edge/http"
import { createStore, ensureSchema } from "../../edge/store"
import type { Context } from "../../edge/types"

/** 当前登录的成员。中间件已保证有会话。 */
export async function onRequestGet(ctx: Context) {
  const session = ctx.data.session
  if (!session) return json({ error: "unauthorized" }, 401)
  await ensureSchema(ctx.env.DB!)
  const member = await createStore(ctx.env.DB!).getMember(session.gid)
  if (!member) return json({ error: "unauthorized" }, 401)
  return json({ login: member.login, name: member.name, avatar: member.avatar_url, role: member.role })
}
