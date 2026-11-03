/**
 * 外交层：页面与外部的全部交互——读取同源 JSON 快照、浏览器存储里的收藏。
 * 组件不直接 fetch 或读写 localStorage，换数据源时只改这里。
 */
import { type DiscoverySnapshot, type Repository, isSnapshot } from "@shared/discovery"

export const savedKey = "discovery-next-favorites-v1"
const fullName = /^[\w.-]+\/[\w.-]+$/

/** 登录过期或被移除：回到登录页，登录后回到当前位置 */
export function toLogin(): never {
  window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)
  throw new Error("需要重新登录")
}

/** 读取失败时给出服务端的原因（例如 503「登录服务尚未配置完成：missing DB」），便于直接定位 */
async function failureReason(response: Response) {
  const base = `榜单暂时没有加载成功（HTTP ${response.status}），请稍后重试。`
  if (response.status !== 503) return base
  const text = (await response.text().catch(() => "")).split("\n")[0]?.trim()
  return text ? `${text}（HTTP 503）` : base
}

export async function loadSnapshot(date = "", signal?: AbortSignal): Promise<DiscoverySnapshot> {
  const response = await fetch(date ? `/data/history/${date}.json` : "/data/latest.json", { signal, cache: "no-cache" })
  if (response.status === 401) toLogin()
  if (!response.ok) throw new Error(await failureReason(response))
  const value: unknown = await response.json()
  if (!isSnapshot(value)) throw new Error("榜单数据格式异常，暂时无法展示。")
  return value
}

export async function loadDates(): Promise<string[]> {
  const response = await fetch("/data/dates.json")
  if (response.status === 401) toLogin()
  return response.ok ? response.json() : []
}

// ---------- 账号（Cloudflare Pages Functions，见 functions/ 与 edge/） ----------

export type Role = "admin" | "member"
export interface Me {
  login: string
  name: string | null
  avatar: string | null
  role: Role
}
export interface MemberRow {
  id: number
  login: string
  name: string | null
  avatar: string | null
  role: Role
  status: "active" | "pending" | "blocked"
  createdAt: string
  lastLoginAt: string | null
  owner: boolean
}
export interface InviteRow {
  login: string
  role: Role
  invitedBy: string
  createdAt: string
}

/** 当前成员。没有账号层（本地纯静态开发）时返回 null，界面不显示账号入口。 */
export async function loadMe(): Promise<Me | null> {
  const response = await fetch("/api/me", { cache: "no-store" })
  if (response.status === 401) toLogin()
  if (!response.ok || !(response.headers.get("Content-Type") || "").includes("application/json")) return null
  return response.json()
}

async function send<T>(method: string, url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })
  if (response.status === 401) toLogin()
  const data = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(data.error || "操作没有成功，请稍后重试")
  return data
}

export const accountApi = {
  members: () => send<{ me: number, members: MemberRow[], invites: InviteRow[] }>("GET", "/api/admin/members"),
  invite: (login: string, role: Role) => send("POST", "/api/admin/invites", { login, role }),
  revokeInvite: (login: string) => send("DELETE", "/api/admin/invites", { login }),
  update: (id: number, change: { role?: Role, status?: MemberRow["status"] }) => send("PATCH", `/api/admin/members/${id}`, change),
  remove: (id: number) => send("DELETE", `/api/admin/members/${id}`),
  logout: async () => {
    await send("POST", "/api/auth/logout", {})
    window.location.assign("/login?status=signedout")
  },
}

export function readSaved(): Record<string, Repository> {
  try {
    const value = JSON.parse(localStorage.getItem(savedKey) || "{}")
    return value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).filter(([key, r]) => fullName.test(key) && r && typeof r === "object" && (r as Repository).fullName === key)) as Record<string, Repository> : {}
  } catch {
    return {}
  }
}

/** 返回是否写入成功；浏览器禁用存储时调用方提示用户。 */
export function writeSaved(next: Record<string, Repository>) {
  try {
    localStorage.setItem(savedKey, JSON.stringify(next))
    return true
  } catch {
    return false
  }
}

export function isRepoName(value: string | null): value is string {
  return !!value && fullName.test(value)
}
