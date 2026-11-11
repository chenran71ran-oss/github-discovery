import Database from "better-sqlite3"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { onRequest as middleware } from "../functions/_middleware"
import { onRequestGet as callback } from "../functions/api/auth/callback"
import { onRequestGet as startLogin } from "../functions/api/auth/login"
import { onRequestPost as logout } from "../functions/api/auth/logout"
import { onRequestPost as invite } from "../functions/api/admin/invites"
import { onRequestGet as listMembers } from "../functions/api/admin/members"
import { onRequestPatch as changeMember, onRequestDelete as removeMember } from "../functions/api/admin/members/[id]"
import { onRequestGet as loginPage } from "../functions/login"
import { onRequestGet as meHandler } from "../functions/api/me"
import { onRequestPut as favorite, onRequestGet as listFavorites, onRequestDelete as unfavorite } from "../functions/api/favorites/index"
import { onRequestPost as importFavorites } from "../functions/api/favorites/import"
import { onRequestGet as listSeen, onRequestPost as markSeen } from "../functions/api/seen"
import { admit, guard } from "./access"
import { RECHECK_AFTER, SESSION_COOKIE, STATE_COOKIE } from "./config"
import { safeNext, sessionCookie } from "./http"
import { sign, verify } from "./session"
import { createStore, ensureSchema } from "./store"
import type { Context, D1Database, Env, GitHubUser, Session } from "./types"

/** D1 的最小实现，底层是真正的 SQLite，所以 SQL 本身也被测试到 */
function sqliteD1(): D1Database {
  const db = new Database(":memory:")
  const statement = (sql: string, args: unknown[] = []) => ({
    bind: (...values: unknown[]) => statement(sql, values),
    first: async () => {
      const s = db.prepare(sql)
      return s.reader ? (s.get(...args) ?? null) : (s.run(...args), null)
    },
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => db.prepare(sql).run(...args),
    exec: () => {
      const s = db.prepare(sql)
      return s.reader ? s.all(...args) : s.run(...args)
    },
  })
  return {
    prepare: sql => statement(sql) as never,
    batch: async list => db.transaction(() => list.map(s => (s as unknown as { exec: () => unknown }).exec()))(),
  }
}

const SECRET = "x".repeat(40)
const ORIGIN = "https://radar.example"
const owner: GitHubUser = { id: 1, login: "Owner-Name", name: "Owner", avatar_url: "a" }
const friend: GitHubUser = { id: 2, login: "friend", name: "Friend", avatar_url: "b" }
const stranger: GitHubUser = { id: 3, login: "stranger", name: null, avatar_url: "c" }

let env: Env
beforeEach(() => {
  env = { DB: sqliteD1(), GITHUB_CLIENT_ID: "cid", GITHUB_CLIENT_SECRET: "csecret", SESSION_SECRET: SECRET, ADMIN_GITHUB_LOGIN: "owner-name" }
})
afterEach(() => vi.unstubAllGlobals())

function ctx(path: string, init: RequestInit & { cookie?: string, params?: Record<string, string> } = {}): Context & { nextCalled: () => boolean } {
  let called = false
  const headers = new Headers(init.headers)
  if (init.cookie) headers.set("Cookie", init.cookie)
  return {
    request: new Request(`${ORIGIN}${path}`, { ...init, headers }),
    env,
    params: init.params ?? {},
    data: {},
    next: async () => {
      called = true
      return new Response("ok", { headers: { "Cache-Control": "public, max-age=60" } })
    },
    nextCalled: () => called,
  }
}
const cookiePair = (setCookie: string) => setCookie.split(";")[0]
async function sessionFor(user: GitHubUser, role: "admin" | "member", chkAgo = 0) {
  const now = Math.floor(Date.now() / 1000)
  return cookiePair(await sessionCookie({ github_id: user.id, login: user.login, role }, env, now - chkAgo, now + 3600))
}
const store = () => createStore(env.DB!)
const json = { "Content-Type": "application/json", "Origin": ORIGIN }

