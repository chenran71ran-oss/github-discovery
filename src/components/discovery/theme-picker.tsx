import { useEffect, useRef, useState } from "react"
import { Icon } from "./icons"
import { Segmented } from "./segmented"
import { type RadarTheme, previewBackground, themes } from "./theme"
import { useScrollLock } from "./use-scroll-lock"

export type Scheme = "dark" | "light" | "auto"
type Filter = "all" | "dark" | "light"

interface Props {
  open: boolean
  scheme: Scheme
  activeId: string
  onPick: (theme: RadarTheme) => void
  onAuto: () => void
  onClose: () => void
}

/** 配色选择器：桌面端是顶栏下的浮层，手机上是从底部升起的面板。 */
export function ThemePicker({ open, scheme, activeId, onPick, onAuto, onClose }: Props) {
  const [filter, setFilter] = useState<Filter>("all")
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useScrollLock(open)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current()
    }
    window.addEventListener("keydown", onKey)
    // 只在打开时把焦点移进面板，之后父组件重新渲染不会再抢焦点
    panel.current?.querySelector<HTMLElement>("button[data-active=\"true\"]")?.focus({ preventScroll: true })
    return () => window.removeEventListener("keydown", onKey)
  }, [open])
  if (!open) return null
  const list = themes.filter(t => filter === "all" || t.mode === filter)
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div ref={panel} className="picker glass" role="dialog" aria-label="配色方案">
        <div className="grabber" aria-hidden="true" />
        <div className="picker-head">
          <h3>配色方案</h3>
          <button type="button" className="icon-btn" aria-label="关闭配色面板" onClick={onClose}><Icon name="x" /></button>
        </div>
        <button type="button" className={`auto-card ${scheme === "auto" ? "on" : ""}`} aria-pressed={scheme === "auto"} onClick={onAuto}>
          <Icon name="wand" />
          <span>
            跟随系统
            <small>手机切换到深色或浅色模式时，页面自动跟着变</small>
          </span>
          {scheme === "auto" && <Icon name="check" />}
        </button>
        <Segmented<Filter> className="picker-filter" label="按明暗筛选" value={filter} onChange={setFilter} options={[{ value: "all", label: "全部" }, { value: "dark", label: "深色" }, { value: "light", label: "浅色" }]} />
        <div className="theme-grid">
          {list.map((theme) => {
            const active = scheme !== "auto" && theme.id === activeId
            return (
              <button key={theme.id} type="button" className={`theme-card ${active ? "on" : ""}`} aria-pressed={active} data-active={active} onClick={() => onPick(theme)}>
                <span className="theme-preview" style={{ background: previewBackground(theme) }}>
                  <i style={{ background: theme.accent }} />
                  <i style={{ background: theme.ink }} />
                </span>
                <span className="theme-name">
                  <Icon name={theme.mode === "dark" ? "moon" : "sun"} />
                  {theme.name}
                  {active && <Icon name="check" className="theme-check" />}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
