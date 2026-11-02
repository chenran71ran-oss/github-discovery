/** GitHub 授权回调：核对 state → 换取令牌 → 读取用户 → 按准入策略处理 → 写入会话。 */
import { admit } from "../../../edge/access"
import { STATE_COOKIE } from "../../../edge/config"
import { exchangeCode, fetchUser } from "../../../edge/github"
import { clearCookie, configProblem, configUnavailable, log, readCookie, redirect, sessionCookie } from "../../../edge/http"
import { verify } from "../../../edge/session"
import { createStore, ensureSchema } from "../../../edge/store"
import type { Context } from "../../../edge/types"

export async function onRequestGet(ctx: Context) {
  const { request, env } = ctx
  const problem = configProblem(env)
  if (problem) return configUnavailable(problem)
  const url = new URL(request.url)
  const clearState = clearCookie(STATE_COOKIE)
  const fail = (status: string) => redirect(`/login?status=${status}`, [clearState])
  if (url.searchParams.get("error")) return fail("denied")
  const saved = await verify<{ state: string, next: string, exp: number }>(readCookie(request, STATE_COOKIE), env.SESSION_SECRET!)
  const code = url.searchParams.get("code")
  if (!saved || !code || url.searchParams.get("state") !== saved.state) {
    log("auth.state_mismatch")
    return fail("expired")
  }
  try {
    const token = await exchangeCode(code, `${url.origin}/api/auth/callback`, env.GITHUB_CLIENT_ID!, env.GITHUB_CLIENT_SECRET!)
    const user = await fetchUser(token)
    await ensureSchema(env.DB!)
    const outcome = await admit(createStore(env.DB!), user, env.ADMIN_GITHUB_LOGIN, new Date().toISOString())
    log("auth.login", { gid: user.id, login: user.login, outcome: outcome.kind })
    if (outcome.kind !== "active") return fail(outcome.kind)
    return redirect(saved.next, [clearState, await sessionCookie(outcome.member, env)])
  } catch (error) {
    log("auth.error", { message: error instanceof Error ? error.message : String(error) })
    return fail("error")
  }
}
