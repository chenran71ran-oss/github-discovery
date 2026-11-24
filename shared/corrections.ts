import type { DiscoverySnapshot, Repository } from "./discovery"
import { categories, categoryOf } from "./taxonomy"

/**
 * 审核通过的成员纠错：服务端 /api/corrections 返回、导出给采集器（collector/corrections.json）的同一种格式。
 */
export interface AppliedCorrections {
  /** 仓库 → 改正后的主分类 */
  categories: Record<string, string>
  /** 全局术语替换，按原译法从长到短 */
  terms: { from: string, to: string }[]
}

/**
 * 把审核通过的成员纠错叠加到快照上：改主分类（次要标签去掉同名的），
 * 以及在非 AI 生成的中文简介里替换术语。返回新对象，不改原快照。
 */
export function applyCorrections(data: DiscoverySnapshot | undefined, fixes: AppliedCorrections | null | undefined): DiscoverySnapshot | undefined {
  if (!data || !fixes || (!Object.keys(fixes.categories).length && !fixes.terms.length)) return data
  const fix = (r: Repository): Repository => {
    let out = r
    const label = fixes.categories[r.fullName]
    if (label && categories.some(c => c.label === label) && label !== r.category) {
      out = { ...out, category: label, domain: categoryOf(label).domain, tags: (r.tags || []).filter(t => t !== label), corrected: true }
    }
    if (out.summary && out.summarySource !== "ai-readme" && fixes.terms.length) {
      let summary = out.summary
      for (const t of fixes.terms) summary = summary.split(t.from).join(t.to)
      if (summary !== out.summary) out = { ...out, summary }
    }
    return out
  }
  return { ...data, periods: Object.fromEntries(Object.entries(data.periods).map(([p, rows]) => [p, rows.map(fix)])) as DiscoverySnapshot["periods"] }
}
