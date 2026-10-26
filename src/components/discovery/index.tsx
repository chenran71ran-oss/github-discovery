import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { type DiscoverySnapshot, type Period, type Repository, categoryNames, compact, filterRepositories, isSnapshot } from "@shared/discovery"
import { useDark } from "~/hooks/useDark"
import "./style.css"

const labels = { daily: "今日", weekly: "本周", monthly: "本月" }
const icons = { daily: "i-ph:fire-duotone", weekly: "i-ph:trend-up-duotone", monthly: "i-ph:calendar-dots-duotone" }
const storageKey = "discovery-next-favorites-v1"
const time = (date: string) => new Date(date).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
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
function Icon({ name, className = "" }: { name: string, className?: string }) {
  return <span aria-hidden="true" className={`${name} ${className}`} />
}
function RepoDetail({ repo, onClose, saved, onSave }: { repo: Repository, onClose: () => void, saved: boolean, onSave: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ref.current?.showModal()
    return () => previous?.focus()
  }, [])
  return (
    <dialog
      ref={ref}
      className="radar-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="detail-top">
        <span className="eyebrow">PROJECT INSIGHT / 项目解读</span>
        <button className="icon-btn" aria-label="关闭项目解读" onClick={onClose}><Icon name="i-ph:x" /></button>
      </div>
      <span className="repo-owner">{repo.fullName.split("/")[0]}</span>
      <h2>{repo.fullName.split("/")[1]}</h2>
      <div className="detail-numbers">
        <span>
          ☆
          {compact(repo.stars)}
          {" "}
          Stars
        </span>
        <span>
          ⑂
          {compact(repo.forks)}
          {" "}
          Forks
        </span>
        <span>{repo.language}</span>
      </div>
      <section>
        <h3>它是什么？</h3>
        <p>{repo.summary || "中文解读尚未生成。下方保留项目原始描述，便于查看真实信息。"}</p>
        <small className="summary-origin">
          {repo.summarySource === "ai-readme" ? "基于 README 的 AI 解读" : repo.summarySource === "upstream" ? "GithubTrending 中文速览 · 尚非 README 深读" : repo.summarySource === "editorial" ? "基于项目公开资料整理 · 不代表 AI 深度分析" : "原始信息"}
          {repo.summaryAt ? ` · ${time(repo.summaryAt)}` : ""}
        </small>
      </section>
      <section>
        <h3>适用场景</h3>
        <p>{repo.useCase || "暂无经过校验的适用场景，请先查看项目文档与使用条件。"}</p>
      </section>
      {repo.techStack.length > 0 && (
        <section>
          <h3>技术栈</h3>
          <div className="detail-tags">{repo.techStack.map(s => <span key={s}>{s}</span>)}</div>
        </section>
      )}
      {repo.highlights.length > 0 && (
        <section>
          <h3>值得关注</h3>
          <ul>{repo.highlights.map(s => <li key={s}>{s}</li>)}</ul>
        </section>
      )}
      <details className="original">
        <summary>查看原始项目简介</summary>
        <p>{repo.description}</p>
      </details>
      <div className="detail-buttons">
        <a className="primary-btn" href={`https://github.com/${repo.fullName}#readme`} target="_blank" rel="noreferrer">
          阅读 README
          <Icon name="i-ph:arrow-up-right" />
        </a>
        <button className="secondary-btn" onClick={onSave} aria-pressed={saved}>
          <Icon name={saved ? "i-ph:bookmark-simple-fill" : "i-ph:bookmark-simple"} />
          {saved ? "已收藏" : "收藏项目"}
        </button>
      </div>
    </dialog>
  )
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
  const [layout, setLayout] = useState<"cards" | "list">("cards")
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
  const source = useMemo(() => view === "saved" ? Object.values(saved).map(r => data?.periods[period].find(n => n.fullName === r.fullName) || r) : data?.periods[period] || [], [view, saved, data, period])
  const languages = [...new Set(source.map(r => r.language))].sort()
  const repos = useMemo(() => {
    const rows = filterRepositories(source, q, language, category)
    return sort === "stars" ? rows.sort((a, b) => b.stars - a.stars) : sort === "growth" ? rows.sort((a, b) => (b.periodStars ?? -1) - (a.periodStars ?? -1)) : rows.sort((a, b) => a.rank - b.rank)
  }, [source, q, language, category, sort])
  const reset = () => {
    setQ("")
    setLanguage("")
    setCategory("")
  }
  const top = data?.periods[period][0]
  const stale = data && Date.now() - Date.parse(data.status[period].capturedAt) > 30 * 3600000
  return (
    <div className="radar-app">
      <header className="radar-header">
        <a className="radar-brand" href="/" aria-label="开源雷达首页">
          <span className="brand-symbol"><Icon name="i-ph:radar-duotone" /></span>
          <span>
            开源
            <span className="brand-accent">雷达</span>
            <small>OPEN SOURCE DISCOVERY</small>
          </span>
        </a>
        <nav className="primary-nav" aria-label="主导航">
          <button className={view === "discover" ? "selected" : ""} onClick={() => setView("discover")}>
            <Icon name="i-ph:compass-duotone" />
            发现
          </button>
          <button className={view === "saved" ? "selected" : ""} onClick={() => setView("saved")}>
            <Icon name="i-ph:bookmark-simple-duotone" />
            收藏
            {" "}
            <span>{Object.keys(saved).length}</span>
          </button>
          <a href="#data-note">
            <Icon name="i-ph:newspaper-duotone" />
            数据说明
          </a>
        </nav>
        <div className="header-actions">
          <button className="icon-btn refresh" aria-label="刷新榜单" disabled={query.isFetching} onClick={() => void query.refetch()}><Icon name={`i-ph:arrows-clockwise ${query.isFetching ? "spin" : ""}`} /></button>
          <button className="icon-btn" aria-label={isDark ? "切换浅色主题" : "切换深色主题"} onClick={toggleDark}><Icon name={isDark ? "i-ph:sun-duotone" : "i-ph:moon-stars-duotone"} /></button>
          <a className="icon-btn" href="https://github.com/chenran71ran-oss/github-discovery/tree/codex/newsnow-discovery-preview" target="_blank" rel="noreferrer" aria-label="查看项目源码"><Icon name="i-ph:github-logo-duotone" /></a>
        </div>
      </header>
      <main className="radar-main">
        <section className="intro">
          <div>
            <p className="eyebrow">
              <span className="live-dot" />
              {" "}
              EXPLORE · UNDERSTAND · BUILD
            </p>
            <h1>
              {view === "saved"
                ? "留住那些，值得一试的项目。"
                : (
                    <>
                      好项目，
                      <span>不该错过。</span>
                    </>
                  )}
            </h1>
            <p className="intro-description">从开源趋势到中文解读，找到下一个让你想动手的灵感。</p>
          </div>
          <div className="update-note">
            <Icon name="i-ph:clock-duotone" />
            <div>
              {data ? `更新于 ${time(data.generatedAt)}` : "正在连接榜单…"}
              <small>北京时间 · GitHub Trending</small>
            </div>
          </div>
        </section>
        {query.isError && (
          <div role="alert" className="status-banner error">
            {query.error.message}
            <button onClick={() => void query.refetch()}>重新加载</button>
          </div>
        )}
        {stale && <div role="status" className="status-banner">这份榜单已超过 30 小时未更新，展示的是已保存的真实快照。</div>}
        {data && !data.status[period].ok && <div className="status-banner">{data.status[period].error}</div>}
        <section className="overview" aria-label="榜单概览">
          <div className="overview-item">
            <span className="stat-icon coral"><Icon name="i-ph:fire-duotone" /></span>
            <div>
              <small>
                {labels[period]}
                上榜项目
              </small>
              <strong>
                {data?.periods[period].length ?? "—"}
                <em>repos</em>
              </strong>
            </div>
          </div>
          <div className="overview-item">
            <span className="stat-icon blue"><Icon name="i-ph:translate-duotone" /></span>
            <div>
              <small>已收录中文速览</small>
              <strong>
                {data?.enrichment.ready ?? "—"}
                <em>
                  /
                  {data?.enrichment.total ?? "—"}
                  {" "}
                  个独立项目
                </em>
              </strong>
            </div>
          </div>
          <div className="overview-item top-repo">
            <span className="stat-icon amber"><Icon name="i-ph:shooting-star-duotone" /></span>
            <div>
              <small>榜首关注</small>
              <strong>{top?.fullName.split("/")[1] || "—"}</strong>
            </div>
            {top && <button className="icon-btn" aria-label="查看榜首项目" onClick={() => setActive(top)}><Icon name="i-ph:arrow-up-right" /></button>}
          </div>
        </section>
        <section className="filter-panel" aria-label="筛选榜单">
          <div className="filter-top">
            <div className="period-tabs" role="group" aria-label="榜单周期">
              {(["daily", "weekly", "monthly"] as const).map(p => (
                <button key={p} aria-pressed={period === p} className={period === p ? "selected" : ""} onClick={() => setPeriod(p)}>
                  <Icon name={icons[p]} />
                  {labels[p]}
                  <span>{data?.periods[p].length ?? ""}</span>
                </button>
              ))}
            </div>
            <label className="search-input">
              <Icon name="i-ph:magnifying-glass" />
              <input ref={searchRef} type="search" aria-label="搜索项目" placeholder="搜索项目、用途、技术栈…" value={q} onChange={e => setQ(e.target.value)} />
              <kbd>⌘ K</kbd>
            </label>
            <label className="select-wrap">
              <Icon name="i-ph:calendar-blank-duotone" />
              <select aria-label="历史榜单日期" value={date} onChange={e => setDate(e.target.value)}>
                <option value="">最新榜单</option>
                {dates.data?.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
          </div>
          <div className="filter-bottom">
            <div className="category-tabs" role="group" aria-label="项目分类">{categoryNames.map((c, i) => <button key={c} className={category === (i ? c : "") ? "selected" : ""} aria-pressed={category === (i ? c : "")} onClick={() => setCategory(i ? c : "")}>{c}</button>)}</div>
            <select className="language-select" aria-label="编程语言" value={language} onChange={e => setLanguage(e.target.value)}>
              <option value="">全部语言</option>
              {languages.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
        </section>
        <div className="section-heading">
          <div>
            <h2>
              {view === "saved" ? "我的收藏" : `${labels[period]}发现`}
              <span>{repos.length}</span>
            </h2>
            <p>{view === "saved" ? "收藏保存在当前浏览器，可随时回来继续探索。" : "保留原始榜单排名 · 中文速览帮助你快速判断用途"}</p>
          </div>
          <div className="list-controls">
            <select aria-label="项目排序" value={sort} onChange={e => setSort(e.target.value)}>
              <option value="rank">榜单顺序</option>
              <option value="stars">总 Star 最多</option>
              <option value="growth">周期新增最多</option>
            </select>
            <div className="layout-toggle">
              <button className={layout === "cards" ? "selected" : ""} aria-label="卡片布局" aria-pressed={layout === "cards"} onClick={() => setLayout("cards")}><Icon name="i-ph:squares-four-duotone" /></button>
              <button className={layout === "list" ? "selected" : ""} aria-label="列表布局" aria-pressed={layout === "list"} onClick={() => setLayout("list")}><Icon name="i-ph:list-bullets" /></button>
            </div>
          </div>
        </div>
        {query.isPending
          ? (
              <div className="repo-grid" aria-label="正在加载榜单">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div className="skeleton" key={i}>
                    <span />
                    <span />
                    <span />
                  </div>
                ))}
              </div>
            )
          : (
              <div className={`repo-grid ${layout === "list" ? "list-layout" : ""}`}>
                {repos.map(repo => (
                  <motion.article layout="position" key={repo.fullName} className="discovery-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                    <div className="repo-head">
                      <span className={`repo-rank ${repo.rank <= 3 ? "top" : ""}`}>{String(repo.rank).padStart(2, "0")}</span>
                      <div className="repo-name">
                        <span className="repo-owner">{repo.fullName.split("/")[0]}</span>
                        <button className="repo-name-button" onClick={() => setActive(repo)}>{repo.fullName.split("/")[1]}</button>
                      </div>
                      <button className={`save-btn ${saved[repo.fullName] ? "saved" : ""}`} aria-label={`${saved[repo.fullName] ? "取消收藏" : "收藏"} ${repo.fullName}`} aria-pressed={!!saved[repo.fullName]} onClick={() => toggleSave(repo)}><Icon name={saved[repo.fullName] ? "i-ph:bookmark-simple-fill" : "i-ph:bookmark-simple"} /></button>
                    </div>
                    <p className="chinese-summary">{repo.summary || repo.description}</p>
                    <div className="repo-tags">
                      <span className="category-tag">{repo.category}</span>
                      <span className={`summary-tag ${repo.summary ? "" : "pending"}`}>{repo.summarySource === "ai-readme" ? "README 解读" : repo.summarySource === "upstream" ? "中文速览" : repo.summarySource === "editorial" ? "资料速览" : "解读待补充"}</span>
                      {repo.previousRank && repo.previousRank !== repo.rank && (
                        <span className="rank-change">
                          {repo.previousRank > repo.rank ? "↑" : "↓"}
                          {" "}
                          {Math.abs(repo.previousRank - repo.rank)}
                        </span>
                      )}
                    </div>
                    {repo.useCase && (
                      <p className="use-case">
                        <span>适合</span>
                        {repo.useCase}
                      </p>
                    )}
                    <div className="repo-bottom">
                      <div className="repo-metrics">
                        <span className="repo-lang">
                          <i style={{ backgroundColor: ({ Python: "#5687ba", TypeScript: "#4380c8", JavaScript: "#d5b443", Rust: "#cf7d57", Go: "#50aabd", C: "#8990a0" } as Record<string, string>)[repo.language] || "#9b8ca9" }} />
                          {repo.language}
                        </span>
                        <span>
                          ☆
                          {compact(repo.stars)}
                        </span>
                        {repo.periodStars !== null && (
                          <span className="growth">
                            ↗ +
                            {compact(repo.periodStars)}
                          </span>
                        )}
                      </div>
                      <button className="read-button" onClick={() => setActive(repo)}>
                        了解项目
                        <Icon name="i-ph:arrow-up-right" />
                      </button>
                    </div>
                  </motion.article>
                ))}
              </div>
            )}
        {!query.isPending && repos.length === 0 && (
          <div className="empty-state">
            <Icon name="i-ph:binoculars-duotone" />
            <h3>{view === "saved" && !Object.keys(saved).length ? "给感兴趣的项目，留一个位置" : "还没有找到匹配的项目"}</h3>
            <p>{view === "saved" && !Object.keys(saved).length ? "点击项目卡片右上角的书签，就能把它收进这里。" : "试试其他关键词，或清空筛选条件。"}</p>
            <button
              className="secondary-btn"
              onClick={() => {
                reset()
                if (view === "saved" && !Object.keys(saved).length) setView("discover")
              }}
            >
              {" "}
              {view === "saved" && !Object.keys(saved).length ? "去发现项目" : "清空筛选"}
            </button>
          </div>
        )}
        <aside id="data-note" className="data-note">
          <Icon name="i-ph:info-duotone" />
          <p>
            中文速览来自 GithubTrending；首批资料速览按项目公开资料整理，README 深度解读单独标注。
            {!data?.enrichment.aiConfigured && "本预览尚未配置独立 AI 服务，缺少的深度解读不会用模板内容代替。"}
            {" "}
            排名与 Star 增量来自 GitHub Trending，收藏仅存于当前浏览器。
          </p>
        </aside>
        <footer className="radar-footer">
          <span className="footer-brand">
            开源雷达
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
            <Icon name="i-ph:arrow-up-right" />
          </a>
        </footer>
      </main>
      <AnimatePresence>{active && <RepoDetail key={active.fullName} repo={active} onClose={() => setActive(null)} saved={!!saved[active.fullName]} onSave={() => toggleSave(active)} />}</AnimatePresence>
      <div role="status" aria-live="polite" className={`radar-toast ${notice ? "visible" : ""}`}>{notice}</div>
    </div>
  )
}
