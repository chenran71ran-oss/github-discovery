export const periods = ["daily", "weekly", "monthly"] as const
export type Period = typeof periods[number]
export interface Repository {
  fullName: string
  rank: number
  description: string
  language: string
  stars: number
  forks: number
  periodStars: number | null
  previousRank: number | null
  summary: string | null
  useCase: string | null
  techStack: string[]
  highlights: string[]
  category: string
  summarySource: "ai-readme" | "upstream" | "editorial" | "machine" | "pending"
  summaryAt: string | null
  /** "language": picked from a language's own Trending page to widen coverage; absent in older snapshots. */
  origin?: "trending" | "language"
}
export interface DiscoverySnapshot {
  schemaVersion: 1
  date: string
  generatedAt: string
  source: string
  periods: Record<Period, Repository[]>
  status: Record<Period, { ok: boolean, capturedAt: string, error?: string }>
  enrichment: { ready: number, total: number, aiConfigured: boolean }
}
export function isSnapshot(v: unknown): v is DiscoverySnapshot {
  if (!v || typeof v !== "object") return false
  const d = v as DiscoverySnapshot
  return d.schemaVersion === 1 && Number.isFinite(Date.parse(d.generatedAt)) && periods.every(p => Array.isArray(d.periods?.[p]) && d.periods[p].length > 0 && d.periods[p].every(r => /^[\w.-]+\/[\w.-]+$/.test(r.fullName) && Number.isFinite(r.stars) && typeof r.description === "string"))
}
export function filterRepositories(repos: Repository[], q: string, language: string, category: string, saved?: string[]) {
  const term = q.trim().toLowerCase()
  return repos.filter(r => (!language || r.language === language) && (!category || r.category === category) && (!saved || saved.includes(r.fullName)) && (!term || [r.fullName, r.description, r.summary, r.useCase, ...r.techStack].join(" ").toLowerCase().includes(term)))
}
/**
 * 「爆发」：周期新增 Star 占当前总 Star 的比例，与绝对增量同时达标。
 * 用来区分刚冒头的项目和长期高位的老项目。阈值按真实榜单分布设定，调整时同步更新测试。
 */
export const breakoutRules: Record<Period, { share: number, min: number }> = {
  daily: { share: 0.15, min: 300 },
  weekly: { share: 0.25, min: 1000 },
  monthly: { share: 0.5, min: 3000 },
}
export function isBreakout(repo: Pick<Repository, "stars" | "periodStars">, period: Period) {
  const gain = repo.periodStars
  if (gain === null || repo.stars <= 0) return false
  const rule = breakoutRules[period]
  return gain >= rule.min && gain / repo.stars >= rule.share
}
export const categoryNames = ["全部", "AI 与智能体", "开发工具", "前端与界面", "自托管", "数据与基础设施", "安全与隐私", "移动与桌面", "学习与研究", "其他"]
export function compact(n: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n)
}
