/**
 * 第 3 层：纠错的规则。成员提交分类改正和译文术语改正，站长审核后对所有人生效；
 * 站长自己提交的直接生效。审核通过的改正可以导出给采集器（collector/corrections.json），从源头修好。
 */
import taxonomy from "../shared/taxonomy.json"
import { REPO_NAME, TERM_MAX } from "./config"
import type { Correction, CorrectionKind } from "./types"

export const categoryLabels = new Set([...taxonomy.categories.map(c => c.label), taxonomy.fallback.label])

export interface CorrectionInput {
  kind: CorrectionKind
  repo: string | null
  value: string
}

const clean = (v: unknown) => typeof v === "string" ? v.normalize("NFC").replace(/\s+/g, " ").trim() : ""

/** 校验成员提交的纠错。返回 { error } 或规范化后的输入 */
export function parseCorrection(body: Record<string, unknown>): CorrectionInput | { error: string } {
  const repo = clean(body.repo)
  if (repo && !REPO_NAME.test(repo)) return { error: "项目名不正确" }
  if (body.kind === "category") {
    const category = clean(body.category)
    if (!repo) return { error: "缺少项目" }
    if (!categoryLabels.has(category)) return { error: "分类不存在" }
    return { kind: "category", repo, value: JSON.stringify({ category }) }
  }
  if (body.kind === "term") {
    const from = clean(body.from)
    const to = clean(body.to)
    if (!from || !to) return { error: "请填写原译法和正确译法" }
    if (from === to) return { error: "两处写的一样" }
    if ([...from].length > TERM_MAX || [...to].length > TERM_MAX) return { error: `每处最多 ${TERM_MAX} 个字` }
    // 太短的原文（单个汉字或字母）替换面太大，容易误伤
    if ([...from].length < 2) return { error: "原译法至少 2 个字" }
    return { kind: "term", repo: repo || null, value: JSON.stringify({ from, to }) }
  }
  return { error: "纠错类型不正确" }
}

export interface Applied {
  /** 仓库 → 改正后的主分类；同一项目以最近一次审核通过的为准 */
  categories: Record<string, string>
  /** 全局术语替换：原译法 → 正确译法，按原译法长度从长到短，避免短词先替换掉长词的一部分 */
  terms: { from: string, to: string }[]
}

/** 审核通过的纠错 → 前端叠加用的数据（也是导出给采集器的格式）。rows 按审核时间从新到旧。 */
export function applied(rows: Correction[]): Applied {
  const categories: Record<string, string> = {}
  const terms = new Map<string, string>()
  for (const r of rows) {
    try {
      const v = JSON.parse(r.value) as { category?: string, from?: string, to?: string }
      if (r.kind === "category" && r.repo && v.category && categoryLabels.has(v.category) && !(r.repo in categories)) categories[r.repo] = v.category
      if (r.kind === "term" && v.from && v.to && !terms.has(v.from)) terms.set(v.from, v.to)
    } catch {
      // 损坏的行跳过
    }
  }
  return { categories, terms: [...terms].map(([from, to]) => ({ from, to })).sort((a, b) => [...b.from].length - [...a.from].length) }
}

export function describe(r: Correction) {
  try {
    const v = JSON.parse(r.value) as { category?: string, from?: string, to?: string }
    return r.kind === "category" ? { category: v.category } : { from: v.from, to: v.to }
  } catch {
    return {}
  }
}
