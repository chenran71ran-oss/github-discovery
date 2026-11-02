import { flushSync } from "react-dom"

/**
 * 单一主题：深浅两套颜色令牌写在 style.css 的 `.radar-app[data-mode]` 下，这里只负责切换。
 *
 * 为什么不直接改颜色：整页约 250 行榜单都从主题变量派生颜色，换主题时浏览器要在一帧里
 * 重新计算全部样式，再叠加几百个元素各自的颜色过渡，就会一卡一卡的。所以切换时：
 *   1. 支持 View Transitions 的浏览器先冻结旧画面，在快照后面一次性换好主题，
 *      再由 GPU 从按钮位置圆形展开新主题；
 *   2. 切换期间给 <html> 加上 theme-switching，暂停所有元素自己的颜色过渡。
 * 系统要求减少动态效果或浏览器不支持时，直接瞬间切换。
 */
export const pageBackground = { dark: "#0b0d12", light: "#f5f6f8" } as const

export function switchMode(apply: () => void, origin?: { x: number, y: number }) {
  const root = document.documentElement
  root.classList.add("theme-switching")
  const finish = () => requestAnimationFrame(() => root.classList.remove("theme-switching", "theme-vt"))
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  if (!document.startViewTransition || reduce) {
    flushSync(apply)
    finish()
    return
  }
  const x = origin?.x ?? window.innerWidth / 2
  const y = origin?.y ?? 0
  // 圆形要盖住离起点最远的那个角
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  root.style.setProperty("--vt-x", `${x}px`)
  root.style.setProperty("--vt-y", `${y}px`)
  root.style.setProperty("--vt-r", `${r}px`)
  root.classList.add("theme-vt")
  document.startViewTransition(() => flushSync(apply)).finished.finally(finish)
}
