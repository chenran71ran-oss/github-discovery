import type { Repository } from "@shared/discovery"
import { More } from "./module"

/** 分类依据：不加框，收成一行小字；想知道为什么这样分时再展开 */
export function InsightBasis({ repo }: { repo: Repository }) {
  const c = repo.classification
  const topics = repo.topics ?? []
  if (!c && !repo.purposes?.length && !topics.length) return null
  const label = c ? `分类依据 · ${c.by === "ai" ? "模型判断" : "规则判断"} · 置信度 ${Math.round(c.confidence * 100)}%` : "分类依据"
  return (
    <More label={label}>
      <div className="basis">
        {c && c.reasons.length > 0 && <ul className="ins-chips">{c.reasons.map(r => <li key={r} className="chip-n">{r}</li>)}</ul>}
        {repo.purposes && repo.purposes.length > 0 && (
          <p>
            <span>用途</span>
            {repo.purposes.join(" · ")}
          </p>
        )}
        {topics.length > 0 && (
          <p>
            <span>主题</span>
            {topics.map(t => `#${t}`).join("  ")}
          </p>
        )}
      </div>
    </More>
  )
}
