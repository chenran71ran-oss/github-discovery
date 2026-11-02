/**
 * 全站访问保护：除登录页与登录接口外，所有请求（包括榜单数据 JSON）都要求有效的登录。
 * 会话每 10 分钟回数据库核对一次，被移除或停用的成员最迟 10 分钟后失去访问。
 */
import { guard } from "../edge/access"
import { clearCookie, configProblem, isNavigation, json, log, needsRecheck, nowSeconds, readSession, redirect, sessionCookie, withCookie } from "../edge/http"
import { SESSION_COOKIE } from "../edge/config"
import { createStore, ensureSchema } from "../edge/store"
import type { Context } from "../edge/types"

export async function onRequest(ctx: Context) {
  const { request, env } = ctx
  const url = new URL(request.url)
  const problem = configProblem(env)
  if (problem) {
    log("config.missing", { problem })
    return new Response("登录服务尚未配置完成，请联系站长。", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } })
  }
  let session = await readSession(request, env)
  let refreshed: string | undefined
  if (session && needsRecheck(session)) {
    await ensureSchema(env.DB!)
    const member = await createStore(env.DB!).getMember(session.gid)
    if (member?.status === "active") {
      refreshed = await sessionCookie(member, env, nowSeconds(), session.exp)
      session = { ...session, login: member.login, role: member.role, chk: nowSeconds() }
    } else {
      log("session.revoked", { gid: session.gid })
      session = null
    }
  }
  const decision = guard(url.pathname, isNavigation(request), session)
  if (decision === "redirect") return redirect(`/login?next=${encodeURIComponent(url.pathname + url.search)}`, [clearCookie(SESSION_COOKIE)])
  if (decision === "unauthorized") return json({ error: "unauthorized" }, 401, { "Set-Cookie": clearCookie(SESSION_COOKIE) })
  if (session) ctx.data.session = session
  let response = await ctx.next()
  if (session && url.pathname.startsWith("/data/")) {
    // 受保护的数据不进共享缓存
    response = new Response(response.body, response)
    response.headers.set("Cache-Control", "private, no-cache")
  }
  if (session) {
    response = new Response(response.body, response)
    response.headers.set("X-Robots-Tag", "noindex")
  }
  return refreshed ? withCookie(response, refreshed) : response
}
