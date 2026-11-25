import type { Repository } from "@shared/discovery"
import { Module } from "./module"

/** 适用场景与亮点：只有 README 解读才有，没有就不占位置 */
export function InsightNotes({ repo }: { repo: Repository }) {
  if (!repo.useCase && !repo.highlights.length) return null
  return (
    <Module title="适用场景">
      {repo.useCase && <p>{repo.useCase}</p>}
      {repo.highlights.length > 0 && <ul className="ins-list">{repo.highlights.map(s => <li key={s}>{s}</li>)}</ul>}
    </Module>
  )
}
