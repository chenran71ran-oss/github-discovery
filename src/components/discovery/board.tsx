import type { Period, Repository } from "@shared/discovery"
import { compact } from "@shared/discovery"
import { OverlayScrollbar } from "../common/overlay-scrollbar"
import { Icon, time } from "./utils"

interface BoardProps {
  title: string
  subtitle: string
  color: string
  period: Period
  rows: Repository[]
  capturedAt: string
  failed: boolean
  saved: Record<string, Repository>
  onSave: (repo: Repository) => void
  onOpen: (repo: Repository) => void
  onRefresh: () => void
  refreshing: boolean
}
const growthLabels = { daily: "今日", weekly: "本周", monthly: "本月" }
export function Board({ title, subtitle, color, period, rows, capturedAt, failed, saved, onSave, onOpen, onRefresh, refreshing }: BoardProps) {
  const stale = Date.now() - Date.parse(capturedAt) > 30 * 3600000
  return (
    <section className={`news-board board-${color}`} aria-label={`${title} ${subtitle}`}>
      <header className="board-header">
        <Icon name="i-ph:github-logo-duotone" className="board-icon" />
        <div className="board-heading">
          <h2>
            {title}
            <small>{subtitle}</small>
          </h2>
          <p>
            {failed ? "采集失败，保留上次榜单" : `${time(capturedAt)} 更新`}
            {stale && " · 数据较旧"}
          </p>
        </div>
        <span className="board-count" title="当前筛选后的项目数">{rows.length}</span>
        <button type="button" className="icon-btn" aria-label={`刷新${title}${subtitle}`} onClick={onRefresh} disabled={refreshing}><Icon name={refreshing ? "i-ph:circle-dashed-duotone spin" : "i-ph:arrow-counter-clockwise-duotone"} /></button>
      </header>
      <OverlayScrollbar className="board-content" options={{ overflow: { x: "hidden" } }} defer>
        {rows.length
          ? (
              <ol className="board-list">
                {rows.map(repo => (
                  <li key={repo.fullName} className="board-row">
                    <span className="row-rank">{repo.rank}</span>
                    <div className="row-content">
                      <button type="button" className="row-title" onClick={() => onOpen(repo)}>{repo.fullName}</button>
                      <p className="row-summary">{repo.summary || repo.description || "暂无项目简介"}</p>
                      <div className="row-meta">
                        <span>{repo.language}</span>
                        <span>
                          ☆
                          {compact(repo.stars)}
                        </span>
                        <span>
                          {growthLabels[period]}
                          {" "}
                          {repo.periodStars == null ? "—" : `+${compact(repo.periodStars)}`}
                        </span>
                      </div>
                    </div>
                    <button type="button" className="row-save icon-btn" aria-label={`${saved[repo.fullName] ? "取消收藏" : "收藏"} ${repo.fullName}`} aria-pressed={!!saved[repo.fullName]} onClick={() => onSave(repo)}><Icon name={saved[repo.fullName] ? "i-ph:star-fill" : "i-ph:star-duotone"} /></button>
                  </li>
                ))}
              </ol>
            )
          : (
              <div className="board-empty">
                <Icon name="i-ph:binoculars-duotone" />
                <p>{title === "我的收藏" ? "收藏感兴趣的项目，会显示在这里。" : "没有匹配的项目，试试其他筛选条件。"}</p>
              </div>
            )}
      </OverlayScrollbar>
    </section>
  )
}
