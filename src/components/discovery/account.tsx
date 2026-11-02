import { type FormEvent, useCallback, useEffect, useRef, useState } from "react"
import { type InviteRow, type Me, type MemberRow, type Role, accountApi } from "./api"
import { Icon } from "./icons"
import { Section } from "./section"
import { useScrollLock } from "./use-scroll-lock"

const roleLabels: Record<Role, string> = { admin: "管理员", member: "成员" }
const statusLabels: Record<MemberRow["status"], string> = { active: "正常", pending: "待审批", blocked: "已停用" }

/** GitHub 头像；没有或加载失败（网络慢、GitHub 被拦）时显示首字母 */
function Avatar({ src, login, size = 28 }: { src: string | null, login: string, size?: number }) {
  const [failed, setFailed] = useState(false)
  return src && !failed
    ? <img className="avatar" src={src} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    : <span className="avatar letter" style={{ width: size, height: size }}>{login.charAt(0).toUpperCase()}</span>
}

/** 顶部状态栏里的头像：点开是账号菜单 */
export function AccountButton({ me, onManage }: { me: Me, onManage: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", close)
    return () => {
      document.removeEventListener("pointerdown", close)
      document.removeEventListener("keydown", close)
    }
  }, [open])
  return (
    <div className="account" ref={ref}>
      <button type="button" className="account-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`账号：${me.login}`} title={me.login} onClick={() => setOpen(o => !o)}>
        <Avatar src={me.avatar} login={me.login} />
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <div className="am-who">
            <Avatar src={me.avatar} login={me.login} size={36} />
            <span>
              <b>{me.name || me.login}</b>
              <small>{`@${me.login}`}</small>
            </span>
            <span className={`sec-chip ${me.role === "admin" ? "accent" : "neutral"}`}>{roleLabels[me.role]}</span>
          </div>
          {me.role === "admin" && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onManage()
              }}
            >
              <Icon name="bot" />
              成员管理
            </button>
          )}
          <button type="button" role="menuitem" onClick={() => void accountApi.logout()}>
            <Icon name="arrowUpRight" />
            退出登录
          </button>
        </div>
      )}
    </div>
  )
}

