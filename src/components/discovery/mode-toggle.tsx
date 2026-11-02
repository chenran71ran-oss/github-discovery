import type { MouseEvent } from "react"

/**
 * 明暗切换：太阳与月亮是同一个图形的两种状态。
 * 深色时圆心放大、被另一个圆「咬」出月牙，光芒旋转收起；浅色时反过来。
 * 只动 transform 与 opacity，切换主题的那一帧不会再额外触发布局。
 */
export function ModeToggle({ dark, onToggle }: { dark: boolean, onToggle: (origin: { x: number, y: number }) => void }) {
  const click = (e: MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    onToggle({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
  }
  return (
    <button type="button" className="mode-toggle" data-dark={dark} aria-label={dark ? "切换到浅色" : "切换到深色"} title={dark ? "切换到浅色" : "切换到深色"} onClick={click}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <mask id="mode-toggle-cut">
          <rect width="24" height="24" fill="#fff" />
          <circle className="mt-bite" cx="12" cy="12" r="7" fill="#000" />
        </mask>
        <circle className="mt-core" cx="12" cy="12" r="8" fill="currentColor" mask="url(#mode-toggle-cut)" />
        <g className="mt-rays" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {[0, 45, 90, 135, 180, 225, 270, 315].map(a => <line key={a} x1="12" y1="1.8" x2="12" y2="3.6" transform={`rotate(${a} 12 12)`} />)}
        </g>
      </svg>
    </button>
  )
}
