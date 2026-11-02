import { useEffect, useState } from "react"

/** 程序触发的滚动（如键盘 J/K 让选中行进入视野）期间不收起悬浮栏 */
let heldUntil = 0
export function holdChrome(ms: number) {
  heldUntil = Date.now() + ms
}

/**
 * 顶部与底部的悬浮玻璃栏：滑动时淡出，停下来后淡入。
 * - 连续滑过 travel 像素才收起，轻微的滚动不会让栏闪一下；
 * - 停止滚动 idle 毫秒后浮现；iOS 惯性滚动期间会持续触发 scroll，所以惯性结束后才浮现；
 * - 页面顶部附近、以及键盘切换项目时始终显示。
 */
export function useScrollChrome(idle = 260, edge = 64, travel = 24) {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    let last = window.scrollY
    let moved = 0
    let timer = 0
    const onScroll = () => {
      const y = window.scrollY
      const delta = y - last
      last = y
      window.clearTimeout(timer)
      if (y < edge || Date.now() < heldUntil) {
        moved = 0
        setHidden(false)
        return
      }
      // 换方向时重新累计
      moved = Math.sign(delta) === Math.sign(moved) ? moved + delta : delta
      if (Math.abs(moved) > travel) setHidden(true)
      timer = window.setTimeout(() => {
        moved = 0
        setHidden(false)
      }, idle)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.clearTimeout(timer)
    }
  }, [idle, edge, travel])
  return hidden
}
