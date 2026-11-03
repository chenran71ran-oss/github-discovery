/**
 * 全站访问保护：除登录页与登录接口外，所有请求（包括榜单数据 JSON）都要求有效的登录。
 * 会话每 10 分钟回数据库核对一次，被移除或停用的成员最迟 10 分钟后失去访问。
 */
import { guard, isPublicPath } from "../edge/access"
import { clearCookie, configProblem, configUnavailable, isNavigation, json, log, needsRecheck, nowSeconds, readSession, redirect, sessionCookie, withCookie } from "../edge/http"
import { SESSION_COOKIE } from "../edge/config"
import { createStore, ensureSchema } from "../edge/store"
import type { Context } from "../edge/types"

export async function onRequest(ctx: Context) {
  const { request, env } = ctx
  const url = new URL(request.url)
  const problem = configProblem(env)
  if (problem) {
    log("config.missing", { problem })
    return configUnavailable(problem)
  }
  // 登录页与登录接口不做会话续期：否则续期的 Cookie 会排在退出登录的「清除 Cookie」之后，
  // 浏览器就留住了会话（PR #15 评审发现的问题）
  if (isPublicPath(url.pathname)) return ctx.next()
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
  // 下游已经设置或清除了会话 Cookie 时，不再追加续期
  const downstreamSetsSession = response.headers.getSetCookie().some(h => h.startsWith(`${SESSION_COOKIE}=`))
  return refreshed && !downstreamSetsSession ? withCookie(response, refreshed) : response
}
