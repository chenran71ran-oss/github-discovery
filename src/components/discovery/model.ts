/**
 * 实验层（前端）：把快照、收藏和筛选条件组合成页面要显示的列表与统计。
 * 全是纯函数，不碰 DOM 与网络，便于单独测试和替换排序 / 分组策略。
 */
import { type DiscoverySnapshot, type Period, type Repository, filterRepositories, labelsOf } from "@shared/discovery"
import { categories, categoryOf, domains, fallback } from "@shared/taxonomy"

export type Sort = "rank" | "growth" | "stars"
export interface Filters {
  q: string
  language: string
  domain: string
  category: string
  sort: Sort
}

/** 收藏里不在当前周期榜单上的项目：没有这个周期的名次和增量，不能沿用收藏时另一个周期的数字。 */
export function sourceRows(data: DiscoverySnapshot | undefined, period: Period, saved: Record<string, Repository> | null) {
  if (!saved) return data?.periods[period] || []
  return Object.values(saved).map(r => data?.periods[period].find(n => n.fullName === r.fullName) || { ...r, rank: 0, previousRank: null, periodStars: null })
}

export function visibleRows(rows: Repository[], f: Filters) {
  // 选了细类时以细类为准（含次要标签），领域只决定显示哪些细类，计数与结果保持一致
  const out = filterRepositories(rows, f.q, f.language, f.category, undefined, f.category ? "" : f.domain)
  if (f.sort === "stars") return out.sort((a, b) => b.stars - a.stars)
  if (f.sort === "growth") return out.sort((a, b) => (b.periodStars ?? -1) - (a.periodStars ?? -1))
  return out.sort((a, b) => (a.rank || Infinity) - (b.rank || Infinity))
}

/** 每个领域、每个分类（含次要标签）的项目数，用于筛选器上的计数。 */
export function counts(rows: Repository[]) {
  const byDomain = new Map<string, number>()
  const byCategory = new Map<string, number>()
  for (const r of rows) {
    const d = categoryOf(r.category).domain
    byDomain.set(d, (byDomain.get(d) || 0) + 1)
    for (const label of new Set(labelsOf(r))) byCategory.set(label, (byCategory.get(label) || 0) + 1)
  }
  return { byDomain, byCategory }
}

/** 筛选器里显示哪些分类：选了领域就列出该领域全部分类；「全部」时按数量列出最常见的几个。 */
export function chipCategories(domain: string, byCategory: Map<string, number>, expanded: boolean, limit = 8) {
  const all = [...categories, fallback].filter(c => (byCategory.get(c.label) || 0) > 0)
  if (domain) return all.filter(c => c.domain === domain)
  const sorted = all.sort((a, b) => (byCategory.get(b.label) || 0) - (byCategory.get(a.label) || 0))
  return expanded ? sorted : sorted.slice(0, limit)
}

/** 概况里的分类分布：按领域汇总，每个领域列出数量最多的分类。 */
export function distribution(rows: Repository[]) {
  const { byDomain } = counts(rows)
  const primary = new Map<string, number>()
  for (const r of rows) primary.set(categoryOf(r.category).label, (primary.get(categoryOf(r.category).label) || 0) + 1)
  return [...domains, { id: fallback.domain, label: "其他" }].map(d => ({
    ...d,
    count: byDomain.get(d.id) || 0,
    top: [...categories, fallback].filter(c => c.domain === d.id && primary.get(c.label)).sort((a, b) => primary.get(b.label)! - primary.get(a.label)!).slice(0, 3).map(c => ({ label: c.label, count: primary.get(c.label)! })),
  })).filter(d => d.count > 0)
}
