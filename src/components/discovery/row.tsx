import { type CSSProperties, memo } from "react"
import { type Period, type Repository, compact, isBreakout } from "@shared/discovery"
import { categories, categoryOf, fallback } from "@shared/taxonomy"
import { Icon, RepoIcon } from "./icons"

export const labels = { daily: "今日", weekly: "本周", monthly: "本月" } as const
export const languageColors: Record<string, string> = {
  "Python": "#4584c4",
  "TypeScript": "#3a7bd5",
  "JavaScript": "#e0bf3f",
  "Rust": "#dea584",
  "Go": "#00add8",
  "C": "#8990a0",
  "C++": "#f34b7d",
  "Java": "#c0782a",
  "Kotlin": "#a97bff",
  "HTML": "#e34c26",
  "CSS": "#8e63c4",
  "Shell": "#89e051",
  "Swift": "#f05138",
}
/** 每个分类一个色相：按分类在分类体系里的顺序，用黄金角间隔分开，相邻分类颜色不会太近。 */
export const categoryHues: Record<string, number> = Object.fromEntries([...categories.map((c, i) => [c.label, Math.round((i * 137.5 + 210) % 360)]), [fallback.label, 210]])

/** 搜索来的新项目没有周期增量，改为显示建了几天 */
export function ageInDays(repo: Repository) {
  const created = repo.createdAt ? Date.parse(repo.createdAt) : Number.NaN
  return Number.isFinite(created) ? Math.max(1, Math.ceil((Date.now() - created) / 86400000)) : null
}

export function Gain({ repo, period }: { repo: Repository, period: Period }) {
  const age = ageInDays(repo)
  if (repo.periodStars === null && age !== null) return <span className="gain age" title={`创建于 ${repo.createdAt!.slice(0, 10)}`}>{`${age} 天前新建`}</span>
  if (repo.periodStars === null) return <span className="gain none">—</span>
  return <span className="gain" title={`${labels[period]}新增 ${repo.periodStars} Star`}>{`+${compact(repo.periodStars)}`}</span>
}

interface RowProps {
  repo: Repository
  period: Period
  index: number
  showCategory: boolean
  selected: boolean
  saved: boolean
  onSave: (repo: Repository) => void
  onOpen: (repo: Repository) => void
}

/** 榜单一行：整行可点开解读，书签独立；名次、增量、简介一眼可读。 */
export const Row = memo(({ repo, period, index, showCategory, selected, saved, onSave, onOpen }: RowProps) => {
  const [owner, name] = repo.fullName.split("/")
  const moved = repo.previousRank ? repo.previousRank - repo.rank : 0
  return (
    <li className={`row ${selected ? "on" : ""}`} data-name={repo.fullName} style={{ "--i": Math.min(index, 10) } as CSSProperties}>
      <button type="button" className="row-main" aria-current={selected || undefined} onClick={() => onOpen(repo)}>
        <span className={`rk ${repo.rank && repo.rank <= 3 ? "top" : ""}`}>{repo.rank ? repo.rank : "—"}</span>
        <RepoIcon fullName={repo.fullName} />
        <span className="body">
          <span className="head">
            <span className="name">{name}</span>
            <span className="own">{owner}</span>
            {isBreakout(repo, period) && (
              <span className="badge hot" title="新增 Star 占总数的比例很高，是刚冒头的项目">
                <Icon name="flame" />
                爆发
              </span>
            )}
            {repo.origin === "language" && <span className="badge" title="来自该语言自己的 Trending 榜，不在总榜里">语言榜</span>}
            {repo.origin === "search" && <span className="badge new" title="近期新建、Star 增长很快的项目">新项目</span>}
          </span>
          <span className="sum">{repo.summary || repo.description}</span>
          <span className="meta">
            <span className="m-gain"><Gain repo={repo} period={period} /></span>
            <span className="lang">
              <i style={{ backgroundColor: languageColors[repo.language] || "#9b8ca9" }} />
              {repo.language}
            </span>
            <span className="stars">
              <Icon name="star" />
              {compact(repo.stars)}
            </span>
            {showCategory && <span className="cat" style={{ "--ch": categoryHues[categoryOf(repo.category).label] ?? 210 } as CSSProperties}>{categoryOf(repo.category).label}</span>}
            {repo.purposes?.[0] && <span className="purpose">{repo.purposes[0]}</span>}
            {repo.summarySource === "machine" && <span className="src" title="只翻译了项目简介，可能不够准确">机翻</span>}
            {moved !== 0 && <span className={`move ${moved > 0 ? "up" : "down"}`} title="与昨日名次相比">{`${moved > 0 ? "↑" : "↓"}${Math.abs(moved)}`}</span>}
          </span>
        </span>
        <span className="side"><Gain repo={repo} period={period} /></span>
      </button>
      <button type="button" className={`bm ${saved ? "on" : ""}`} aria-label={`${saved ? "取消收藏" : "收藏"} ${repo.fullName}`} aria-pressed={saved} onClick={() => onSave(repo)}><Icon name="bookmark" /></button>
    </li>
  )
})
Row.displayName = "Row"

export function SkeletonRows() {
  return (
    <ol className="rows" aria-label="正在加载榜单">
      {[1, 2, 3, 4, 5, 6, 7].map(i => (
        <li className="row skeleton" key={i}>
          <span className="row-main">
            <span className="rk" />
            <span className="repo-icon loading" />
            <span className="body">
              <span className="sk w1" />
              <span className="sk w2" />
              <span className="sk w3" />
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}