describe("signed session cookie", () => {
  it("round-trips and rejects tampering, wrong keys, expiry and junk", async () => {
    const now = 1_000_000
    const token = await sign({ gid: 1, exp: now + 10 }, SECRET, "session")
    expect(await verify(token, SECRET, "session", now)).toMatchObject({ gid: 1 })
    const [body, sig] = token.split(".")
    const forged = `${btoa(JSON.stringify({ gid: 99, exp: now + 10 })).replace(/=+$/, "")}.${sig}`
    expect(await verify(forged, SECRET, "session", now)).toBeNull()
    expect(await verify(token, "y".repeat(40), "session", now)).toBeNull()
    expect(await verify(token, SECRET, "session", now + 11)).toBeNull()
    for (const junk of [undefined, "", "abc", `${body}`, `${body}.${sig}.x`, `${body}.!!!`]) expect(await verify(junk, SECRET, "session", now)).toBeNull()
    // 同一个主密钥下，不同用途的令牌互不通用
    expect(await verify(token, SECRET, "oauth-state", now)).toBeNull()
    expect(await verify(await sign({ gid: 1, exp: now + 10 }, SECRET, "oauth-state"), SECRET, "session", now)).toBeNull()
  })
})

describe("admission policy", () => {
  it("makes the configured owner an admin, case-insensitively", async () => {
    await ensureSchema(env.DB!)
    const r = await admit(store(), owner, env.ADMIN_GITHUB_LOGIN, "t")
    expect(r.kind === "active" && r.member.role).toBe("admin")
  })
  it("puts strangers on the pending list, and keeps them there on later logins", async () => {
    await ensureSchema(env.DB!)
    expect((await admit(store(), stranger, env.ADMIN_GITHUB_LOGIN, "t")).kind).toBe("pending")
    expect((await admit(store(), stranger, env.ADMIN_GITHUB_LOGIN, "t2")).kind).toBe("pending")
    expect((await store().getMember(stranger.id))?.status).toBe("pending")
  })
  it("lets invited people straight in with the invited role and uses up the invite", async () => {
    await ensureSchema(env.DB!)
    await store().createInvite("FRIEND", "member", "owner", "t")
    const r = await admit(store(), friend, env.ADMIN_GITHUB_LOGIN, "t")
    expect(r.kind === "active" && r.member.role).toBe("member")
    expect(await store().getInvite("friend")).toBeNull()
  })
  it("turns a pending request into a member once an invite exists", async () => {
    await ensureSchema(env.DB!)
    await admit(store(), friend, env.ADMIN_GITHUB_LOGIN, "t")
    await store().createInvite("friend", "admin", "owner", "t")
    const r = await admit(store(), friend, env.ADMIN_GITHUB_LOGIN, "t")
    expect(r.kind === "active" && r.member.role).toBe("admin")
  })
  it("keeps blocked people out even with an invite", async () => {
    await ensureSchema(env.DB!)
    await store().saveProfile(friend, "member", "blocked", "t")
    await store().createInvite("friend", "member", "owner", "t")
    expect((await admit(store(), friend, env.ADMIN_GITHUB_LOGIN, "t")).kind).toBe("blocked")
  })
})

describe("guard and redirects", () => {
  it("only lets public paths through without a session", () => {
    expect(guard("/login", true, null)).toBe("allow")
    expect(guard("/api/auth/callback", false, null)).toBe("allow")
    expect(guard("/", true, null)).toBe("redirect")
    expect(guard("/data/latest.json", false, null)).toBe("unauthorized")
    expect(guard("/api/me", false, null)).toBe("unauthorized")
  })
  it("never redirects off-site after login", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "/api/me", "/login?next=/", "", null]) expect(safeNext(bad)).toBe("/")
    expect(safeNext("/?period=weekly&repo=a/b")).toBe("/?period=weekly&repo=a/b")
  })
})

