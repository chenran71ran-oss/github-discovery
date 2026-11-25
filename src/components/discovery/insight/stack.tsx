import type { Repository } from "@shared/discovery"
import { Module } from "./module"

/** 模块五：用什么做的、作者打了哪些主题。全部是中性色小标签 */
export function InsightStack({ repo }: { repo: Repository }) {
  const stack = [repo.language, ...repo.techStack.filter(s => s !== repo.language)].filter(s => s && s !== "未知")
  const topics = repo.topics ?? []
  if (!stack.length && !topics.length) return null
  return (
    <Module title="技术与主题">
      {stack.length > 0 && <ul className="ins-chips">{stack.map(s => <li key={s} className="chip-n">{s}</li>)}</ul>}
      {topics.length > 0 && <p className="ins-topics">{topics.map(t => `#${t}`).join("  ")}</p>}
    </Module>
  )
}

/** 模块六：只有 README 解读才有的适用场景与亮点；没有就不占位置 */
export function InsightNotes({ repo }: { repo: Repository }) {
  if (!repo.useCase && !repo.highlights.length) return null
  return (
    <Module title="适用场景">
      {repo.useCase && <p>{repo.useCase}</p>}
      {repo.highlights.length > 0 && <ul className="ins-list">{repo.highlights.map(s => <li key={s}>{s}</li>)}</ul>}
    </Module>
  )
}
