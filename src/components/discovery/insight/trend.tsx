import { type KeyboardEvent, type PointerEvent, useId, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { compact } from "@shared/discovery"
import { loadTrends } from "../api"
import { Module } from "./module"

const W = 300
const H = 76
const PAD = { top: 8, right: 8, bottom: 6, left: 8 }

const day = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`

/**
 * 详情里的「最近 14 天」：总 Star 的走势（单一折线，不叠第二条刻度），
 * 名次放在文字里。悬停或用左右键查看每天的数字。
 */
export function InsightTrend({ fullName }: { fullName: string }) {
  const trends = useQuery({ queryKey: ["trends"], queryFn: loadTrends, staleTime: 600_000, retry: 1, refetchOnWindowFocus: false })
  const series = trends.data?.repos[fullName]
  if (!trends.data || !series || series.stars.filter(v => v !== null).length < 2) return null
  return <Trend days={trends.data.days} stars={series.stars} rank={series.rank} />
}

function Trend({ days, stars, rank }: { days: string[], stars: (number | null)[], rank: (number | null)[] }) {
  const id = useId()
  const [hover, setHover] = useState<number | null>(null)
  const known = stars.map((v, i) => ({ v, i })).filter((p): p is { v: number, i: number } => p.v !== null)
  const geo = useMemo(() => {
    const values = known.map(p => p.v)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || Math.max(1, max * 0.01)
    const x = (i: number) => PAD.left + (days.length > 1 ? (i / (days.length - 1)) * (W - PAD.left - PAD.right) : (W - PAD.left - PAD.right) / 2)
    const y = (v: number) => PAD.top + (1 - (v - min) / span) * (H - PAD.top - PAD.bottom)
    // 没上榜的日子断开折线，不凭空连线
    let d = ""
    let prev = -2
    for (const p of known) {
      d += `${p.i === prev + 1 ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`
      prev = p.i
    }
    return { x, y, d }
  }, [known, days.length])

  const first = known[0]
  const last = known[known.length - 1]
  const gained = last.v - first.v
  const listed = rank.filter(r => r !== null)
  const best = listed.length ? Math.min(...(listed as number[])) : null
  const focus = hover ?? last.i

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const rel = ((e.clientX - box.left) / box.width) * W
    const nearest = known.reduce((a, b) => Math.abs(geo.x(b.i) - rel) < Math.abs(geo.x(a.i) - rel) ? b : a)
    setHover(nearest.i)
  }
  const step = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
    e.preventDefault()
    const at = known.findIndex(p => p.i === focus)
    const next = known[Math.max(0, Math.min(known.length - 1, at + (e.key === "ArrowRight" ? 1 : -1)))]
    setHover(next.i)
  }
  const fv = stars[focus]
  const fr = rank[focus]
  const summary = `${day(days[first.i])} 到 ${day(days[last.i])}，Star 从 ${compact(first.v)} 到 ${compact(last.v)}，上榜 ${listed.length} 天${best ? `，日榜最高第 ${best} 名` : ""}`

  return (
    <Module title={`最近 ${days.length} 天`} meta={`${gained >= 0 ? "+" : "−"}${compact(Math.abs(gained))} Star`}>
      <div className="trend">
        <div className="trend-read" aria-hidden="true">
          <span>{day(days[focus])}</span>
          <b>{fv !== null ? `${compact(fv)} Star` : "未收录"}</b>
          <span>{fr ? `日榜 #${fr}` : "不在日榜"}</span>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-labelledby={`${id}-t`}
          tabIndex={0}
          onPointerMove={pick}
          onPointerLeave={() => setHover(null)}
          onKeyDown={step}
          onBlur={() => setHover(null)}
        >
          <title id={`${id}-t`}>{summary}</title>
          <line className="trend-base" x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} />
          {hover !== null && <line className="trend-cross" x1={geo.x(focus)} x2={geo.x(focus)} y1={PAD.top - 4} y2={H - PAD.bottom} />}
          <path className="trend-line" d={geo.d} />
          {fv !== null && <circle className="trend-dot" cx={geo.x(focus)} cy={geo.y(fv)} r={4} />}
        </svg>
        <div className="trend-axis" aria-hidden="true">
          <span>{day(days[0])}</span>
          <span>{day(days[days.length - 1])}</span>
        </div>
        <p className="trend-note">{`上榜 ${listed.length} / ${days.length} 天${best ? ` · 日榜最高 #${best}` : ""}`}</p>
      </div>
    </Module>
  )
}
