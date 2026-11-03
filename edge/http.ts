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

/** 会话必须字段齐全：签名有效但缺字段的令牌一律当作没登录 */
function isSession(value: unknown): value is Session {
  const s = value as Session
  return !!s && Number.isSafeInteger(s.gid) && s.gid > 0 && typeof s.login === "string" && (s.role === "admin" || s.role === "member") && Number.isFinite(s.chk) && Number.isFinite(s.exp)
}

export async function readSession(request: Request, env: Env) {
  const payload = await verify<Session>(readCookie(request, SESSION_COOKIE), env.SESSION_SECRET!, "session")
  return isSession(payload) ? payload : null
}

export async function sessionCookie(member: Pick<Member, "github_id" | "login" | "role">, env: Env, now = nowSeconds(), exp = now + SESSION_TTL) {
  const session: Session = { gid: member.github_id, login: member.login, role: member.role, exp, chk: now }
  return cookie(SESSION_COOKIE, await sign(session, env.SESSION_SECRET!, "session"), exp - now)
}

/** 核对时间缺失、来自未来或已超过间隔时，都回数据库核对（宁可多查一次，也不跳过） */
export const needsRecheck = (session: Session, now = nowSeconds()) => !Number.isFinite(session.chk) || session.chk > now + 60 || now - session.chk >= RECHECK_AFTER

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
/** 控制字符（含制表符、换行）、空格、DEL 和反斜杠：浏览器解析网址时会删掉或改写它们 */
function hasUnsafeChar(text: string) {
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if (code <= 0x20 || code === 0x7F || ch === "\\") return true
  }
  return false
}

export function safeNext(next: string | null | undefined) {
  // 浏览器解析网址时会删掉制表符、换行，并把反斜杠当成斜杠：这些字符一律拒绝（PR #15 评审发现的问题）
  if (!next || !next.startsWith("/") || hasUnsafeChar(next)) return "/"
  // 再按浏览器的方式解析一遍，结果必须仍在本站
  const base = "https://same-origin.invalid"
  let url: URL
  try {
    url = new URL(next, base)
  } catch {
    return "/"
  }
  const path = url.pathname + url.search + url.hash
  if (url.origin !== base || path.startsWith("//") || path.startsWith("/api/") || path === "/login" || path.startsWith("/login?")) return "/"
  return path
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
