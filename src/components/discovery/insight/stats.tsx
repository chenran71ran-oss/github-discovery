import { type Period, type Repository, compact } from "@shared/discovery"
import { Gain, labels } from "../row"

/** 模块二：四个关键数字，一行读完 */
export function InsightStats({ repo, period }: { repo: Repository, period: Period }) {
  const moved = repo.previousRank ? repo.previousRank - repo.rank : 0
  return (
    <dl className="ins-stats">
      <div>
        <dt>{`${labels[period]}名次`}</dt>
        <dd>
          {repo.rank || "—"}
          {moved !== 0 && <small className={`move ${moved > 0 ? "up" : "down"}`} title="与昨日名次相比">{`${moved > 0 ? "↑" : "↓"}${Math.abs(moved)}`}</small>}
        </dd>
      </div>
      <div>
        <dt>{`${labels[period]}新增`}</dt>
        <dd><Gain repo={repo} period={period} /></dd>
      </div>
      <div>
        <dt>Star</dt>
        <dd>{compact(repo.stars)}</dd>
      </div>
      <div>
        <dt>Fork</dt>
        <dd>{compact(repo.forks)}</dd>
      </div>
    </dl>
  )
}
