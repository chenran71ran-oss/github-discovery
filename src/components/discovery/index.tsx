import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useMedia } from "react-use"
import { type DiscoverySnapshot, type Period, type Repository, categoryNames, filterRepositories, isSnapshot } from "@shared/discovery"
import { RepoInsight, RepoSheet, time } from "./detail"
import { Icon } from "./icons"
import { DataNote, Overview } from "./overview"
import { Row, SkeletonRows, labels } from "./row"
import { Segmented } from "./segmented"
import { type RadarTheme, findTheme, readThemeId, saveThemeId, themeVars } from "./theme"
import { ThemePicker } from "./theme-picker"
import { useDark } from "~/hooks/useDark"
import "./style.css"

const periods = ["daily", "weekly", "monthly"] as const
const storageKey = "discovery-next-favorites-v1"
const fullName = /^[\w.-]+\/[\w.-]+$/

function readSaved(): Record<string, Repository> {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "{}")
    return value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).filter(([key, r]) => fullName.test(key) && r && typeof r === "object" && (r as Repository).fullName === key)) as Record<string, Repository> : {}
  } catch {
    return {}
  }
}
async function loadSnapshot(date = "", signal?: AbortSignal): Promise<DiscoverySnapshot> {
  const response = await fetch(date ? `/data/history/${date}.json` : "/data/latest.json", { signal, cache: "no-cache" })
  if (!response.ok) throw new Error("榜单暂时没有加载成功，请稍后重试。")
  const value: unknown = await response.json()
  if (!isSnapshot(value)) throw new Error("榜单数据格式异常，暂时无法展示。")
  return value
}
function typing(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName))
}

