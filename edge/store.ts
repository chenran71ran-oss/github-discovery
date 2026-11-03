/**
 * 第 2 层：D1 存储。表名带 gb_ 前缀，和数据库里旧版雷达留下的表互不影响。
 * 表结构在第一次访问时自动建好（CREATE TABLE IF NOT EXISTS），部署时不需要手动迁移。
 */
import type { D1Database, GitHubUser, Invite, Member, Role, Status } from "./types"

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS gb_members (
    github_id INTEGER PRIMARY KEY,
    login TEXT NOT NULL,
    name TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
    status TEXT NOT NULL CHECK (status IN ('active', 'pending', 'blocked')),
    created_at TEXT NOT NULL,
    last_login_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS gb_members_login ON gb_members (login COLLATE NOCASE)`,
  `CREATE TABLE IF NOT EXISTS gb_invites (
    login TEXT PRIMARY KEY COLLATE NOCASE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
    invited_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
]

const ready = new WeakMap<D1Database, Promise<unknown>>()
export function ensureSchema(db: D1Database) {
  if (!ready.has(db)) {
    const p = db.batch(SCHEMA.map(sql => db.prepare(sql)))
    // 失败时下次请求重试，不把失败缓存住
    p.catch(() => ready.delete(db))
    ready.set(db, p)
  }
  return ready.get(db)!
}

export function createStore(db: D1Database) {
  return {
    getMember: (id: number) => db.prepare("SELECT * FROM gb_members WHERE github_id = ?").bind(id).first<Member>(),
    listMembers: async () => (await db.prepare("SELECT * FROM gb_members ORDER BY status = 'pending' DESC, role = 'admin' DESC, login COLLATE NOCASE").all<Member>()).results,
    /** 新建或更新成员资料；role / status 只在新建时写入，已有成员的角色与状态另行修改 */
    saveProfile: (user: GitHubUser, role: Role, status: Status, now: string) => db.prepare(
      `INSERT INTO gb_members (github_id, login, name, avatar_url, role, status, created_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (github_id) DO UPDATE SET login = excluded.login, name = excluded.name, avatar_url = excluded.avatar_url, last_login_at = excluded.last_login_at`,
    ).bind(user.id, user.login, user.name, user.avatar_url, role, status, now, now).run(),
    setAccess: (id: number, role: Role, status: Status) => db.prepare("UPDATE gb_members SET role = ?, status = ? WHERE github_id = ?").bind(role, status, id).run(),
    removeMember: (id: number) => db.prepare("DELETE FROM gb_members WHERE github_id = ?").bind(id).run(),
    getInvite: (login: string) => db.prepare("SELECT * FROM gb_invites WHERE login = ?").bind(login).first<Invite>(),
    listInvites: async () => (await db.prepare("SELECT * FROM gb_invites ORDER BY created_at DESC").all<Invite>()).results,
    createInvite: (login: string, role: Role, by: string, now: string) => db.prepare(
      "INSERT INTO gb_invites (login, role, invited_by, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (login) DO UPDATE SET role = excluded.role, invited_by = excluded.invited_by, created_at = excluded.created_at",
    ).bind(login, role, by, now).run(),
    deleteInvite: (login: string) => db.prepare("DELETE FROM gb_invites WHERE login = ?").bind(login).run(),
  }
}
export type Store = ReturnType<typeof createStore>