describe("middleware", () => {
  it("fails closed when configuration is missing", async () => {
    env.SESSION_SECRET = "short"
    const c = ctx("/", { headers: { Accept: "text/html" } })
    const res = await middleware(c)
    expect(res.status).toBe(503)
    expect(await res.text()).toContain("SESSION_SECRET shorter than 32")
    delete env.DB
    delete env.GITHUB_CLIENT_ID
    const missing = await (await middleware(ctx("/"))).text()
    expect(missing).toContain("missing GITHUB_CLIENT_ID, DB")
    expect(missing).not.toContain("csecret")
    expect(c.nextCalled()).toBe(false)
  })
  it("sends visitors to the login page and refuses data without a session", async () => {
    const page = await middleware(ctx("/?period=weekly", { headers: { Accept: "text/html" } }))
    expect(page.status).toBe(302)
    expect(page.headers.get("Location")).toBe("/login?next=%2F%3Fperiod%3Dweekly")
    const data = ctx("/data/latest.json")
    expect((await middleware(data)).status).toBe(401)
    expect(data.nextCalled()).toBe(false)
  })
  it("serves members, keeps data out of shared caches and marks pages noindex", async () => {
    const res = await middleware(ctx("/data/latest.json", { cookie: await sessionFor(friend, "member") }))
    expect(res.status).toBe(200)
    expect(res.headers.get("Cache-Control")).toBe("private, no-cache")
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex")
  })
  it("re-checks old sessions against the database: removed members lose access", async () => {
    await ensureSchema(env.DB!)
    const stale = await sessionFor(friend, "member", RECHECK_AFTER + 5)
    const removed = ctx("/data/latest.json", { cookie: stale })
    expect((await middleware(removed)).status).toBe(401)
    await store().saveProfile(friend, "member", "active", "t")
    const active = await middleware(ctx("/data/latest.json", { cookie: stale }))
    expect(active.status).toBe(200)
    expect(active.headers.get("Set-Cookie")).toContain(SESSION_COOKIE)
  })
  it("rejects a forged cookie", async () => {
    const forged = `${SESSION_COOKIE}=${await sign({ gid: 1, login: "owner-name", role: "admin", exp: 9e9, chk: 9e9 } satisfies Session, "z".repeat(40), "session")}`
    expect((await middleware(ctx("/api/me", { cookie: forged }))).status).toBe(401)
  })
})

