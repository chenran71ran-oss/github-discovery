/**
 * 第 3 层：准入策略。把会话、存储组合成「这个人能不能进、这次请求怎么处理、这个管理操作允不允许」。
 * 这里不碰 HTTP，方便单独测试。
 */
import { PUBLIC_PATHS, PUBLIC_PREFIXES } from "./config"
import type { Store } from "./store"
import type { GitHubUser, Member, Role, Session, Status } from "./types"

export type Admission = { kind: "active", member: Member } | { kind: "pending" } | { kind: "blocked" }

export function isOwner(login: string, ownerLogin: string | undefined) {
  return !!ownerLogin && login.toLowerCase() === ownerLogin.trim().toLowerCase()
}

/**
 * GitHub 登录成功后决定准入：
 * - 环境变量里的站长：始终是管理员；
 * - 已是成员：按现有状态（封禁的进不来）；
 * - 被邀请：成为成员，邀请随即作废；
 * - 其他人：记为「待审批」，由管理员决定。
 */
export async function admit(store: Store, user: GitHubUser, ownerLogin: string | undefined, now: string): Promise<Admission> {
  const existing = await store.getMember(user.id)
  if (isOwner(user.login, ownerLogin)) {
    await store.saveProfile(user, "admin", "active", now)
    await store.setAccess(user.id, "admin", "active")
  } else if (existing?.status === "blocked") {
    await store.saveProfile(user, existing.role, existing.status, now)
    return { kind: "blocked" }
  } else if (existing?.status !== "active") {
    const invite = await store.getInvite(user.login)
    await store.saveProfile(user, invite?.role ?? "member", invite ? "active" : "pending", now)
    if (!invite) return { kind: "pending" }
    await store.setAccess(user.id, invite.role, "active")
    await store.deleteInvite(user.login)
  } else {
    await store.saveProfile(user, existing.role, existing.status, now)
  }
  return { kind: "active", member: (await store.getMember(user.id))! }
}

export function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
}

/** 没有登录时：打开页面的请求跳到登录页，数据和接口请求返回 401 */
export function guard(pathname: string, isNavigation: boolean, session: Session | null): "allow" | "redirect" | "unauthorized" {
  if (session || isPublicPath(pathname)) return "allow"
  return isNavigation ? "redirect" : "unauthorized"
}

/** 管理操作的边界：不能改自己，不能动站长。返回错误说明，允许时返回 null。 */
export function checkChange(actor: Member, target: Member, ownerLogin: string | undefined): string | null {
  if (actor.github_id === target.github_id) return "不能修改自己的账号"
  if (isOwner(target.login, ownerLogin)) return "站长账号由环境变量指定，不能在这里修改"
  return null
}

export function isRole(value: unknown): value is Role {
  return value === "admin" || value === "member"
}
export function isStatus(value: unknown): value is Status {
  return value === "active" || value === "pending" || value === "blocked"
}
