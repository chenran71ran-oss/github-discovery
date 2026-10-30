import { type CSSProperties, type PointerEvent, useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { type DiscoverySnapshot, type Period, type Repository, categoryNames, compact, filterRepositories, isBreakout, isSnapshot } from "@shared/discovery"
import { useDark } from "~/hooks/useDark"
import { RepoDetail, time } from "./detail"
import { Icon, RepoIcon } from "./icons"
import { Segmented } from "./segmented"
import { type RadarTheme, findTheme, readThemeId, saveThemeId, themeVars } from "./theme"
import { ThemePicker } from "./theme-picker"
import "./style.css"

const labels = { daily: "今日", weekly: "本周", monthly: "本月" } as const
const periodIcons = { daily: "flame", weekly: "trend", monthly: "calendar" } as const
const periods = ["daily", "weekly", "monthly"] as const
const storageKey = "discovery-next-favorites-v1"
const sourceLabels = { "ai-readme": "README 解读", "upstream": "中文速览", "editorial": "资料速览", "machine": "机器翻译", "pending": "解读待补充" } as const
const languageColors: Record<string, string> = {
  Python: "#4584c4", TypeScript: "#3a7bd5", JavaScript: "#e0bf3f", Rust: "#dea584", Go: "#00add8", C: "#8990a0", "C++": "#f34b7d", Java: "#c0782a", Kotlin: "#a97bff", HTML: "#e34c26", CSS: "#8e63c4", Shell: "#89e051", Swift: "#f05138",
}
const categoryHues: Record<string, number> = { "AI 与智能体": 262, "开发工具": 212, "前端与界面": 290, "自托管": 152, "数据与基础设施": 32, "安全与隐私": 0, "移动与桌面": 180, "学习与研究": 330, "其他": 210 }
type Layout = "list" | "board"

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

interface RowProps {
  repo: Repository
  period: Period
  index: number
  showCategory: boolean
  saved: boolean
  onSave: (repo: Repository) => void
  onOpen: (repo: Repository) => void
}
function Row({ repo, period, index, showCategory, saved, onSave, onOpen }: RowProps) {
  const [owner, name] = repo.fullName.split("/")
  const moved = repo.previousRank ? repo.previousRank - repo.rank : 0
  // 搜索来的新项目没有周期增量，改为显示建了几天
  const created = repo.createdAt ? Date.parse(repo.createdAt) : Number.NaN
  const age = Number.isFinite(created) ? Math.max(1, Math.ceil((Date.now() - created) / 86400000)) : null
  return (
    <li className={`row card ${repo.rank && repo.rank <= 3 ? "top" : ""}`} style={{ "--i": Math.min(index, 14) } as CSSProperties}>
      <span className={`rk ${repo.rank && repo.rank <= 3 ? "hi" : ""}`}>{repo.rank ? String(repo.rank).padStart(2, "0") : "—"}</span>
      <RepoIcon fullName={repo.fullName} />
      <div className="head">
        <button type="button" className="name" onClick={() => onOpen(repo)}>{name}</button>
        <span className="own">{owner}</span>
        {isBreakout(repo, period) && (
          <span className="hot" title="新增 Star 占总数的比例很高，是刚冒头的项目">
            <Icon name="flame" />
            爆发
          </span>
        )}
      </div>
      <p className="zh">{repo.summary || repo.description}</p>
      <div className="meta">
        <span className="lang"><i style={{ backgroundColor: languageColors[repo.language] || "#9b8ca9" }} />{repo.language}</span>
        <span className="stars"><Icon name="star" />{compact(repo.stars)}</span>
        {repo.origin === "language" && <span className="pool" title="来自该语言自己的 Trending 榜，不在总榜里">语言榜</span>}
        {repo.origin === "search" && <span className="pool new" title={`近期新建、Star 增长很快的项目${repo.createdAt ? ` · 创建于 ${repo.createdAt.slice(0, 10)}` : ""}`}>新项目</span>}
        {showCategory && <span className="cat" style={{ "--ch": categoryHues[repo.category] ?? 190 } as CSSProperties}>{repo.category}</span>}
        <span className={`src ${repo.summary ? "" : "pending"}`}>{`✦ ${sourceLabels[repo.summarySource]}`}</span>
        {moved !== 0 && <span className={`move ${moved > 0 ? "up" : "down"}`}>{`${moved > 0 ? "↑" : "↓"}${Math.abs(moved)}`}</span>}
      </div>
      <div className="gain">
        {repo.periodStars === null && age !== null
          ? (
              <>
                <b className="age">{`${age} 天`}</b>
                <small>前新建</small>
              </>
            )
          : (
              <>
                <b>{repo.periodStars === null ? "—" : `+${compact(repo.periodStars)}`}</b>
                <small>{labels[period]}</small>
              </>
            )}
      </div>
      <button type="button" className={`bm ${saved ? "on" : ""}`} aria-label={`${saved ? "取消收藏" : "收藏"} ${repo.fullName}`} aria-pressed={saved} onClick={() => onSave(repo)}><Icon name="bookmark" /></button>
    </li>
  )
}

export function Discovery() {
  const { isDark, colorScheme, setDark, toggleDark } = useDark()
  const [darkId, setDarkId] = useState(() => readThemeId("dark"))
  const [lightId, setLightId] = useState(() => readThemeId("light"))
  const theme = findTheme(isDark ? darkId : lightId, isDark ? "dark" : "light")
  const initial = new URLSearchParams(window.location.search)
  const [period, setPeriod] = useState<Period>((periods as readonly string[]).includes(initial.get("period") || "") ? initial.get("period") as Period : "daily")
  const [q, setQ] = useState(initial.get("q") || "")
  const [language, setLanguage] = useState(initial.get("language") || "")
  const [category, setCategory] = useState(initial.get("category") || "")
  const [sort, setSort] = useState("rank")
  const [view, setView] = useState<"discover" | "saved">("discover")
  const [layout, setLayout] = useState<Layout>("list")
  const [date, setDate] = useState(/^\d{4}-\d{2}-\d{2}$/.test(initial.get("date") || "") ? initial.get("date")! : "")
  const [saved, setSaved] = useState(readSaved)
  const [active, setActive] = useState<Repository | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [notice, setNotice] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)
  const query = useQuery({ queryKey: ["discovery", date], queryFn: ({ signal }) => loadSnapshot(date, signal), staleTime: 60_000, retry: 1, refetchOnWindowFocus: false })
  const dates = useQuery<string[]>({ queryKey: ["discovery-dates"], queryFn: async () => {
    const r = await fetch("/data/dates.json")
    return r.ok ? r.json() : []
  }, staleTime: 300_000 })
  const data = query.data
  useEffect(() => {
    // 与全站共用的明暗状态保持一致，并让 iOS 的状态栏、过度滚动区域跟随当前配色
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
    if (q) params.set("q", q)
    if (language) params.set("language", language)
    if (category) params.set("category", category)
    if (date) params.set("date", date)
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`)
  }, [period, q, language, category, date])
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
  const pickTheme = (picked: RadarTheme) => {
    saveThemeId(picked)
    if (picked.mode === "dark") setDarkId(picked.id)
    else setLightId(picked.id)
    setDark(picked.mode)
  }
  // 收藏里不在当前周期榜单上的项目：没有这个周期的名次和增量，不能沿用收藏时另一个周期的数字
  const source = useMemo(() => view === "saved" ? Object.values(saved).map(r => data?.periods[period].find(n => n.fullName === r.fullName) || { ...r, rank: 0, previousRank: null, periodStars: null }) : data?.periods[period] || [], [view, saved, data, period])
  const languages = [...new Set(source.map(r => r.language))].sort()
  const repos = useMemo(() => {
    const rows = filterRepositories(source, q, language, category)
    return sort === "stars" ? rows.sort((a, b) => b.stars - a.stars) : sort === "growth" ? rows.sort((a, b) => (b.periodStars ?? -1) - (a.periodStars ?? -1)) : rows.sort((a, b) => (a.rank || Infinity) - (b.rank || Infinity))
  }, [source, q, language, category, sort])
  const groups = useMemo(() => {
    const names = categoryNames.slice(1)
    return names.map(name => ({ name, rows: repos.filter(r => r.category === name || (name === "其他" && !names.includes(r.category))) })).filter(g => g.rows.length)
  }, [repos])
  const reset = () => {
    setQ("")
    setLanguage("")
    setCategory("")
  }
  const stale = data && Date.now() - Date.parse(data.status[period].capturedAt) > 30 * 3600000
  const savedCount = Object.keys(saved).length
  const emptySaved = view === "saved" && !savedCount
  const rowProps = (repo: Repository, index: number, showCategory: boolean) => ({ repo, period, index, showCategory, saved: !!saved[repo.fullName], onSave: toggleSave, onOpen: setActive })
  // 切换周期、视图、分类或排序时整组卡片重新入场；输入搜索词时不重放，避免打字时闪动
  const listKey = `${view}-${period}-${category}-${sort}-${date}`
  const glow = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return
    const card = (e.target as HTMLElement).closest<HTMLElement>(".card")
    if (!card) return
    const r = card.getBoundingClientRect()
    card.style.setProperty("--mx", `${e.clientX - r.left}px`)
    card.style.setProperty("--my", `${e.clientY - r.top}px`)
  }
  const go = (next: "discover" | "saved") => {
    setView(next)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  return (
    <div className="radar-app" data-mode={theme.mode} style={themeVars(theme)}>
      <div className="orbs" aria-hidden="true"><i /><i /><i /></div>
      <header className="radar-header glass">
        <div className="bar">
          <a className="radar-brand" href="/" aria-label="GIT Bot 首页">
            <span className="brand-symbol"><Icon name="bot" /></span>
            <span className="brand-text">
              GIT
              {" "}
              <span className="brand-accent">Bot</span>
              <small>GITHUB DISCOVERY</small>
            </span>
          </a>
          <nav className="primary-nav" aria-label="主导航">
            <button type="button" className={view === "discover" ? "selected" : ""} aria-current={view === "discover" ? "page" : undefined} onClick={() => go("discover")}>
              <Icon name="compass" />
              发现
            </button>
            <button type="button" className={view === "saved" ? "selected" : ""} aria-current={view === "saved" ? "page" : undefined} onClick={() => go("saved")}>
              <Icon name="bookmark" />
              收藏
              <span className="n">{savedCount}</span>
            </button>
            <a href="#data-note">
              <Icon name="info" />
              数据说明
            </a>
          </nav>
          <div className="header-actions">
            <button type="button" className="icon-btn refresh" aria-label="刷新榜单" disabled={query.isFetching} onClick={() => void query.refetch()}><Icon name="refresh" className={query.isFetching ? "spin" : ""} /></button>
            <button type="button" className="icon-btn hd-palette" aria-label="选择配色" aria-expanded={pickerOpen} onClick={() => setPickerOpen(open => !open)}><Icon name="palette" /></button>
            <button type="button" className="icon-btn" aria-label={isDark ? "切换浅色主题" : "切换深色主题"} onClick={toggleDark}><Icon name={isDark ? "sun" : "moon"} /></button>
            <a className="icon-btn hd-github" href="https://github.com/chenran71ran-oss/github-discovery" target="_blank" rel="noreferrer" aria-label="查看项目源码"><Icon name="github" /></a>
          </div>
        </div>
      </header>
      <main className="radar-main">
        <section className="intro">
          <div>
            <h1>
              {view === "saved" ? "我的收藏" : `${labels[period]}发现`}
              <span className="count">{repos.length}</span>
            </h1>
            <p className="intro-description">{view === "saved" ? "收藏保存在当前浏览器，可随时回来继续探索。" : "保留原始榜单排名 · 中文速览帮助你快速判断用途"}</p>
          </div>
          <div className="update-note">
            <Icon name="clock" />
            <div>
              {data ? `更新于 ${time(data.generatedAt)}` : "正在连接榜单…"}
              <small>北京时间 · GitHub Trending</small>
            </div>
          </div>
        </section>
        {query.isError && (
          <div role="alert" className="status-banner error">
            {query.error.message}
            <button type="button" onClick={() => void query.refetch()}>重新加载</button>
          </div>
        )}
        {stale && <div role="status" className="status-banner">这份榜单已超过 30 小时未更新，展示的是已保存的真实快照。</div>}
        {data && !data.status[period].ok && <div className="status-banner">{data.status[period].error}</div>}
        <section className="panel glass" aria-label="筛选榜单">
          <div className="panel-top">
            <Segmented<Period>
              className="period-tabs"
              label="榜单周期"
              value={period}
              onChange={setPeriod}
              options={periods.map(p => ({ value: p, label: (<><Icon name={periodIcons[p]} />{labels[p]}<span className="n">{data?.periods[p].length ?? ""}</span></>) }))}
            />
            <label className="search-input">
              <Icon name="search" />
              <input ref={searchRef} type="search" aria-label="搜索项目" placeholder="搜索项目、用途、技术栈…" value={q} onChange={e => setQ(e.target.value)} />
              <kbd>⌘ K</kbd>
            </label>
          </div>
          <div className="panel-bottom">
            <div className="chips" role="group" aria-label="项目分类">
              {categoryNames.map((c, i) => {
                const value = i ? c : ""
                const count = i ? source.filter(r => r.category === c).length : source.length
                if (i && !count && category !== value) return null
                return (
                  <button key={c} type="button" className="chip" aria-pressed={category === value} onClick={() => setCategory(value)}>
                    {c}
                    <span className="n">{count}</span>
                  </button>
                )
              })}
            </div>
            <div className="selects">
              <label className="select-wrap">
                <select aria-label="历史榜单日期" value={date} onChange={e => setDate(e.target.value)}>
                  <option value="">最新榜单</option>
                  {dates.data?.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <label className="select-wrap">
                <select aria-label="编程语言" value={language} onChange={e => setLanguage(e.target.value)}>
                  <option value="">全部语言</option>
                  {languages.map(l => <option key={l}>{l}</option>)}
                </select>
              </label>
              <label className="select-wrap">
                <select aria-label="项目排序" value={sort} onChange={e => setSort(e.target.value)}>
                  <option value="rank">榜单顺序</option>
                  <option value="stars">总 Star 最多</option>
                  <option value="growth">周期新增最多</option>
                </select>
              </label>
            </div>
          </div>
        </section>
        <div className="section-heading">
          <p>{layout === "list" ? "按榜单名次排列" : "按用途分栏"}</p>
          <Segmented<Layout>
            className="layout-toggle"
            label="榜单布局"
            value={layout}
            onChange={setLayout}
            options={[{ value: "list", label: <Icon name="list" />, ariaLabel: "榜单布局" }, { value: "board", label: <Icon name="columns" />, ariaLabel: "分栏布局" }]}
          />
        </div>
        {query.isPending
          ? (
              <ol className="rows cards two" aria-label="正在加载榜单">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <li className="row card skeleton" key={i} style={{ "--i": i } as CSSProperties}>
                    <span className="repo-icon loading" />
                    <span className="sk-line w1" />
                    <span className="sk-line w2" />
                    <span className="sk-line w3" />
                  </li>
                ))}
              </ol>
            )
          : layout === "board"
            ? (
                <div className="board">
                  {groups.map(group => (
                    <section key={group.name} className="column glass" style={{ "--ch": categoryHues[group.name] ?? 190 } as CSSProperties} aria-label={group.name}>
                      <header>
                        <i />
                        <h2>{group.name}</h2>
                        <span>{group.rows.length}</span>
                      </header>
                      <ol className="rows cards" key={listKey} onPointerMove={glow}>{group.rows.map((repo, i) => <Row key={repo.fullName} {...rowProps(repo, i, false)} />)}</ol>
                    </section>
                  ))}
                </div>
              )
            : repos.length > 0 && (
              <ol className="rows cards two" key={listKey} onPointerMove={glow}>{repos.map((repo, i) => <Row key={repo.fullName} {...rowProps(repo, i, true)} />)}</ol>
            )}
        {!query.isPending && repos.length === 0 && (
          <div className="empty-state">
            <Icon name="search" />
            <h3>{emptySaved ? "给感兴趣的项目，留一个位置" : "还没有找到匹配的项目"}</h3>
            <p>{emptySaved ? "点击项目右侧的书签，就能把它收进这里。" : "试试其他关键词，或清空筛选条件。"}</p>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                reset()
                if (emptySaved) setView("discover")
              }}
            >
              {emptySaved ? "去发现项目" : "清空筛选"}
            </button>
          </div>
        )}
        <aside id="data-note" className="data-note">
          <Icon name="info" />
          <p>
            中文速览来自 GithubTrending；首批资料速览按项目公开资料整理，README 深度解读单独标注。还没有中文的英文项目会先显示「机器翻译」，只翻译项目自己的简介，可能不够准确。
            {!data?.enrichment.aiConfigured && "本预览尚未配置独立 AI 服务，缺少的深度解读不会用模板内容代替。"}
            {" "}
            排名与 Star 增量来自 GitHub Trending；标着「语言榜」的项目来自各编程语言自己的 Trending 榜；标着「新项目」的来自 GitHub 搜索，是近期新建、Star 增长很快的项目，按总 Star 排序，没有周期增量。两者都排在总榜之后，用来补足总榜覆盖不到的方向。收藏仅存于当前浏览器。「爆发」表示周期新增 Star 占总数的比例和增量都很高。项目图标为仓库所有者的 GitHub 头像。
          </p>
        </aside>
        <footer className="radar-footer">
          <span className="footer-brand">
            GIT Bot
            <small>让好项目被看见。</small>
          </span>
          <span>
            Built on
            <a href="https://github.com/newsnext/newsnow" target="_blank" rel="noreferrer">NewsNow · MIT</a>
            {" "}
            ×
            <a href="https://github.com/Ibook000/GithubTrending" target="_blank" rel="noreferrer">GithubTrending · Apache-2.0</a>
          </span>
          <a href="/data/latest.json" target="_blank" rel="noreferrer">
            开放数据
            <Icon name="arrowUpRight" />
          </a>
        </footer>
      </main>
      <nav className="tabbar glass" aria-label="底部导航">
        <button type="button" className={view === "discover" ? "selected" : ""} aria-current={view === "discover" ? "page" : undefined} onClick={() => go("discover")}>
          <Icon name="compass" />
          发现
        </button>
        <button type="button" className={view === "saved" ? "selected" : ""} aria-current={view === "saved" ? "page" : undefined} onClick={() => go("saved")}>
          <Icon name="bookmark" />
          {savedCount ? `收藏 ${savedCount}` : "收藏"}
        </button>
        <button type="button" className={pickerOpen ? "selected" : ""} aria-expanded={pickerOpen} onClick={() => setPickerOpen(open => !open)}>
          <Icon name="palette" />
          配色
        </button>
        <a href="#data-note">
          <Icon name="info" />
          说明
        </a>
      </nav>
      <ThemePicker open={pickerOpen} scheme={colorScheme} activeId={theme.id} onPick={pickTheme} onAuto={() => setDark("auto")} onClose={() => setPickerOpen(false)} />
      {active && <RepoDetail key={active.fullName} repo={active} onClose={() => setActive(null)} saved={!!saved[active.fullName]} onSave={() => toggleSave(active)} />}
      <div role="status" aria-live="polite" className={`radar-toast ${notice ? "visible" : ""}`}>{notice}</div>
    </div>
  )
}