export function Discovery() {
  const { isDark, colorScheme, setDark, toggleDark } = useDark()
  const [darkId, setDarkId] = useState(() => readThemeId("dark"))
  const [lightId, setLightId] = useState(() => readThemeId("light"))
  const theme = findTheme(isDark ? darkId : lightId, isDark ? "dark" : "light")
  const [initial] = useState(() => new URLSearchParams(window.location.search))
  const [period, setPeriod] = useState<Period>((periods as readonly string[]).includes(initial.get("period") || "") ? initial.get("period") as Period : "daily")
  const [q, setQ] = useState(initial.get("q") || "")
  const [language, setLanguage] = useState(initial.get("language") || "")
  const [category, setCategory] = useState(initial.get("category") || "")
  const [sort, setSort] = useState("rank")
  const [view, setView] = useState<"discover" | "saved">(initial.get("view") === "saved" ? "saved" : "discover")
  const [date, setDate] = useState(/^\d{4}-\d{2}-\d{2}$/.test(initial.get("date") || "") ? initial.get("date")! : "")
  const [saved, setSaved] = useState(readSaved)
  const [activeName, setActiveName] = useState(fullName.test(initial.get("repo") || "") ? initial.get("repo")! : "")
  const [pickerOpen, setPickerOpen] = useState(false)
  const [notice, setNotice] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLOListElement>(null)
  // 宽屏把解读放在右侧栏，窄屏用底部面板
  const wide = useMedia("(min-width: 1080px)", true)
  const query = useQuery({ queryKey: ["discovery", date], queryFn: ({ signal }) => loadSnapshot(date, signal), staleTime: 60_000, retry: 1, refetchOnWindowFocus: false })
  const dates = useQuery<string[]>({ queryKey: ["discovery-dates"], queryFn: async () => {
    const r = await fetch("/data/dates.json")
    return r.ok ? r.json() : []
  }, staleTime: 300_000 })
  const data = query.data

  useEffect(() => {
    // 让 iOS 的状态栏、过度滚动区域跟随当前配色
    const root = document.documentElement
    const meta = document.querySelector("meta[name=\"theme-color\"]")
    const previous = meta?.getAttribute("content")
    root.classList.toggle("dark", isDark)
    root.style.backgroundColor = theme.bg
    meta?.setAttribute("content", theme.bg)
    return () => {
      root.style.removeProperty("background-color")
      if (previous) meta?.setAttribute("content", previous)
    }
  }, [isDark, theme.bg])
  useEffect(() => {
    const params = new URLSearchParams()
    if (period !== "daily") params.set("period", period)
    if (view === "saved") params.set("view", "saved")
    if (q) params.set("q", q)
    if (language) params.set("language", language)
    if (category) params.set("category", category)
    if (date) params.set("date", date)
    if (activeName) params.set("repo", activeName)
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`)
  }, [period, view, q, language, category, date, activeName])
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === storageKey) setSaved(readSaved())
    }
    window.addEventListener("storage", sync)
    return () => window.removeEventListener("storage", sync)
  }, [])
  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(""), 2200)
    return () => clearTimeout(id)
  }, [notice])

  const toggleSave = (repo: Repository) => {
    const next = { ...saved }
    const had = !!next[repo.fullName]
    if (had) delete next[repo.fullName]
    else next[repo.fullName] = repo
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
      setSaved(next)
      setNotice(had ? "已移出收藏" : "已收藏，保存在当前浏览器")
    } catch {
      setNotice("浏览器存储不可用，收藏未保存")
    }
  }
  const pickTheme = (picked: RadarTheme) => {
    saveThemeId(picked)
    if (picked.mode === "dark") setDarkId(picked.id)
    else setLightId(picked.id)
    setDark(picked.mode)
  }
  // 收藏里不在当前周期榜单上的项目：没有这个周期的名次和增量，不能沿用收藏时另一个周期的数字
  const source = useMemo(() => view === "saved" ? Object.values(saved).map(r => data?.periods[period].find(n => n.fullName === r.fullName) || { ...r, rank: 0, previousRank: null, periodStars: null }) : data?.periods[period] || [], [view, saved, data, period])
  const languages = useMemo(() => [...new Set(source.map(r => r.language))].sort(), [source])
  const repos = useMemo(() => {
    const rows = filterRepositories(source, q, language, category)
    return sort === "stars" ? rows.sort((a, b) => b.stars - a.stars) : sort === "growth" ? rows.sort((a, b) => (b.periodStars ?? -1) - (a.periodStars ?? -1)) : rows.sort((a, b) => (a.rank || Infinity) - (b.rank || Infinity))
  }, [source, q, language, category, sort])
  // 选中的项目优先取当前周期的数据，周期切换后名次与增量跟着变
  const active = useMemo(() => {
    if (!activeName) return null
    return data?.periods[period].find(r => r.fullName === activeName) || source.find(r => r.fullName === activeName) || (saved[activeName] ? { ...saved[activeName], rank: 0, previousRank: null, periodStars: null } : null) || periods.map(p => data?.periods[p].find(r => r.fullName === activeName)).find(Boolean) || null
  }, [activeName, data, period, source, saved])

  const open = (repo: Repository) => setActiveName(name => name === repo.fullName && wide ? "" : repo.fullName)
  const filtered = !!(q || language || category)
  const reset = () => {
    setQ("")
    setLanguage("")
    setCategory("")
  }
  const switchView = (next: "discover" | "saved") => {
    setView(next)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // 键盘：/ 或 ⌘K 搜索，J/K 上下切换，S 收藏，Esc 关闭
  const keys = useRef({ repos, active, wide })
  keys.current = { repos, active, wide }
  const saveRef = useRef(toggleSave)
  saveRef.current = toggleSave
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        searchRef.current?.focus()
        return
      }
      if (typing(e.target)) {
        if (e.key === "Escape") (e.target as HTMLElement).blur()
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const { repos, active, wide } = keys.current
      if (e.key === "/") {
        e.preventDefault()
        searchRef.current?.focus()
      } else if ((e.key === "j" || e.key === "k") && repos.length && wide) {
        const i = active ? repos.findIndex(r => r.fullName === active.fullName) : -1
        const next = repos[Math.min(repos.length - 1, Math.max(0, i < 0 ? 0 : i + (e.key === "j" ? 1 : -1)))]
        setActiveName(next.fullName)
        listRef.current?.querySelector<HTMLElement>(`[data-name="${CSS.escape(next.fullName)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" })
      } else if (e.key === "s" && active) {
        saveRef.current(active)
      } else if (e.key === "Escape" && active && wide) {
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
  const listKey = `${view}-${period}-${category}-${language}-${sort}-${date}`
  const categoryCount = (c: string) => c ? source.filter(r => r.category === c).length : source.length

  const list = query.isPending
    ? <SkeletonRows />
    : repos.length > 0
      ? (
          <ol className="rows" key={listKey} ref={listRef}>
            {repos.map((repo, i) => (
              <Row key={repo.fullName} repo={repo} period={period} index={i} showCategory={!category} selected={wide && active?.fullName === repo.fullName} saved={!!saved[repo.fullName]} onSave={toggleSave} onOpen={open} />
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

  return (
    <div className="radar-app" data-mode={theme.mode} style={themeVars(theme)}>
      <div className="backdrop" aria-hidden="true" />
      <header className="topbar">
        <div className="topbar-in">
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
          <div className="actions">
            <button type="button" className={`saved-btn ${view === "saved" ? "on" : ""}`} aria-pressed={view === "saved"} onClick={() => switchView(view === "saved" ? "discover" : "saved")}>
              <Icon name="bookmark" />
              <span className="label">收藏</span>
              {savedCount > 0 && <span className="badge-n">{savedCount}</span>}
            </button>
            <button type="button" className="icon-btn" aria-label="刷新榜单" title="刷新榜单" disabled={query.isFetching} onClick={() => void query.refetch()}><Icon name="refresh" className={query.isFetching ? "spin" : ""} /></button>
            <button type="button" className="icon-btn" aria-label="选择配色" title="配色" aria-expanded={pickerOpen} onClick={() => setPickerOpen(o => !o)}><Icon name="palette" /></button>
            <button type="button" className="icon-btn" aria-label={isDark ? "切换浅色主题" : "切换深色主题"} title={isDark ? "浅色" : "深色"} onClick={toggleDark}><Icon name={isDark ? "sun" : "moon"} /></button>
            <a className="icon-btn hide-sm" href="https://github.com/chenran71ran-oss/github-discovery" target="_blank" rel="noreferrer" aria-label="查看项目源码" title="源码"><Icon name="github" /></a>
          </div>
        </div>
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
                <select aria-label="排序" value={sort} onChange={e => setSort(e.target.value)}>
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
          <div className="chips" role="group" aria-label="项目分类">
            {categoryNames.map((c, i) => {
              const value = i ? c : ""
              const count = categoryCount(value)
              if (i && !count && category !== value) return null
              return (
                <button key={c} type="button" className="chip" aria-pressed={category === value} onClick={() => setCategory(value)}>
                  {c}
                  <span className="n">{count}</span>
                </button>
              )
            })}
          </div>

          <div className="list-head">
            <h1>
              {view === "saved" ? "我的收藏" : `${labels[period]}榜单`}
              <span className="count">{query.isPending ? "" : repos.length}</span>
            </h1>
            {filtered && <button type="button" className="link" onClick={reset}>清除筛选</button>}
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
            <a href="/data/latest.json" target="_blank" rel="noreferrer">
              开放数据
              <Icon name="arrowUpRight" />
            </a>
          </footer>
        </main>
        {wide && (
          <aside className="pane" aria-label={active ? "项目解读" : "榜单概况"}>
            <div className="pane-in" key={active?.fullName || "overview"}>
              {active
                ? <RepoInsight repo={active} period={period} saved={!!saved[active.fullName]} onSave={() => toggleSave(active)} onClose={() => setActiveName("")} />
                : <Overview data={data} period={period} language={language} onLanguage={setLanguage} onOpen={open} />}
            </div>
          </aside>
        )}
      </div>

      {!wide && active && <RepoSheet key={active.fullName} repo={active} period={period} saved={!!saved[active.fullName]} onSave={() => toggleSave(active)} onClose={() => setActiveName("")} />}
      <ThemePicker open={pickerOpen} scheme={colorScheme} activeId={theme.id} onPick={pickTheme} onAuto={() => setDark("auto")} onClose={() => setPickerOpen(false)} />
      <div role="status" aria-live="polite" className={`toast ${notice ? "visible" : ""}`}>{notice}</div>
    </div>
  )
}
