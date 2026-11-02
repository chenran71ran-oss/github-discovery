import doc from "./taxonomy.json"

/**
 * 分类体系：前端与采集器（collector/core/taxonomy.py）共用 shared/taxonomy.json。
 * 领域（开发 / 工具 / 生活 / 学习）→ 细类；每个细类有「用途」或「技术」两种视角。
 */
export interface CategoryDef {
  id: string
  label: string
  domain: string
  facet: "purpose" | "tech"
}
export const taxonomyVersion = doc.version
export const domains: { id: string, label: string }[] = doc.domains
export const categories: CategoryDef[] = doc.categories.map(c => ({ id: c.id, label: c.label, domain: c.domain, facet: c.facet as CategoryDef["facet"] }))
export const fallback: CategoryDef = { ...doc.fallback, facet: "purpose" }
const legacy: Record<string, string> = doc.legacy

const byLabel = new Map([...categories, fallback].map(c => [c.label, c]))
const byId = new Map([...categories, fallback].map(c => [c.id, c]))

/** 标签 → 分类；旧快照里已改名的标签（如「学习与研究」）映射到新分类。 */
export function categoryOf(label: string | undefined): CategoryDef {
  if (!label) return fallback
  return byLabel.get(label) || byId.get(legacy[label]) || fallback
}
export function domainLabel(id: string) {
  return domains.find(d => d.id === id)?.label || "其他"
}
