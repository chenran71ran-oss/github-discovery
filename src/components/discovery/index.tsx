import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { type DiscoverySnapshot, type Period, type Repository, categoryNames, filterRepositories, isSnapshot } from "@shared/discovery"
import { RepoDetail } from "./detail"
import { Board } from "./board"
import { Icon, time } from "./utils"
import { useDark } from "~/hooks/useDark"
import "./style.css"

const labels = { daily: "今日", weekly: "本周", monthly: "本月" }
const storageKey = "discovery-next-favorites-v1"
function readSaved(): Record<string, Repository> {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "{}")
    return value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).filter(([key, r]) => /^[\w.-]+\/[\w.-]+$/.test(key) && r && typeof r === "object" && (r as Repository).fullName === key)) as Record<string, Repository> : {}
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
export function Discovery() {
  const { isDark, toggleDark } = useDark()
  const initial = new URLSearchParams(window.location.search)
  const [period, setPeriod] = useState<Period>((["daily", "weekly", "monthly"].includes(initial.get("period") || "") ? initial.get("period") : "daily") as Period)
  const [q, setQ] = useState(initial.get("q") || "")
  const [language, setLanguage] = useState(initial.get("language") || "")
  const [category, setCategory] = useState(initial.get("category") || "")
  const [sort, setSort] = useState("rank")
  const [view, setView] = useState<"discover" | "saved">("discover")
  const [overview, setOverview] = useState(!initial.has("period"))
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [date, setDate] = useState(/^\d{4}-\d{2}-\d{2}$/.test(initial.get("date") || "") ? initial.get("date")! : "")
  const [saved, setSaved] = useState(readSaved)
  const [active, setActive] = useState<Repository | null>(null)
  const [notice, setNotice] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)
  const query = useQuery({ queryKey: ["discovery", date], queryFn: ({ signal }) => loadSnapshot(date, signal), staleTime: 60_000, retry: 1, refetchOnWindowFocus: false })
  const dates = useQuery<string[]>({ queryKey: ["discovery-dates"], queryFn: async () => {
    const r = await fetch("/data/dates.json")
    return r.ok ? r.json() : []
  }, staleTime: 300_000 })
  const data = query.data
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark)
  }, [isDark])
  useEffect(() => {
    const params = new URLSearchParams()
    if (!overview) params.set("period", period)
    if (q) params.set("q", q)
    if (language) params.set("language", language)
    if (category) params.set("category", category)
    if (date) params.set("date", date)
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`)
  }, [period, overview, q, language, category, date])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    const sync = (e: StorageEvent) => {
      if (e.key === storageKey) setSaved(readSaved())
    }
    window.addEventListener("keydown", handler)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener("keydown", handler)
      window.removeEventListener("storage", sync)
    }
  }, [])
  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(""), 2600)
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
      setNotice(had ? "已移出收藏" : "已加入收藏，保存在当前浏览器")
    } catch {
      setNotice("浏览器存储不可用，收藏未保存")
    }
  }
  const selectPeriod = (value: Period) => {
    setPeriod(value)
    setOverview(false)
    setView("discover")
  }
  const filter = (rows: Repository[]) => {
    const result = filterRepositories(rows, q, language, category)
    return sort === "stars" ? result.sort((a, b) => b.stars - a.stars) : sort === "growth" ? result.sort((a, b) => (b.periodStars ?? -1) - (a.periodStars ?? -1)) : result
  }
  const panels = useMemo(() => {
    if (!data) return []
    if (view === "saved") return [{ id: "saved", title: "我的收藏", subtitle: "当前浏览器", color: "amber", period, items: Object.values(saved).map(r => data.periods[period].find(n => n.fullName === r.fullName) || { ...r, periodStars: null }) }]
    const categoryPeriod = overview ? "daily" : period
    const selected = data.periods[categoryPeriod]
    const periods: Period[] = overview ? ["daily", "weekly", "monthly"] : [period]
    const main = periods.map((p, i) => ({ id: p, title: "GitHub", subtitle: `${labels[p]}热榜`, color: ["blue", "green", "red"][i], period: p, items: data.periods[p] }))
    const categories = (overview ? ["AI 与智能体", "开发工具", "其他"] : categoryNames.slice(1)).map((c, i) => ({ id: c, title: c, subtitle: labels[categoryPeriod], color: ["purple", "orange", "teal", "green", "blue", "red"][i], period: categoryPeriod, items: selected.filter(r => r.category === c) })).filter(p => p.items.length)
    return [...main, ...categories]
  }, [data, view, saved, period, overview])
  const languages = [...new Set((view === "saved" ? Object.values(saved) : data ? Object.values(data.periods).flat() : []).map(r => r.language))].sort()
  return (
    <div className="news-discovery">
      <header className="news-header">
        <a className="news-brand" href="/" aria-label="开源雷达首页">
          <img src="/icon.svg" alt="" width="40" height="40" />
          <span className="font-brand">
            开源
            <span>雷达</span>
          </span>
          <small>GitHub</small>
        </a>
        <nav className="news-nav" aria-label="主导航">
          <button type="button" onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen}>更多</button>
          <button type="button" aria-pressed={view === "saved"} onClick={() => setView("saved")}>
            关注
            <small>{Object.keys(saved).length || ""}</small>
          </button>
          <button
            type="button"
            aria-pressed={view === "discover" && overview}
            onClick={() => {
              setOverview(true)
              setView("discover")
            }}
          >
            最热
          </button>
          <button type="button" aria-pressed={view === "discover" && !overview && period === "daily"} onClick={() => selectPeriod("daily")}>今日</button>
          <button type="button" aria-pressed={view === "discover" && !overview && period === "weekly"} onClick={() => selectPeriod("weekly")}>本周</button>
          <button type="button" aria-pressed={view === "discover" && !overview && period === "monthly"} onClick={() => selectPeriod("monthly")}>本月</button>
        </nav>
        <div className="news-actions">
          <button
            type="button"
            className="icon-btn"
            aria-label="刷新榜单"
            disabled={query.isFetching}
            onClick={() => {
              void query.refetch()
            }}
          >
            <Icon name={query.isFetching ? "i-ph:circle-dashed-duotone spin" : "i-ph:arrow-counter-clockwise-duotone"} />
          </button>
          <a className="icon-btn" aria-label="查看项目源码" href="https://github.com/chenran71ran-oss/github-discovery" target="_blank" rel="noreferrer"><Icon name="i-ph:github-logo-duotone" /></a>
          <button type="button" className="icon-btn" onClick={toggleDark} aria-label={isDark ? "切换浅色主题" : "切换深色主题"}><Icon name={isDark ? "i-ph:sun-duotone" : "i-ph:moon-duotone"} /></button>
        </div>
      </header>
      <main className="news-main">
        <section className="news-toolbar" aria-label="筛选榜单">
          <label className="news-search">
            <Icon name="i-ph:magnifying-glass" />
            <input ref={searchRef} name="q" type="search" aria-label="搜索项目" placeholder="搜索项目、中文简介…" value={q} onChange={e => setQ(e.target.value)} />
            <kbd>⌘ K</kbd>
          </label>
          <select name="date" aria-label="历史榜单日期" value={date} onChange={e => setDate(e.target.value)}>
            <option value="">最新榜单</option>
            {dates.data?.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <span className="news-update">{query.isPending ? "加载榜单中…" : data ? `${time(data.generatedAt)} 更新` : "暂无数据"}</span>
          <button type="button" className="filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>
            <Icon name="i-ph:sliders-horizontal-duotone" />
            筛选
          </button>
        </section>
        {filtersOpen && (
          <section className="news-filters" aria-label="更多筛选">
            <select name="language" aria-label="编程语言" value={language} onChange={e => setLanguage(e.target.value)}>
              <option value="">全部语言</option>
              {languages.map(l => <option key={l}>{l}</option>)}
            </select>
            <select name="category" aria-label="项目分类" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">全部分类</option>
              {categoryNames.slice(1).map(c => <option key={c}>{c}</option>)}
            </select>
            <select name="sort" aria-label="项目排序" value={sort} onChange={e => setSort(e.target.value)}>
              <option value="rank">榜单顺序</option>
              <option value="stars">总 Star 最多</option>
              <option value="growth">周期新增最多</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setQ("")
                setLanguage("")
                setCategory("")
                setSort("rank")
              }}
            >
              清空筛选
            </button>
          </section>
        )}
        {query.isError && (
          <div role="alert" className="news-alert">
            {query.error.message}
            <button
              type="button"
              onClick={() => {
                void query.refetch()
              }}
            >
              重试
            </button>
          </div>
        )}
        {query.isPending && <div className="news-grid" aria-label="正在加载榜单">{[1, 2, 3].map(i => <div key={i} className="news-skeleton" />)}</div>}
        {data && (
          <div className="news-grid">
            {panels.map(panel => (
              <Board
                key={panel.id}
                title={panel.title}
                subtitle={panel.subtitle}
                color={panel.color}
                period={panel.period}
                rows={filter(panel.items)}
                capturedAt={data.status[panel.period].capturedAt}
                failed={!data.status[panel.period].ok}
                saved={saved}
                onSave={toggleSave}
                onOpen={setActive}
                onRefresh={() => {
                  void query.refetch()
                }}
                refreshing={query.isFetching}
              />
            ))}
          </div>
        )}
        <footer className="news-footer">
          <p>GitHub Trending · 日 / 周 / 月榜单 · 中文速览 · 收藏保存在当前浏览器</p>
          <p>
            <a href="https://github.com/newsnext/newsnow" target="_blank" rel="noreferrer">NewsNow · MIT</a>
            {" "}
            ×
            {" "}
            <a href="https://github.com/Ibook000/GithubTrending" target="_blank" rel="noreferrer">GithubTrending · Apache-2.0</a>
            {" "}
            ·
            {" "}
            <a href="/data/latest.json" target="_blank" rel="noreferrer">榜单数据</a>
          </p>
        </footer>
      </main>
      {active && <RepoDetail key={active.fullName} repo={active} onClose={() => setActive(null)} saved={!!saved[active.fullName]} onSave={() => toggleSave(active)} />}
      <div role="status" aria-live="polite" className={`radar-toast ${notice ? "visible" : ""}`}>{notice}</div>
    </div>
  )
}
