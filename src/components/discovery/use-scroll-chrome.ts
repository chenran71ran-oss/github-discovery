import { useEffect, useState } from "react"

/** 程序触发的滚动（如键盘 J/K 让选中行进入视野）期间不收起悬浮栏 */
let heldUntil = 0
export function holdChrome(ms: number) {
  heldUntil = Date.now() + ms
}

/**
 * 顶部悬浮栏：往下浏览时收起并保持收起，停下来也不出现，界面保持干净；
 * 明确往回滑（连续向上 reveal 像素）、回到页面顶部附近、滑到底部，或键盘切换项目时才出现。
 * - 连续向下滑过 travel 像素才收起，轻微的滚动不会让栏闪一下；
 * - iOS 惯性回弹会产生小幅反向滚动，reveal 设得比 travel 大，避免误触发。
 */
export function useScrollChrome(edge = 64, travel = 24, reveal = 56) {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    let last = window.scrollY
    let moved = 0
    const onScroll = () => {
      const y = window.scrollY
      const delta = y - last
      last = y
      const bottom = y + window.innerHeight >= document.documentElement.scrollHeight - 4
      if (y < edge || bottom || Date.now() < heldUntil) {
        moved = 0
        setHidden(false)
        return
      }
      // 换方向时重新累计
      moved = Math.sign(delta) === Math.sign(moved) ? moved + delta : delta
      if (moved > travel) setHidden(true)
      else if (moved < -reveal) setHidden(false)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [edge, travel, reveal])
  return hidden
}
