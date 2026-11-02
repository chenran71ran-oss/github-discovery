import type { CSSProperties } from "react"
import type { Repository } from "@shared/discovery"
import { categoryOf, domainLabel } from "@shared/taxonomy"
import { Icon } from "./icons"
import { categoryHues } from "./row"

const strategyNotes: Record<string, string> = {
  full: "综合主题、关键词、README、语言与技术栈五类信号",
  topics: "主题与关键词",
  keywords: "关键词",
  flat: "五类信号等权",
}

/**
 * GIT Bot 分类卡片：主分类、次要标签、置信度和判断依据。
 * 依据来自采集器里的分类引擎（collector/blocks/classify），不是事后编写的说明。
 */
export function Classified({ repo }: { repo: Repository }) {
  const main = categoryOf(repo.category)
  const c = repo.classification
  const confidence = c ? Math.round(c.confidence * 100) : null
  return (
    <section className="classified" aria-label="GIT Bot 分类">
      <h3>
        <Icon name="bot" />
        GIT Bot 分类
      </h3>
      <div className="cls-main">
        <span className="cls-domain">{domainLabel(main.domain)}</span>
        <span className="cls-cat" style={{ "--ch": categoryHues[main.label] ?? 210 } as CSSProperties}>{main.label}</span>
        {repo.tags?.map(t => <span key={t} className="cls-tag">{categoryOf(t).label}</span>)}
      </div>
      {confidence !== null && (
        <div className="cls-meter" title="主分类得分占全部分类得分的比例">
          <span>{c!.by === "ai" ? "模型判断" : "规则判断"}</span>
          <i><b style={{ width: `${Math.max(6, confidence)}%` }} /></i>
          <span className="n">{`${confidence}%`}</span>
        </div>
      )}
      {c && c.reasons.length > 0 && (
        <ul className="cls-why">
          {c.reasons.map(r => <li key={r}>{r}</li>)}
        </ul>
      )}
      {repo.purposes && repo.purposes.length > 0 && (
        <p className="cls-line">
          <span>用途</span>
          {repo.purposes.join(" · ")}
        </p>
      )}
      {repo.topics && repo.topics.length > 0 && (
        <p className="cls-line">
          <span>主题</span>
          {repo.topics.map(t => `#${t}`).join("  ")}
        </p>
      )}
      {c && <small className="origin">{`策略 ${c.strategy} · ${strategyNotes[c.strategy] || "自定义策略"}`}</small>}
      {!c && <small className="origin">这份快照早于 GIT Bot 分类引擎，只有主分类。</small>}
    </section>
  )
}
