import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useMedia } from "react-use"
import type { Period, Repository } from "@shared/discovery"
import { domains } from "@shared/taxonomy"
import { AccountButton, MembersPanel } from "./account"
import { favoritesApi, isRepoName, loadDates, loadMe, loadSnapshot, markImported, markSeenLocal, readSaved, readSeenLocal, savedKey, seenApi, wasImported, writeSaved } from "./api"
import { CategoryFilter } from "./category-filter"
import { RepoInsight, RepoSheet, time } from "./detail"
import { Icon } from "./icons"
import { type Sort, counts, sourceRows, visibleRows } from "./model"
import { DataNote, Overview } from "./overview"
import { Row, SkeletonRows, labels } from "./row"
import { Segmented } from "./segmented"
import { ModeToggle } from "./mode-toggle"
import { pageBackground, switchMode } from "./theme"
import { holdChrome, useScrollChrome } from "./use-scroll-chrome"
import { applyPwaUpdate, subscribePwaUpdateState } from "~/utils/pwa"
import { useDark } from "~/hooks/useDark"
import "./style.css"

const periods = ["daily", "weekly", "monthly"] as const
function typing(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName))
}
/** 有弹层打开时，快捷键不能穿透到后面的榜单 */
function modalOpen() {
  return !!document.querySelector(".radar-app dialog[open]")
}

const shows = ["all", "new", "unseen"] as const
type Show = typeof shows[number]

