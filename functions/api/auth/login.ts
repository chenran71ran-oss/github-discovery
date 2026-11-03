/** 发起 GitHub 登录：生成一次性 state，签名后放进短期 Cookie，再跳到 GitHub 授权页。 */
import { STATE_COOKIE, STATE_TTL } from "../../../edge/config"
import { authorizeUrl } from "../../../edge/github"
import { configProblem, configUnavailable, cookie, nowSeconds, redirect, safeNext } from "../../../edge/http"
import { randomToken, sign } from "../../../edge/session"
import type { Context } from "../../../edge/types"

export async function onRequestGet(ctx: Context) {
  const problem = configProblem(ctx.env)
  if (problem) return configUnavailable(problem)
  const url = new URL(ctx.request.url)
  const state = randomToken()
  const next = safeNext(url.searchParams.get("next"))
  const token = await sign({ state, next, exp: nowSeconds() + STATE_TTL }, ctx.env.SESSION_SECRET!, "oauth-state")
  return redirect(authorizeUrl(ctx.env.GITHUB_CLIENT_ID!, `${url.origin}/api/auth/callback`, state), [cookie(STATE_COOKIE, token, STATE_TTL)])
}
