import { SESSION_COOKIE } from "../../../edge/config"
import { clearCookie, isSameOriginJson, json } from "../../../edge/http"
import type { Context } from "../../../edge/types"

/** 退出登录：只接受同源的 POST，避免被别的网站一个链接就把人登出 */
export async function onRequestPost(ctx: Context) {
  if (!isSameOriginJson(ctx.request)) return json({ error: "bad request" }, 400)
  return json({ ok: true }, 200, { "Set-Cookie": clearCookie(SESSION_COOKIE) })
}