describe("review findings (Codex, PR #15)", () => {
  it("an OAuth state cookie cannot be used as a session cookie", async () => {
    const res = await startLogin(ctx("/api/auth/login?next=/"))
    const stateValue = cookiePair(res.headers.get("Set-Cookie")!).split("=")[1]
    const data = ctx("/data/latest.json", { cookie: `${SESSION_COOKIE}=${stateValue}` })
    expect((await middleware(data)).status).toBe(401)
    expect(data.nextCalled()).toBe(false)
  })
  it("a session cookie cannot be used as an OAuth state", async () => {
    const session = (await sessionFor(owner, "admin")).split("=")[1]
    const res = await callback(ctx("/api/auth/callback?code=x&state=anything", { cookie: `${STATE_COOKIE}=${session}` }))
    expect(res.headers.get("Location")).toBe("/login?status=expired")
  })
  it("a session without a valid check time is re-checked, not trusted", async () => {
    await ensureSchema(env.DB!)
    const noChk = `${SESSION_COOKIE}=${await sign({ gid: friend.id, login: friend.login, role: "member", exp: 9e9 }, SECRET, "session")}`
    expect((await middleware(ctx("/data/latest.json", { cookie: noChk }))).status).toBe(401)
  })
  it("logging out after the re-check interval really clears the session", async () => {
    await ensureSchema(env.DB!)
    await store().saveProfile(friend, "member", "active", "t")
    const c = ctx("/api/auth/logout", { method: "POST", headers: json, cookie: await sessionFor(friend, "member", RECHECK_AFTER + 5) })
    c.next = async () => logout(c)
    const res = await middleware(c)
    const sessionCookies = res.headers.getSetCookie().filter(h => h.startsWith(`${SESSION_COOKIE}=`))
    expect(sessionCookies).toHaveLength(1)
    expect(sessionCookies[0]).toMatch(/Max-Age=0/)
  })
  it("a removed member is sent to the login page instead of looping back into the app", async () => {
    await ensureSchema(env.DB!)
    const fresh = await sessionFor(friend, "member")
    // removed before the 10-minute re-check: the session cookie is still validly signed
    const me = ctx("/api/me", { cookie: fresh })
    me.next = async () => meHandler(me)
    const meRes = await middleware(me)
    expect(meRes.status).toBe(401)
    expect(meRes.headers.getSetCookie().some(h => h.startsWith(`${SESSION_COOKIE}=;`))).toBe(true)
    // the login page must not trust the signature alone and bounce them back
    const page = await loginPage(ctx("/login?next=/", { cookie: fresh }))
    expect(page.status).toBe(200)
    expect(page.headers.get("Set-Cookie")).toContain(`${SESSION_COOKIE}=;`)
    // a blocked member is treated the same way
    await store().saveProfile(friend, "member", "blocked", "t")
    const blocked = ctx("/api/me", { cookie: fresh })
    blocked.next = async () => meHandler(blocked)
    expect((await middleware(blocked)).status).toBe(401)
    expect((await loginPage(ctx("/login?next=/", { cookie: fresh }))).status).toBe(200)
  })
  it("refuses redirect targets with control characters, spaces or backslashes", () => {
    for (const bad of ["/\t/evil.example", "/\n/evil.example", "/\r//evil.example", "/ /evil.example", "/\\/evil.example", "/x\\..\\..\\evil", "/\u0000/evil"]) expect(safeNext(bad)).toBe("/")
    expect(safeNext("/?q=AI%20%E8%AE%B0%E8%B4%A6")).toBe("/?q=AI%20%E8%AE%B0%E8%B4%A6")
    expect(safeNext("/?repo=a/b#top")).toBe("/?repo=a/b#top")
  })
})

