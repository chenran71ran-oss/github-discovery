import { type CSSProperties, useState } from "react"
import { domains } from "@shared/taxonomy"
import { chipCategories } from "./model"
import { categoryHues } from "./row"

interface Props {
  total: number
  byDomain: Map<string, number>
  byCategory: Map<string, number>
  domain: string
  category: string
  onDomain: (domain: string) => void
  onCategory: (category: string) => void
}

/**
 * 两级分类筛选：第一行是领域（全部 / 开发 / 工具 / 生活 / 学习），第二行是该领域的细类。
 * 细类自动换行，不需要横向滑动；「全部」时只列最常见的几类，可以展开。
 */
export function CategoryFilter({ total, byDomain, byCategory, domain, category, onDomain, onCategory }: Props) {
  const [expanded, setExpanded] = useState(false)
  const chips = chipCategories(domain, byCategory, expanded)
  const hidden = !domain && !expanded && chipCategories("", byCategory, true).length > chips.length
  return (
    <div className="cat-filter">
      <div className="domains" role="group" aria-label="领域">
        {[{ id: "", label: "全部" }, ...domains].map((d) => {
          const n = d.id ? byDomain.get(d.id) || 0 : total
          if (d.id && !n && domain !== d.id) return null
          return (
            <button
              key={d.id || "all"}
              type="button"
              className="domain"
              aria-pressed={domain === d.id}
              onClick={() => {
                onDomain(d.id)
                onCategory("")
              }}
            >
              {d.label}
              <span className="n">{n}</span>
            </button>
          )
        })}
      </div>
      <div className="chips" role="group" aria-label="细分类别">
        {chips.map(c => (
          <button key={c.id} type="button" className="chip" style={{ "--ch": categoryHues[c.label] ?? 210 } as CSSProperties} aria-pressed={category === c.label} onClick={() => onCategory(category === c.label ? "" : c.label)}>
            <i />
            {c.label}
            <span className="n">{byCategory.get(c.label) || 0}</span>
          </button>
        ))}
        {hidden && <button type="button" className="chip more" onClick={() => setExpanded(true)}>展开全部分类</button>}
        {!domain && expanded && <button type="button" className="chip more" onClick={() => setExpanded(false)}>收起</button>}
      </div>
    </div>
  )
}
