import { type PointerEvent, useEffect, useRef } from "react"
import type { Period, Repository } from "@shared/discovery"
import { useScrollLock } from "../use-scroll-lock"
import { InsightActions } from "./actions"
import { InsightBasis } from "./basis"
import { InsightIntro } from "./header"
import { InsightNotes } from "./notes"
import { InsightTraffic } from "./traffic"

export interface InsightProps {
  repo: Repository
  period: Period
  saved: boolean
  onSave: () => void
  onClose: () => void
  onCopyLink: () => void
}

/**
 * 项目解读：桌面端放在右侧栏，手机上放进底部面板，两处内容一致。
 * 点开解读是为了了解项目和它的流量，所以只有两张主卡片：简介（含分类与技术栈标签）、流量数据（数字与走势）；
 * 适用场景有内容时才出现，分类依据收成一行小字。
 * 颜色只用三种：中性灰（文字、边框、底色）、强调蓝（主按钮、主分类、走势线）、红（增长）。
 */
export function RepoInsight({ repo, period, saved, onSave, onClose, onCopyLink }: InsightProps) {
  return (
    <article className="insight" aria-label={`${repo.fullName} 项目解读`}>
      <InsightIntro repo={repo} onClose={onClose} />
      <InsightTraffic repo={repo} period={period} />
      <InsightNotes repo={repo} />
      <InsightBasis repo={repo} />
      <InsightActions fullName={repo.fullName} saved={saved} onSave={onSave} onCopyLink={onCopyLink} />
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
