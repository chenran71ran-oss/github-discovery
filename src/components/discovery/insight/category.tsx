import type { Repository } from "@shared/discovery"
import { categoryOf, domainLabel } from "@shared/taxonomy"
import { Module, More } from "./module"

/** 模块四：GIT Bot 分类。主分类一眼可见，置信度用文字，判断依据默认收起 */
export function InsightCategory({ repo }: { repo: Repository }) {
  const main = categoryOf(repo.category)
  const c = repo.classification
  const meta = c ? `${c.by === "ai" ? "模型判断" : "规则判断"} · 置信度 ${Math.round(c.confidence * 100)}%` : "旧快照"
  return (
    <Module title="分类" meta={meta}>
      <div className="ins-cats">
        <span className="ins-domain">{domainLabel(main.domain)}</span>
        <span className="ins-cat">{main.label}</span>
        {repo.tags?.map(t => <span key={t} className="chip-n">{categoryOf(t).label}</span>)}
      </div>
      {repo.purposes && repo.purposes.length > 0 && (
        <p className="ins-line">
          <span>用途</span>
          {repo.purposes.join(" · ")}
        </p>
      )}
      {c && c.reasons.length > 0 && (
        <More label={`判断依据（${c.reasons.length}）`}>
          <ul className="ins-chips">{c.reasons.map(r => <li key={r} className="chip-n">{r}</li>)}</ul>
        </More>
      )}
    </Module>
  )
}
