import { readSession, redirect, safeNext } from "../edge/http"
import { loginPage } from "../edge/pages"
import type { Context } from "../edge/types"

export async function onRequestGet(ctx: Context) {
  const url = new URL(ctx.request.url)
  const next = safeNext(url.searchParams.get("next"))
  // 已登录就直接回去
  if (await readSession(ctx.request, ctx.env)) return redirect(next)
  return new Response(loginPage(next, url.searchParams.get("status")), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "X-Frame-Options": "DENY", "Referrer-Policy": "same-origin" },
  })
}
