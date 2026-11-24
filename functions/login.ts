import { INVITE_TOKEN, SESSION_COOKIE } from "../edge/config"
import { clearCookie, configProblem, readSession, redirect, safeNext } from "../edge/http"
import { loginPage } from "../edge/pages"
import { sha256 } from "../edge/session"
import { createStore, ensureSchema } from "../edge/store"
import type { Context } from "../edge/types"

export async function onRequestGet(ctx: Context) {
  const url = new URL(ctx.request.url)
  const next = safeNext(url.searchParams.get("next"))
  const headers = new Headers({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "X-Frame-Options": "DENY", "Referrer-Policy": "same-origin" })
  const session = configProblem(ctx.env) ? null : await readSession(ctx.request, ctx.env)
  if (session) {
    // 已登录就直接回去；但只看签名不够，先到数据库确认此人仍是有效成员，否则会在登录页和站内之间来回跳
    await ensureSchema(ctx.env.DB!)
    const member = await createStore(ctx.env.DB!).getMember(session.gid)
    if (member?.status === "active") return redirect(next)
    headers.append("Set-Cookie", clearCookie(SESSION_COOKIE))
  }
  // 邀请链接 /login?invite=…：先看链接还能不能用，决定提示语和登录按钮是否带上它
  const invite = url.searchParams.get("invite")
  let linkState: "valid" | "invalid" | null = null
  if (invite !== null && !configProblem(ctx.env)) {
    linkState = "invalid"
    if (INVITE_TOKEN.test(invite)) {
      await ensureSchema(ctx.env.DB!)
      const link = await createStore(ctx.env.DB!).getInviteLink(await sha256(invite))
      const now = new Date().toISOString()
      if (link && !link.revoked_at && link.expires_at > now && link.uses < link.max_uses) linkState = "valid"
    }
  }
  return new Response(loginPage(next, url.searchParams.get("status"), invite, linkState), { headers })
}
