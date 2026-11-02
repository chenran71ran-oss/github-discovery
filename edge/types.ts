/**
 * 第 1 层：账号模块的数据结构。只有类型，没有逻辑。
 * D1 的类型按本模块用到的最小接口声明，避免引入整套 Workers 类型。
 */
export interface D1Result<T> {
  results: T[]
}
export interface D1PreparedStatement {
  bind: (...values: unknown[]) => D1PreparedStatement
  first: <T = unknown>() => Promise<T | null>
  all: <T = unknown>() => Promise<D1Result<T>>
  run: () => Promise<unknown>
}
export interface D1Database {
  prepare: (sql: string) => D1PreparedStatement
  batch: (statements: D1PreparedStatement[]) => Promise<unknown[]>
}

/** Cloudflare Pages 的绑定与环境变量（见 docs/OPERATIONS.md） */
export interface Env {
  DB?: D1Database
  GITHUB_CLIENT_ID?: string
  GITHUB_CLIENT_SECRET?: string
  SESSION_SECRET?: string
  ADMIN_GITHUB_LOGIN?: string
}

export type Role = "admin" | "member"
export type Status = "active" | "pending" | "blocked"

export interface Member {
  github_id: number
  login: string
  name: string | null
  avatar_url: string | null
  role: Role
  status: Status
  created_at: string
  last_login_at: string | null
}

export interface Invite {
  login: string
  role: Role
  invited_by: string
  created_at: string
}

/** 会话 Cookie 里签名保存的内容；时间单位都是秒 */
export interface Session {
  gid: number
  login: string
  role: Role
  exp: number
  /** 上次到数据库核对成员状态的时间 */
  chk: number
}

export interface GitHubUser {
  id: number
  login: string
  name: string | null
  avatar_url: string
}

/** Pages Functions 的上下文（只声明用到的部分） */
export interface Context {
  request: Request
  env: Env
  params: Record<string, string | string[]>
  next: (input?: Request | string) => Promise<Response>
  data: { session?: Session }
}