describe("gitHub login flow", () => {
  function stubGitHub(user: GitHubUser, tokenOk = true) {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/login/oauth/access_token")) {
        expect(JSON.parse(String(init?.body))).toMatchObject({ client_id: "cid", client_secret: "csecret", code: "the-code", redirect_uri: `${ORIGIN}/api/auth/callback` })
        return Response.json(tokenOk ? { access_token: "tok" } : { error: "bad_verification_code" })
      }
      if (url.endsWith("/user")) return Response.json(user)
      throw new Error(`unexpected ${url}`)
    }))
  }
  async function begin(next = "/?period=monthly") {
    const res = await startLogin(ctx(`/api/auth/login?next=${encodeURIComponent(next)}`))
    const location = new URL(res.headers.get("Location")!)
    expect(location.origin + location.pathname).toBe("https://github.com/login/oauth/authorize")
    expect(location.searchParams.get("client_id")).toBe("cid")
    expect(location.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/auth/callback`)
    return { state: location.searchParams.get("state")!, cookie: cookiePair(res.headers.get("Set-Cookie")!) }
  }

  it("signs the owner in and returns to the page they asked for", async () => {
    stubGitHub(owner)
    const { state, cookie } = await begin()
    const res = await callback(ctx(`/api/auth/callback?code=the-code&state=${state}`, { cookie }))
    expect(res.status).toBe(302)
    expect(res.headers.get("Location")).toBe("/?period=monthly")
    const cookies = res.headers.get("Set-Cookie")!
    expect(cookies).toContain(`${SESSION_COOKIE}=`)
    expect(cookies).toMatch(/HttpOnly; Secure; SameSite=Lax/)
    expect(cookies).toContain(`${STATE_COOKIE}=;`)
  })
  it("leaves strangers pending with no session", async () => {
    stubGitHub(stranger)
    const { state, cookie } = await begin()
    const res = await callback(ctx(`/api/auth/callback?code=the-code&state=${state}`, { cookie }))
    expect(res.headers.get("Location")).toBe("/login?status=pending")
    expect(res.headers.get("Set-Cookie")).not.toContain(`${SESSION_COOKIE}=`)
  })
  it("rejects a mismatched state, a cancelled authorisation and a failed token exchange", async () => {
    stubGitHub(owner)
    const { cookie } = await begin()
    expect((await callback(ctx("/api/auth/callback?code=the-code&state=other", { cookie }))).headers.get("Location")).toBe("/login?status=expired")
    expect((await callback(ctx("/api/auth/callback?code=the-code&state=x"))).headers.get("Location")).toBe("/login?status=expired")
    expect((await callback(ctx("/api/auth/callback?error=access_denied"))).headers.get("Location")).toBe("/login?status=denied")
    stubGitHub(owner, false)
    const again = await begin()
    expect((await callback(ctx(`/api/auth/callback?code=the-code&state=${again.state}`, { cookie: again.cookie }))).headers.get("Location")).toBe("/login?status=error")
  })
  it("shows the login page, or skips it when already signed in", async () => {
    const page = await loginPage(ctx("/login?next=/x&status=pending"))
    expect(page.headers.get("Content-Type")).toContain("text/html")
    const html = await page.text()
    expect(html).toContain("/api/auth/login?next=%2Fx")
    expect(html).toContain("站长通过之后")
    // 只有数据库里仍是有效成员时，登录页才直接放回站内
    await ensureSchema(env.DB!)
    await store().saveProfile(friend, "member", "active", "t")
    const signedIn = await loginPage(ctx("/login?next=/x", { cookie: await sessionFor(friend, "member") }))
    expect(signedIn.headers.get("Location")).toBe("/x")
  })
  it("only logs out on a same-origin request", async () => {
    expect((await logout(ctx("/api/auth/logout", { method: "POST" }))).status).toBe(400)
    expect((await logout(ctx("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json", "Origin": "https://evil.example" } }))).status).toBe(400)
    expect((await logout(ctx("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" } }))).status).toBe(400)
    expect((await logout(ctx("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin" } }))).status).toBe(200)
    const ok = await logout(ctx("/api/auth/logout", { method: "POST", headers: json }))
    expect(ok.headers.get("Set-Cookie")).toContain(`${SESSION_COOKIE}=;`)
  })
})

describe("admin API", () => {
  async function asUser(user: GitHubUser, role: "admin" | "member") {
    await ensureSchema(env.DB!)
    await store().saveProfile(user, role, "active", "t")
    await store().setAccess(user.id, role, "active")
    const c = (path: string, init: Parameters<typeof ctx>[1] = {}) => {
      const x = ctx(path, init)
      x.data.session = { gid: user.id, login: user.login, role, exp: 9e9, chk: 9e9 }
      return x
    }
    return c
  }

  it("refuses members, and trusts the database role over a stale cookie", async () => {
    const member = await asUser(friend, "member")
    expect((await listMembers(member("/api/admin/members"))).status).toBe(403)
    const forged = member("/api/admin/members")
    forged.data.session!.role = "admin"
    expect((await listMembers(forged)).status).toBe(403)
  })
  it("invites, approves, blocks and removes, with CSRF and input checks", async () => {
    const admin = await asUser(owner, "admin")
    await store().saveProfile(stranger, "member", "pending", "t")
    const body = (data: unknown) => JSON.stringify(data)
    expect((await invite(admin("/api/admin/invites", { method: "POST", body: body({ login: "new-friend" }), headers: { "Content-Type": "application/json" } }))).status).toBe(400)
    expect((await invite(admin("/api/admin/invites", { method: "POST", body: body({ login: "bad name!" }), headers: json }))).status).toBe(400)
    expect((await invite(admin("/api/admin/invites", { method: "POST", body: body({ login: "@new-friend", role: "member" }), headers: json }))).status).toBe(201)
    const list = await (await listMembers(admin("/api/admin/members"))).json() as { members: { login: string, status: string, owner: boolean }[], invites: { login: string }[] }
    expect(list.invites.map(i => i.login)).toEqual(["new-friend"])
    expect(list.members.find(m => m.login === "stranger")?.status).toBe("pending")
    expect(list.members.find(m => m.owner)?.login).toBe("Owner-Name")

    const target = (id: number) => ({ params: { id: String(id) }, headers: json })
    expect((await changeMember(admin("/api/admin/members/3", { ...target(3), method: "PATCH", body: body({ status: "active" }) }))).status).toBe(200)
    expect((await store().getMember(3))?.status).toBe("active")
    expect((await changeMember(admin("/api/admin/members/3", { ...target(3), method: "PATCH", body: body({ role: "root" }) }))).status).toBe(400)
    expect((await changeMember(admin("/api/admin/members/1", { ...target(1), method: "PATCH", body: body({ status: "blocked" }) }))).status).toBe(403)
    expect((await removeMember(admin("/api/admin/members/99", { ...target(99), method: "DELETE" }))).status).toBe(404)
    expect((await removeMember(admin("/api/admin/members/3", { ...target(3), method: "DELETE" }))).status).toBe(200)
    expect(await store().getMember(3)).toBeNull()
  })
  it("does not let a second admin touch the owner", async () => {
    await asUser(owner, "admin")
    const second = await asUser(friend, "admin")
    const res = await changeMember(second("/api/admin/members/1", { params: { id: "1" }, headers: json, method: "PATCH", body: JSON.stringify({ role: "member" }) }))
    expect(res.status).toBe(403)
  })
})

describe("environment values pasted with whitespace", () => {
  it("trims the client id in the authorize URL", async () => {
    const { authorizeUrl } = await import("./github")
    const url = new URL(authorizeUrl(" Iv23abc \n", "https://example.com/api/auth/callback", "s"))
    expect(url.searchParams.get("client_id")).toBe("Iv23abc")
  })
})

describe("favorites API", () => {
  async function as(user: GitHubUser, status: "active" | "pending" | "blocked" = "active") {
    await ensureSchema(env.DB!)
    await store().saveProfile(user, "member", status, "t")
    await store().setAccess(user.id, "member", status)
    return (path: string, init: Parameters<typeof ctx>[1] = {}) => {
      const x = ctx(path, init)
      x.data.session = { gid: user.id, login: user.login, role: "member", exp: 9e9, chk: 9e9 }
      return x
    }
  }
  const repo = (fullName: string, extra: Record<string, unknown> = {}) => ({ fullName, description: "d", stars: 1, ...extra })
  const send = (method: string, data: unknown, headers: HeadersInit = json) => ({ method, body: JSON.stringify(data), headers })
  const items = async (r: Response) => ((await r.json()) as { items: { fullName: string }[] }).items.map(i => i.fullName)

  it("saves, lists and removes favorites, scoped to each member", async () => {
    const me = await as(friend)
    const other = await as(stranger)
    expect((await favorite(me("/api/favorites", send("PUT", { repo: repo("a/one") })))).status).toBe(200)
    expect((await favorite(me("/api/favorites", send("PUT", { repo: repo("b/two") })))).status).toBe(200)
    expect((await favorite(me("/api/favorites", send("PUT", { repo: repo("a/one", { stars: 9 }) })))).status).toBe(200)
    expect((await items(await listFavorites(me("/api/favorites")))).sort()).toEqual(["a/one", "b/two"])
    expect(await items(await listFavorites(other("/api/favorites")))).toEqual([])
    expect((await unfavorite(me("/api/favorites", send("DELETE", { fullName: "a/one" })))).status).toBe(200)
    expect(await items(await listFavorites(me("/api/favorites")))).toEqual(["b/two"])
  })
  it("rejects cross-site writes, bad input, oversized items and inactive members", async () => {
    const me = await as(friend)
    expect((await favorite(me("/api/favorites", send("PUT", { repo: repo("a/one") }, { "Content-Type": "application/json", "Origin": "https://evil.example" })))).status).toBe(400)
    expect((await favorite(me("/api/favorites", send("PUT", { repo: repo("not a repo") })))).status).toBe(400)
    expect((await favorite(me("/api/favorites", send("PUT", { repo: repo("a/big", { description: "x".repeat(20_000) }) })))).status).toBe(400)
    expect((await unfavorite(me("/api/favorites", send("DELETE", { fullName: "../x" })))).status).toBe(400)
    const blocked = await as(stranger, "blocked")
    expect((await listFavorites(blocked("/api/favorites"))).status).toBe(401)
  })
  it("imports browser favorites once without overwriting the account copy", async () => {
    const me = await as(friend)
    await favorite(me("/api/favorites", send("PUT", { repo: repo("a/one", { stars: 5 }) })))
    const r = await importFavorites(me("/api/favorites/import", send("POST", { items: [repo("a/one", { stars: 1 }), repo("c/three"), repo("bad name"), "junk"] })))
    expect(r.status).toBe(200)
    const body = await r.json() as { imported: number, items: { fullName: string, stars: number }[] }
    expect(body.imported).toBe(1)
    expect(body.items.find(i => i.fullName === "a/one")?.stars).toBe(5)
    expect(body.items.map(i => i.fullName).sort()).toEqual(["a/one", "c/three"])
  })
  it("deletes a member's favorites when the member is removed", async () => {
    const me = await as(friend)
    await favorite(me("/api/favorites", send("PUT", { repo: repo("a/one") })))
    await store().removeMember(friend.id)
    expect(await store().countFavorites(friend.id)).toBe(0)
  })
})

describe("seen API", () => {
  async function as(user: GitHubUser) {
    await ensureSchema(env.DB!)
    await store().saveProfile(user, "member", "active", "t")
    await store().setAccess(user.id, "member", "active")
    return (path: string, init: Parameters<typeof ctx>[1] = {}) => {
      const x = ctx(path, init)
      x.data.session = { gid: user.id, login: user.login, role: "member", exp: 9e9, chk: 9e9 }
      return x
    }
  }
  const post = (repos: unknown, headers: HeadersInit = json) => ({ method: "POST", body: JSON.stringify({ repos }), headers })
  const repos = async (r: Response) => ((await r.json()) as { repos: string[] }).repos.sort()

  it("records seen repos per member, drops bad names and old entries", async () => {
    const me = await as(friend)
    const other = await as(stranger)
    expect((await markSeen(me("/api/seen", post(["a/one", "b/two", "a/one", "../x", 3])))).status).toBe(200)
    expect(await repos(await listSeen(me("/api/seen")))).toEqual(["a/one", "b/two"])
    expect(await repos(await listSeen(other("/api/seen")))).toEqual([])
    await env.DB!.prepare("UPDATE gb_seen SET seen_at = ? WHERE repo = ?").bind("2000-01-01T00:00:00.000Z", "b/two").run()
    expect(await repos(await listSeen(me("/api/seen")))).toEqual(["a/one"])
    await markSeen(me("/api/seen", post(["c/three"])))
    expect(await store().listSeen(friend.id, "1999", 10)).not.toContain("b/two")
  })
  it("rejects cross-site writes and oversized batches", async () => {
    const me = await as(friend)
    expect((await markSeen(me("/api/seen", post(["a/one"], { "Content-Type": "application/json", "Origin": "https://evil.example" })))).status).toBe(400)
    expect((await markSeen(me("/api/seen", post(Array.from({ length: 101 }, (_, i) => `a/r${i}`))))).status).toBe(400)
  })
})
