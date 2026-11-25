import type { Period, Repository } from "@shared/discovery"
import { Module } from "./module"
import { InsightStats } from "./stats"
import { InsightTrend } from "./trend"

/** 流量数据：四个关键数字 + 最近 14 天走势，放在同一张卡片里 */
export function InsightTraffic({ repo, period }: { repo: Repository, period: Period }) {
  return (
    <Module title="流量数据" className="traffic">
      <InsightStats repo={repo} period={period} />
      <InsightTrend fullName={repo.fullName} />
    </Module>
  )
}
