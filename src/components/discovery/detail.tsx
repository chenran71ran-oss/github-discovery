import { type PointerEvent, useEffect, useRef } from "react"
import { type Period, type Repository, compact } from "@shared/discovery"
import { Icon, RepoIcon } from "./icons"
import { Classified } from "./classified"
import { Gain, labels, languageColors } from "./row"
import { Section } from "./section"
import { useScrollLock } from "./use-scroll-lock"

export function time(date: string) {
  return new Date(date).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
}

const sourceChips: Record<Repository["summarySource"], string> = {
  "ai-readme": "README 解读",
  "upstream": "上游速览",
  "editorial": "资料整理",
  "machine": "机翻",
  "pending": "原始简介",
}
const sourceNotes: Record<Repository["summarySource"], string> = {
  "ai-readme": "基于 README 的 AI 解读",
  "upstream": "GithubTrending 中文速览 · 尚非 README 深读",
  "editorial": "基于项目公开资料整理 · 不代表 AI 深度分析",
  "machine": "机器翻译 · 只翻译了项目简介，可能不够准确",
  "pending": "中文解读尚未生成，以下为原始简介",
}

interface InsightProps {
  repo: Repository
  period: Period
  saved: boolean
  onSave: () => void
  onClose: () => void
  onCopyLink: () => void
}

/** 项目解读正文：桌面端放在右侧栏，手机上放进底部面板，两处内容一致。 */
export function RepoInsight({ repo, period, saved, onSave, onClose, onCopyLink }: InsightProps) {
  const [owner, name] = repo.fullName.split("/")
  const moved = repo.previousRank ? repo.previousRank - repo.rank : 0
  const translated = repo.summary && repo.summary !== repo.description
  return (
    <article className="insight" aria-label={`${repo.fullName} 项目解读`}>
      <header className="ins-head">
        <RepoIcon fullName={repo.fullName} />
        <div className="ins-title">
          <span className="own">{owner}</span>
          <h2>{name}</h2>
        </div>
        <button type="button" className="icon-btn" aria-label="关闭项目解读" onClick={onClose}><Icon name="x" /></button>
      </header>
      <dl className="ins-stats">
        <div>
          <dt>{`${labels[period]}名次`}</dt>
          <dd>
            {repo.rank || "—"}
            {moved !== 0 && <small className={`move ${moved > 0 ? "up" : "down"}`}>{`${moved > 0 ? "↑" : "↓"}${Math.abs(moved)}`}</small>}
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
      <div className="ins-tags">
        <span className="lang">
          <i style={{ backgroundColor: languageColors[repo.language] || "#9b8ca9" }} />
          {repo.language}
        </span>
        {repo.techStack.map(s => <span key={s}>{s}</span>)}
      </div>
      <Classified repo={repo} />
      <Section title="它是什么" chip={sourceChips[repo.summarySource]} tone={repo.summarySource === "ai-readme" ? "ok" : repo.summarySource === "machine" || repo.summarySource === "pending" ? "warn" : "neutral"}>
        <p>{repo.summary || repo.description}</p>
        <small className="origin">
          {sourceNotes[repo.summarySource]}
          {repo.summaryAt ? ` · ${time(repo.summaryAt)}` : ""}
        </small>
      </Section>
      {repo.useCase && (
        <Section title="适用场景">
          <p>{repo.useCase}</p>
        </Section>
      )}
      {repo.highlights.length > 0 && (
        <Section title="值得关注" chip={`${repo.highlights.length} 条`}>
          <ul>{repo.highlights.map(s => <li key={s}>{s}</li>)}</ul>
        </Section>
      )}
      {translated && (
        <details className="original">
          <summary>原始简介</summary>
          <p>{repo.description}</p>
        </details>
      )}
      <div className="ins-actions">
        <a className="act primary" href={`https://github.com/${repo.fullName}`} target="_blank" rel="noreferrer">
          <Icon name="github" />
          在 GitHub 打开
        </a>
        <button type="button" className={`act ${saved ? "on" : ""}`} onClick={onSave} aria-pressed={saved}>
          <Icon name="bookmark" />
          {saved ? "已收藏" : "收藏"}
        </button>
        <button type="button" className="act icon-only" onClick={onCopyLink} aria-label="复制这个项目的链接" title="复制链接">
          <Icon name="link" />
        </button>
      </div>
    </article>
  )
}

/** 手机与窄屏：贴底面板，按住顶部横条向下拖可关闭。 */
export function RepoSheet(props: InsightProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const drag = useRef<{ y: number, dy: number } | null>(null)
  useScrollLock(true)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ref.current?.showModal()
    // 焦点放在面板本身，而不是自动落到关闭按钮上（否则一打开就显示焦点框）
    ref.current?.focus()
    return () => previous?.focus({ preventScroll: true })
  }, [])
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !ref.current) return
    drag.current.dy = Math.max(0, e.clientY - drag.current.y)
    ref.current.style.transform = `translateY(${drag.current.dy}px)`
  }
  const end = () => {
    if (!drag.current || !ref.current) return
    const { dy } = drag.current
    drag.current = null
    ref.current.style.removeProperty("transition")
    if (dy > 90) props.onClose()
    else ref.current.style.removeProperty("transform")
  }
  return (
    <dialog
      ref={ref}
      className="sheet"
      tabIndex={-1}
      aria-label={`${props.repo.fullName} 项目解读`}
      onCancel={(e) => {
        e.preventDefault()
        props.onClose()
      }}
      onClick={(e) => {
        // 只有点在面板矩形外（背景遮罩）才关闭
        if (e.target !== e.currentTarget) return
        const r = e.currentTarget.getBoundingClientRect()
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) props.onClose()
      }}
    >
      <div
        className="grabber"
        aria-hidden="true"
        onPointerDown={(e) => {
          drag.current = { y: e.clientY, dy: 0 }
          e.currentTarget.setPointerCapture(e.pointerId)
          ref.current?.style.setProperty("transition", "none")
        }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <i />
      </div>
      <RepoInsight {...props} />
    </dialog>
  )
}
