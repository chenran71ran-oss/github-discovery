/**
 * 第 4 层：HTTP 边界。Cookie、跳转、JSON 响应、同源检查、日志，以及从请求里读会话。
 */
import { MIN_SECRET_LENGTH, RECHECK_AFTER, SESSION_COOKIE, SESSION_TTL } from "./config"
import { sign, verify } from "./session"
import type { Env, Member, Session } from "./types"

export const nowSeconds = () => Math.floor(Date.now() / 1000)

/** 结构化日志：Cloudflare 的实时日志里一行一个 JSON，不记录 Cookie、令牌或密钥 */
export function log(event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ event, at: new Date().toISOString(), ...fields }))
}

/**
 * 缺少配置时拒绝服务的响应。列出缺的是哪几项（只有名字，不含任何值），
 * 方便站长对照 Cloudflare Pages 的 Production / Preview 环境检查。
 */
export function configUnavailable(problem: string) {
  return new Response(`登录服务尚未配置完成：${problem}\n\n请在 Cloudflare Pages → Settings 里检查当前环境（Production 或 Preview）的 Variables and secrets 与 D1 绑定 DB，修改后需要重新部署才会生效。`, { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } })
}

/** 缺少配置时拒绝服务（fail closed），而不是不设防地放行 */
export function configProblem(env: Env) {
  const missing = (["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "SESSION_SECRET", "ADMIN_GITHUB_LOGIN"] as const).filter(k => !env[k])
  if (!env.DB) missing.push("DB" as never)
  if (missing.length) return `missing ${missing.join(", ")}`
  if (env.SESSION_SECRET!.length < MIN_SECRET_LENGTH) return `SESSION_SECRET shorter than ${MIN_SECRET_LENGTH}`
  return null
}

export function readCookie(request: Request, name: string) {
  const header = request.headers.get("Cookie") || ""
  for (const part of header.split(";")) {
    const i = part.indexOf("=")
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim())
  }
  return undefined
}

export function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
}
export const clearCookie = (name: string) => cookie(name, "", 0)

export async function readSession(request: Request, env: Env) {
  return verify<Session>(readCookie(request, SESSION_COOKIE), env.SESSION_SECRET!)
}

export async function sessionCookie(member: Pick<Member, "github_id" | "login" | "role">, env: Env, now = nowSeconds(), exp = now + SESSION_TTL) {
  const session: Session = { gid: member.github_id, login: member.login, role: member.role, exp, chk: now }
  return cookie(SESSION_COOKIE, await sign(session, env.SESSION_SECRET!), exp - now)
}

export const needsRecheck = (session: Session, now = nowSeconds()) => now - session.chk >= RECHECK_AFTER

export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } })
}

export function redirect(location: string, cookies: string[] = [], status = 302) {
  const headers = new Headers({ "Location": location, "Cache-Control": "no-store" })
  for (const c of cookies) headers.append("Set-Cookie", c)
  return new Response(null, { status, headers })
}

export function isNavigation(request: Request) {
  return request.method === "GET" && (request.headers.get("Sec-Fetch-Mode") === "navigate" || (request.headers.get("Accept") || "").includes("text/html"))
}

/** 只接受站内路径，防止登录后被带去别的网站（开放重定向） */
export function safeNext(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.startsWith("/api/") || next.startsWith("/login")) return "/"
  return next
}

/**
 * 改数据的请求必须同源且是 JSON：配合 SameSite=Lax Cookie 防跨站请求伪造。
 * 同源判断看 Origin；个别浏览器同源请求不带 Origin 时，看浏览器自己写的 Sec-Fetch-Site（网页脚本改不了）。
 */
export function isSameOriginJson(request: Request) {
  if (!(request.headers.get("Content-Type") || "").startsWith("application/json")) return false
  const origin = request.headers.get("Origin")
  if (origin) return origin === new URL(request.url).origin
  return request.headers.get("Sec-Fetch-Site") === "same-origin"
}

export function withCookie(response: Response, value: string) {
  const r = new Response(response.body, response)
  r.headers.append("Set-Cookie", value)
  return r
}
