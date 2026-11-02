import { categories, categoryOf, fallback } from "./taxonomy"

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
  /**
   * Where the row came from; absent in older snapshots.
   * "language": a language's own Trending page. "search": recently created and gaining stars fast (GitHub search).
   */
  origin?: "trending" | "language" | "search"
  /** Creation time, only known for "search" rows. */
  createdAt?: string
  /** Search stream that found the row, e.g. "topic:self-hosted". */
  stream?: string
  /** GIT Bot classification (taxonomy v2+); absent in older snapshots. */
  tags?: string[]
  domain?: string
  purposes?: string[]
  topics?: string[]
  classification?: Classification
}
export interface Classification {
  by: "rules" | "ai"
  strategy: string
  /** 0–1: the winning category's share of all category scores. */
  confidence: number
  /** Evidence in Chinese, e.g. "主题 self-hosted", "关键词 budget". */
  reasons: string[]
}
export interface DiscoverySnapshot {
  schemaVersion: 1
  date: string
  generatedAt: string
  source: string
  periods: Record<Period, Repository[]>
  status: Record<Period, { ok: boolean, capturedAt: string, error?: string }>
  enrichment: { ready: number, total: number, aiConfigured: boolean }
  taxonomyVersion?: number
  classifier?: string
}
export function isSnapshot(v: unknown): v is DiscoverySnapshot {
  if (!v || typeof v !== "object") return false
  const d = v as DiscoverySnapshot
  return d.schemaVersion === 1 && Number.isFinite(Date.parse(d.generatedAt)) && periods.every(p => Array.isArray(d.periods?.[p]) && d.periods[p].length > 0 && d.periods[p].every(r => /^[\w.-]+\/[\w.-]+$/.test(r.fullName) && Number.isFinite(r.stars) && typeof r.description === "string"))
}
/** Primary category and secondary tags, normalised to the current taxonomy. */
export function labelsOf(r: Pick<Repository, "category" | "tags">) {
  return [categoryOf(r.category).label, ...(r.tags || []).map(t => categoryOf(t).label)]
}
/**
 * category filters by label and also matches secondary tags, so a fitness app tagged 移动与桌面
 * shows up under both. domain filters by the primary category's domain.
 */
/** 全角转半角、统一大小写：输入法全角模式下打出的「ＡＩ」也能匹配 AI。 */
export function normalizeText(text: string) {
  return text.normalize("NFKC").toLowerCase()
}
/** 搜索词按空格拆开，每个词都要命中（「AI 记账」= 同时包含 AI 和 记账）。 */
export function searchTerms(q: string) {
  return normalizeText(q).split(/[\s,，、]+/).filter(Boolean)
}
export function matchesSearch(r: Repository, terms: string[]) {
  if (!terms.length) return true
  const text = normalizeText([r.fullName, r.description, r.summary, r.useCase, r.language, ...r.techStack, ...labelsOf(r), ...(r.purposes || []), ...(r.topics || [])].join(" "))
  return terms.every(t => text.includes(t))
}
export function filterRepositories(repos: Repository[], q: string, language: string, category: string, saved?: string[], domain = "") {
  const terms = searchTerms(q)
  return repos.filter(r => (!language || r.language === language) && (!category || labelsOf(r).includes(category)) && (!domain || categoryOf(r.category).domain === domain) && (!saved || saved.includes(r.fullName)) && matchesSearch(r, terms))
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
export const categoryNames = ["全部", ...categories.map(c => c.label), fallback.label]
export function compact(n: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n)
}