/** 成员管理：邀请、审批、修改角色、停用与移除。权限检查在服务端，这里只是操作入口。 */
export function MembersPanel({ onClose, notify }: { onClose: () => void, notify: (text: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [data, setData] = useState<{ me: number, members: MemberRow[], invites: InviteRow[] } | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [login, setLogin] = useState("")
  const [role, setRole] = useState<Role>("member")
  const [confirmId, setConfirmId] = useState<number | null>(null)
  useScrollLock(true)
  const reload = useCallback(async () => {
    try {
      setData(await accountApi.members())
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "读取成员失败")
    }
  }, [])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ref.current?.showModal()
    void reload()
    return () => previous?.focus({ preventScroll: true })
  }, [reload])
  const act = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true)
    try {
      await fn()
      notify(done)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作没有成功")
    } finally {
      setBusy(false)
    }
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const name = login.trim().replace(/^@/, "")
    if (!name) return
    void act(() => accountApi.invite(name, role), `已邀请 @${name}，对方用 GitHub 登录即可进入`).then(() => setLogin(""))
  }
  const pending = data?.members.filter(m => m.status === "pending") ?? []
  const members = data?.members.filter(m => m.status !== "pending") ?? []
  const locked = (m: MemberRow) => m.owner || m.id === data?.me
  return (
    <dialog
      ref={ref}
      className="sheet members"
      aria-label="成员管理"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <header className="mp-head">
        <h2>成员管理</h2>
        <button type="button" className="icon-btn" aria-label="关闭成员管理" onClick={onClose}><Icon name="x" /></button>
      </header>
      {error && <p role="alert" className="banner error">{error}</p>}
      <div className="mp-body" aria-busy={busy}>
        <Section title="邀请成员" chip={data ? `${data.invites.length} 个待使用` : undefined}>
          <form className="mp-invite" onSubmit={submit}>
            <input aria-label="GitHub 用户名" placeholder="GitHub 用户名" value={login} autoComplete="off" spellCheck={false} onChange={e => setLogin(e.target.value)} />
            <select aria-label="角色" value={role} onChange={e => setRole(e.target.value as Role)}>
              <option value="member">成员</option>
              <option value="admin">管理员</option>
            </select>
            <button type="submit" className="act primary" disabled={busy || !login.trim()}>邀请</button>
          </form>
          {data && data.invites.length > 0 && (
            <ul className="mp-list">
              {data.invites.map(i => (
                <li key={i.login}>
                  <span className="mp-name">
                    {`@${i.login}`}
                    <small>{`${roleLabels[i.role]} · ${i.invitedBy} 邀请`}</small>
                  </span>
                  <button type="button" className="link" disabled={busy} onClick={() => void act(() => accountApi.revokeInvite(i.login), `已撤销对 @${i.login} 的邀请`)}>撤销</button>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="待审批" chip={data ? `${pending.length} 人` : undefined} tone={pending.length ? "warn" : "neutral"}>
          {pending.length === 0
            ? <p className="mp-empty">没有待审批的申请。没被邀请的人用 GitHub 登录后会出现在这里。</p>
            : (
                <ul className="mp-list">
                  {pending.map(m => (
                    <li key={m.id}>
                      <Avatar src={m.avatar} login={m.login} />
                      <span className="mp-name">
                        {m.name || m.login}
                        <small>{`@${m.login}`}</small>
                      </span>
                      <button type="button" className="act primary sm" disabled={busy} onClick={() => void act(() => accountApi.update(m.id, { status: "active" }), `已通过 @${m.login}`)}>通过</button>
                      <button type="button" className="link" disabled={busy} onClick={() => void act(() => accountApi.remove(m.id), `已拒绝 @${m.login}`)}>拒绝</button>
                    </li>
                  ))}
                </ul>
              )}
        </Section>
        <Section title="成员" chip={data ? `${members.length} 人` : "读取中"}>
          <ul className="mp-list">
            {members.map(m => (
              <li key={m.id} className={m.status === "blocked" ? "off" : ""}>
                <Avatar src={m.avatar} login={m.login} />
                <span className="mp-name">
                  {m.name || m.login}
                  <small>{`@${m.login}${m.owner ? " · 站长" : ""}${m.status === "blocked" ? ` · ${statusLabels.blocked}` : ""}`}</small>
                </span>
                {locked(m)
                  ? <span className="sec-chip neutral">{roleLabels[m.role]}</span>
                  : (
                      <>
                        <select aria-label={`${m.login} 的角色`} value={m.role} disabled={busy} onChange={e => void act(() => accountApi.update(m.id, { role: e.target.value as Role }), `已把 @${m.login} 设为${roleLabels[e.target.value as Role]}`)}>
                          <option value="member">成员</option>
                          <option value="admin">管理员</option>
                        </select>
                        <button type="button" className="link" disabled={busy} onClick={() => void act(() => accountApi.update(m.id, { status: m.status === "blocked" ? "active" : "blocked" }), m.status === "blocked" ? `已恢复 @${m.login}` : `已停用 @${m.login}，最迟 10 分钟后生效`)}>{m.status === "blocked" ? "恢复" : "停用"}</button>
                        <button
                          type="button"
                          className="link danger"
                          disabled={busy}
                          title="移除后，对方再登录时会重新进入待审批"
                          onClick={() => {
                            // 两步确认：第一次点击变成「确认移除」，再点才真正移除
                            if (confirmId !== m.id) setConfirmId(m.id)
                            else void act(() => accountApi.remove(m.id), `已移除 @${m.login}`)
                          }}
                          onBlur={() => setConfirmId(id => id === m.id ? null : id)}
                        >
                          {confirmId === m.id ? "确认移除" : "移除"}
                        </button>
                      </>
                    )}
              </li>
            ))}
          </ul>
        </Section>
        <p className="mp-note">停用或移除后，对方最迟 10 分钟内失去访问。站长账号由环境变量 ADMIN_GITHUB_LOGIN 指定，不能在这里修改。</p>
      </div>
    </dialog>
  )
}
