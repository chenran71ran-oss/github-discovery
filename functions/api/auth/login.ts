/** 发起 GitHub 登录：生成一次性 state，签名后放进短期 Cookie，再跳到 GitHub 授权页。 */
import { STATE_COOKIE, STATE_TTL } from "../../../edge/config"
import { authorizeUrl } from "../../../edge/github"
import { configProblem, cookie, nowSeconds, redirect, safeNext } from "../../../edge/http"
import { randomToken, sign } from "../../../edge/session"
import type { Context } from "../../../edge/types"

export async function onRequestGet(ctx: Context) {
  if (configProblem(ctx.env)) return new Response("登录服务尚未配置完成", { status: 503 })
  const url = new URL(ctx.request.url)
  const state = randomToken()
  const next = safeNext(url.searchParams.get("next"))
  const token = await sign({ state, next, exp: nowSeconds() + STATE_TTL }, ctx.env.SESSION_SECRET!)
  return redirect(authorizeUrl(ctx.env.GITHUB_CLIENT_ID!, `${url.origin}/api/auth/callback`, state), [cookie(STATE_COOKIE, token, STATE_TTL)])
}