export function Discovery() {
  const { isDark, setDark } = useDark()
  const mode = isDark ? "dark" : "light"
  const [initial] = useState(() => new URLSearchParams(window.location.search))
  const [period, setPeriod] = useState<Period>((periods as readonly string[]).includes(initial.get("period") || "") ? initial.get("period") as Period : "daily")
  const [q, setQ] = useState(initial.get("q") || "")
  const [language, setLanguage] = useState(initial.get("language") || "")
  const [domain, setDomain] = useState(domains.some(d => d.id === initial.get("domain")) ? initial.get("domain")! : "")
  const [category, setCategory] = useState(initial.get("category") || "")
  const [sort, setSort] = useState<Sort>("rank")
  const [view, setView] = useState<"discover" | "saved">(initial.get("view") === "saved" ? "saved" : "discover")
  // 只看首次上榜 / 只看没看过的
  const [show, setShow] = useState<Show>(shows.includes(initial.get("show") as Show) ? initial.get("show") as Show : "all")
  const [updateReady, setUpdateReady] = useState(false)
  const [date, setDate] = useState(/^\d{4}-\d{2}-\d{2}$/.test(initial.get("date") || "") ? initial.get("date")! : "")
  const [local, setLocal] = useState(readSaved)
  // 账号里的收藏；null 表示还没读到（或没有账号层），这时显示浏览器里的
  const [remote, setRemote] = useState<Record<string, Repository> | null>(null)
  const [activeName, setActiveName] = useState(isRepoName(initial.get("repo")) ? initial.get("repo")! : "")
  const [notice, setNotice] = useState("")
  const [managing, setManaging] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLOListElement>(null)
  // 宽屏把解读放在右侧栏，窄屏用底部面板
  const wide = useMedia("(min-width: 1080px)", true)
  const chromeHidden = useScrollChrome()
  const query = useQuery({ queryKey: ["discovery", date], queryFn: ({ signal }) => loadSnapshot(date, signal), staleTime: 60_000, retry: 1, refetchOnWindowFocus: false })
  const dates = useQuery({ queryKey: ["discovery-dates"], queryFn: loadDates, staleTime: 300_000 })
  // 账号层（Pages Functions）不存在时为 null，例如本地纯静态开发
  const me = useQuery({ queryKey: ["me"], queryFn: loadMe, staleTime: 300_000, retry: false, refetchOnWindowFocus: false })
  const data = query.data
  const login = me.data?.login || ""
  const remoteQuery = useQuery({ queryKey: ["favorites", login], queryFn: favoritesApi.list, enabled: !!login, staleTime: 60_000, retry: 1, refetchOnWindowFocus: false })
  const saved = login && remote ? remote : local
  useEffect(() => {
    if (!login || !remoteQuery.data) return
    let alive = true
    const fromBrowser = Object.values(readSaved())
    if (wasImported(login) || !fromBrowser.length) {
      markImported(login)
      setRemote(remoteQuery.data)
      return
    }
    // 第一次登录：把这台浏览器里的收藏并进账号（账号里已有的不覆盖）
    favoritesApi.import(fromBrowser).then((result) => {
      if (!alive) return
      markImported(login)
      setRemote(result.saved)
      if (result.imported) setNotice(`已把本机的 ${result.imported} 个收藏同步到账号`)
    }, () => {
      if (alive) setRemote(remoteQuery.data)
    })
    return () => {
      alive = false
    }
  }, [login, remoteQuery.data])

  useEffect(() => {
    // 让 iOS 的状态栏、过度滚动区域跟随当前配色
    const root = document.documentElement
    const meta = document.querySelector("meta[name=\"theme-color\"]")
    const previous = meta?.getAttribute("content")
    root.classList.toggle("dark", isDark)
    root.style.backgroundColor = pageBackground[mode]
    meta?.setAttribute("content", pageBackground[mode])
    return () => {
      root.style.removeProperty("background-color")
      if (previous) meta?.setAttribute("content", previous)
    }
  }, [isDark, mode])
  useEffect(() => {
    const params = new URLSearchParams()
    if (period !== "daily") params.set("period", period)
    if (view === "saved") params.set("view", "saved")
    if (show !== "all") params.set("show", show)
    if (q) params.set("q", q)
    if (language) params.set("language", language)
    if (domain) params.set("domain", domain)
    if (category) params.set("category", category)
    if (date) params.set("date", date)
    if (activeName) params.set("repo", activeName)
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`)
  }, [period, view, show, q, language, domain, category, date, activeName])
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === savedKey) setLocal(readSaved())
    }
    window.addEventListener("storage", sync)
    return () => window.removeEventListener("storage", sync)
  }, [])
  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(""), 2200)
    return () => clearTimeout(id)
  }, [notice])

  // 回调保持稳定，榜单行（memo）在切换明暗、打开解读时不必全部重新渲染
  const savedRef = useRef(saved)
  savedRef.current = saved
  const accountRef = useRef(false)
  accountRef.current = !!(login && remote)
  const toggleSave = useCallback((repo: Repository) => {
    const previous = savedRef.current
    const next = { ...previous }
    const had = !!next[repo.fullName]
    if (had) delete next[repo.fullName]
    else next[repo.fullName] = repo
    if (accountRef.current) {
      // 先更新界面，失败时恢复
      setRemote(next)
      setNotice(had ? "已移出收藏" : "已收藏，已同步到账号")
      const done = had ? favoritesApi.remove(repo.fullName) : favoritesApi.save(repo)
      done.catch((error: Error) => {
        setRemote((current) => {
          const restored = { ...current }
          if (had) restored[repo.fullName] = previous[repo.fullName]
          else delete restored[repo.fullName]
          return restored
        })
        setNotice(error.message || "收藏没有同步成功，请稍后重试")
      })
      return
    }
    if (writeSaved(next)) {
      setLocal(next)
      setNotice(had ? "已移出收藏" : "已收藏，保存在当前浏览器")
    } else {
      setNotice("浏览器存储不可用，收藏未保存")
    }
  }, [])
  // ---------- 看过的项目 ----------
  const seenQuery = useQuery({ queryKey: ["seen", login], queryFn: seenApi.list, enabled: !!login, staleTime: 300_000, retry: 1, refetchOnWindowFocus: false })
  const [seenLocal] = useState(readSeenLocal)
  const [seenNow, setSeenNow] = useState<Set<string>>(() => new Set())
  const seen = useMemo(() => {
    const base = login ? seenQuery.data : seenLocal
    return base ? new Set([...base, ...seenNow]) : seenNow
  }, [login, seenQuery.data, seenLocal, seenNow])
  // 账号模式下攒一小批再上报，关页面时用 keepalive 发出
  const pendingSeen = useRef<string[]>([])
  const flushTimer = useRef<ReturnType<typeof setTimeout>>()
  const flushSeen = useCallback(() => {
    clearTimeout(flushTimer.current)
    flushTimer.current = undefined
    while (pendingSeen.current.length) void seenApi.mark(pendingSeen.current.splice(0, 100))
  }, [])
  useEffect(() => {
    if (!activeName || seen.has(activeName)) return
    setSeenNow(current => new Set(current).add(activeName))
    if (!login) {
      markSeenLocal([activeName])
      return
    }
    pendingSeen.current.push(activeName)
    flushTimer.current ??= setTimeout(flushSeen, 2000)
  }, [activeName, seen, login, flushSeen])
  useEffect(() => {
    const leave = () => {
      if (document.visibilityState === "hidden") flushSeen()
    }
    document.addEventListener("visibilitychange", leave)
    return () => document.removeEventListener("visibilitychange", leave)
  }, [flushSeen])
  // 「没看过」筛选按打开筛选那一刻的记录算，边看边筛时刚看过的项目不会从列表里跳走
  const [unseenBase, setUnseenBase] = useState<Set<string> | null>(null)
  const chooseShow = (next: Show) => {
    setUnseenBase(next === "unseen" ? new Set(seen) : null)
    setShow(next)
  }

  // ---------- 新版本：刚打开或页面在后台时直接生效，否则提示 ----------
  useEffect(() => subscribePwaUpdateState((state) => {
    if (state !== "ready") return
    if (performance.now() < 8000 || document.visibilityState === "hidden") void applyPwaUpdate().catch(() => setUpdateReady(true))
    else setUpdateReady(true)
  }), [])
  useEffect(() => {
    if (!updateReady) return
    const apply = () => {
      if (document.visibilityState === "hidden") void applyPwaUpdate().catch(() => {})
    }
    document.addEventListener("visibilitychange", apply)
    return () => document.removeEventListener("visibilitychange", apply)
  }, [updateReady])

  const copyLink = useCallback((repo: Repository) => {
    const url = `${window.location.origin}/?repo=${encodeURIComponent(repo.fullName)}`
    navigator.clipboard?.writeText(url).then(() => setNotice("链接已复制"), () => setNotice("复制失败，请手动复制地址栏"))
  }, [])

  const toggleMode = (origin: { x: number, y: number }) => switchMode(() => setDark(isDark ? "light" : "dark"), origin)
  const source = useMemo(() => sourceRows(data, period, view === "saved" ? saved : null), [view, saved, data, period])
  const languages = useMemo(() => [...new Set(source.map(r => r.language))].sort(), [source])
  const tally = useMemo(() => counts(source), [source])
  const filteredRows = useMemo(() => visibleRows(source, { q, language, domain, category, sort }), [source, q, language, domain, category, sort])
  const today = data?.date || ""
  const isFresh = useCallback((r: Repository) => !!today && r.firstSeen === today, [today])
  const freshCount = useMemo(() => filteredRows.filter(isFresh).length, [filteredRows, isFresh])
  const unseenCount = useMemo(() => filteredRows.filter(r => !seen.has(r.fullName)).length, [filteredRows, seen])
  const showing = view === "saved" ? "all" : show
  const repos = useMemo(() => showing === "new" ? filteredRows.filter(isFresh) : showing === "unseen" ? filteredRows.filter(r => !(unseenBase || seen).has(r.fullName)) : filteredRows, [filteredRows, showing, isFresh, unseenBase, seen])
  // 搜索时，被领域 / 分类 / 语言筛选挡住的匹配项数量，提示用户不要漏看
  const hiddenMatches = useMemo(() => q.trim() && (language || domain || category) ? visibleRows(source, { q, language: "", domain: "", category: "", sort }).length - filteredRows.length : 0, [source, q, language, domain, category, sort, filteredRows.length])
  // 选中的项目优先取当前周期的数据，周期切换后名次与增量跟着变
  const active = useMemo(() => {
    if (!activeName) return null
    return data?.periods[period].find(r => r.fullName === activeName) || source.find(r => r.fullName === activeName) || (saved[activeName] ? { ...saved[activeName], rank: 0, previousRank: null, periodStars: null } : null) || periods.map(p => data?.periods[p].find(r => r.fullName === activeName)).find(Boolean) || null
  }, [activeName, data, period, source, saved])

  const wideRef = useRef(wide)
  wideRef.current = wide
  const open = useCallback((repo: Repository) => setActiveName(name => name === repo.fullName && wideRef.current ? "" : repo.fullName), [])
  const filtered = !!(q || language || domain || category)
  const reset = () => {
    setQ("")
    setLanguage("")
    setDomain("")
    setCategory("")
  }
  const switchView = (next: "discover" | "saved") => {
    setView(next)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // 键盘：/ 或 ⌘K 搜索，J/K 上下切换，S 收藏，Esc 关闭
  const keys = useRef({ repos, active, wide })
  keys.current = { repos, active, wide }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 中文输入法组字时的按键不是快捷键；但输入法开着时按 / 键（报成 Process 或「、」）仍然打开搜索
      if (e.isComposing) return
      const key = e.code === "Slash" && !typing(e.target) ? "/" : e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (key === "Process") return
      if ((e.ctrlKey || e.metaKey) && key === "k") {
        e.preventDefault()
        searchRef.current?.focus()
        return
      }
      if (typing(e.target)) {
        if (key === "Escape") (e.target as HTMLElement).blur()
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey || modalOpen()) return
      const { repos, active, wide } = keys.current
      if (key === "/") {
        e.preventDefault()
        searchRef.current?.focus()
      } else if ((key === "j" || key === "k") && repos.length && wide) {
        e.preventDefault()
        const i = active ? repos.findIndex(r => r.fullName === active.fullName) : -1
        const next = repos[Math.min(repos.length - 1, Math.max(0, i < 0 ? 0 : i + (key === "j" ? 1 : -1)))]
        setActiveName(next.fullName)
        // 焦点跟着高亮走：之后按 Enter / 空格作用在同一行；滚动时悬浮栏不收起
        holdChrome(600)
        const row = listRef.current?.querySelector<HTMLElement>(`[data-name="${CSS.escape(next.fullName)}"]`)
        row?.querySelector<HTMLElement>(".row-main")?.focus({ preventScroll: true })
        row?.scrollIntoView({ block: "nearest" })
      } else if (key === "s" && active) {
        toggleSave(active)
      } else if (key === "Escape" && active && wide) {
        setActiveName("")
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const stale = data && Date.now() - Date.parse(data.status[period].capturedAt) > 30 * 3600000
  const savedCount = Object.keys(saved).length
  const emptySaved = view === "saved" && !savedCount
  // 切换周期、视图、分类或排序时列表轻轻淡入；输入搜索词时不重放，避免打字时闪动
  const listKey = `${view}-${period}-${domain}-${category}-${language}-${sort}-${date}`

  const list = query.isPending
    ? <SkeletonRows />
    : repos.length > 0
      ? (
          <ol className="rows" key={listKey} ref={listRef}>
            {repos.map((repo, i) => (
              <Row key={repo.fullName} repo={repo} period={period} index={i} showCategory={!category} selected={wide && active?.fullName === repo.fullName} saved={!!saved[repo.fullName]} seen={seen.has(repo.fullName) && !(wide && active?.fullName === repo.fullName)} fresh={isFresh(repo)} onSave={toggleSave} onOpen={open} />
            ))}
          </ol>
        )
      : (
          <div className="empty">
            <Icon name={emptySaved ? "bookmark" : "search"} />
            <h3>{emptySaved ? "还没有收藏" : "没有匹配的项目"}</h3>
            <p>{emptySaved ? "点击项目右侧的书签，就能把它收进这里。" : "换个关键词，或清空筛选条件。"}</p>
            <button
              type="button"
              className="act"
              onClick={() => {
                reset()
                if (emptySaved) switchView("discover")
              }}
            >
              {emptySaved ? "去发现项目" : "清空筛选"}
            </button>
          </div>
        )

  const discoverLabel = (
    <>
      <Icon name="compass" />
      发现
    </>
  )
  const savedLabel = (
    <>
      <Icon name="bookmark" />
      收藏
      {savedCount > 0 && <span className="badge-n">{savedCount}</span>}
    </>
  )

  return (
    <div className="radar-app" data-mode={mode}>
      <div className="backdrop" aria-hidden="true" />
      <header className={`chrome top glass ${chromeHidden ? "hidden" : ""}`}>
        <a className="brand" href="/" aria-label="GIT Bot 首页">
          <span className="brand-mark"><Icon name="bot" /></span>
          <span className="brand-name">
            GIT
            {" "}
            <b>Bot</b>
          </span>
        </a>
        <Segmented<Period>
          className="period"
          label="榜单周期"
          value={period}
          onChange={setPeriod}
          options={periods.map(p => ({ value: p, label: labels[p] }))}
        />
        <i className="chrome-sep" aria-hidden="true" />
        <ModeToggle dark={isDark} onToggle={toggleMode} />
        {me.data && <AccountButton me={me.data} onManage={() => setManaging(true)} />}
      </header>

      <div className="layout">
        <main className="main">
          <div className="toolbar">
            <label className="search">
              <Icon name="search" />
              <input ref={searchRef} type="search" aria-label="搜索项目" placeholder="搜索项目、用途、技术栈" value={q} onChange={e => setQ(e.target.value)} />
              {q
                ? <button type="button" className="clear" aria-label="清空搜索" onClick={() => setQ("")}><Icon name="x" /></button>
                : <kbd className="hide-sm">/</kbd>}
            </label>
            <div className="selects">
              <label className={`select ${language ? "set" : ""}`}>
                <select aria-label="编程语言" value={language} onChange={e => setLanguage(e.target.value)}>
                  <option value="">全部语言</option>
                  {languages.map(l => <option key={l}>{l}</option>)}
                </select>
              </label>
              <label className={`select ${sort !== "rank" ? "set" : ""}`}>
                <select aria-label="排序" value={sort} onChange={e => setSort(e.target.value as Sort)}>
                  <option value="rank">榜单顺序</option>
                  <option value="growth">新增最多</option>
                  <option value="stars">总 Star 最多</option>
                </select>
              </label>
              <label className={`select ${date ? "set" : ""}`}>
                <select aria-label="历史榜单日期" value={date} onChange={e => setDate(e.target.value)}>
                  <option value="">最新榜单</option>
                  {dates.data?.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
            </div>
          </div>
          <CategoryFilter total={source.length} byDomain={tally.byDomain} byCategory={tally.byCategory} domain={domain} category={category} onDomain={setDomain} onCategory={setCategory} />

          <div className="list-head">
            <h1>
              {view === "saved" ? "我的收藏" : `${labels[period]}榜单`}
              <span className="count">{query.isPending ? "" : repos.length}</span>
            </h1>
            {view === "discover" && data && (
              <div className="show-filter" role="group" aria-label="只看">
                <button type="button" aria-pressed={show === "new"} onClick={() => chooseShow(show === "new" ? "all" : "new")} title="今天第一次出现在 GIT Bot 上的项目">
                  首次上榜
                  <b>{freshCount}</b>
                </button>
                <button type="button" aria-pressed={show === "unseen"} onClick={() => chooseShow(show === "unseen" ? "all" : "unseen")} title="还没有点开看过的项目">
                  没看过
                  <b>{unseenCount}</b>
                </button>
              </div>
            )}
            {hiddenMatches > 0
              ? (
                  <button
                    type="button"
                    className="link"
                    onClick={() => {
                      setLanguage("")
                      setDomain("")
                      setCategory("")
                    }}
                  >
                    {`筛选之外还有 ${hiddenMatches} 个匹配，查看全部`}
                  </button>
                )
              : filtered && <button type="button" className="link" onClick={reset}>清除筛选</button>}
            <span className="updated">{data ? `${date ? "历史快照" : "更新于"} ${time(data.status[period].capturedAt)}` : ""}</span>
          </div>
          {query.isError && (
            <div role="alert" className="banner error">
              {query.error.message}
              <button type="button" className="link" onClick={() => void query.refetch()}>重新加载</button>
            </div>
          )}
          {stale && !date && <div role="status" className="banner">这份榜单已超过 30 小时未更新，展示的是已保存的真实快照。</div>}
          {data && !data.status[period].ok && <div className="banner">{data.status[period].error}</div>}
          {list}
          <DataNote aiConfigured={data?.enrichment.aiConfigured} />
          <footer className="foot">
            <span>
              Built on
              {" "}
              <a href="https://github.com/newsnext/newsnow" target="_blank" rel="noreferrer">NewsNow</a>
              {" × "}
              <a href="https://github.com/Ibook000/GithubTrending" target="_blank" rel="noreferrer">GithubTrending</a>
            </span>
            <a href="https://github.com/chenran71ran-oss/github-discovery" target="_blank" rel="noreferrer">
              <Icon name="github" />
              源码
            </a>
            <a href="/data/latest.json" target="_blank" rel="noreferrer">
              开放数据
              <Icon name="arrowUpRight" />
            </a>
          </footer>
        </main>
        {wide && (
          <aside className="pane" aria-label={active ? "项目解读" : "榜单概况"}>
            <div className="pane-in" key={active ? "detail" : "overview"}>
              {active
                ? <RepoInsight key={active.fullName} repo={active} period={period} saved={!!saved[active.fullName]} onSave={() => toggleSave(active)} onClose={() => setActiveName("")} onCopyLink={() => copyLink(active)} />
                : <Overview data={data} period={period} onOpen={open} />}
            </div>
          </aside>
        )}
      </div>

      {managing && <MembersPanel onClose={() => setManaging(false)} notify={setNotice} />}
      {!wide && active && <RepoSheet key={active.fullName} repo={active} period={period} saved={!!saved[active.fullName]} onSave={() => toggleSave(active)} onClose={() => setActiveName("")} onCopyLink={() => copyLink(active)} />}
      <nav className={`chrome bottom ${chromeHidden ? "hidden" : ""}`} aria-label="底部导航">
        <Segmented<"discover" | "saved">
          className="tabs glass"
          label="视图"
          value={view}
          onChange={switchView}
          options={[
            { value: "discover", label: discoverLabel },
            { value: "saved", label: savedLabel },
          ]}
        />
      </nav>
      <div role="status" aria-live="polite" className={`toast ${notice ? "visible" : ""}`}>{notice}</div>
      {updateReady && !notice && (
        <button type="button" className="update-pill" onClick={() => void applyPwaUpdate().catch(() => setNotice("更新没有成功，请手动刷新页面"))}>
          <Icon name="refresh" />
          新版本已就绪，点击刷新
        </button>
      )}
    </div>
  )
}
