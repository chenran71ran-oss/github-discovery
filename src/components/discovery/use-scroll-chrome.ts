import { useEffect, useState } from "react"

/**
 * 顶部与底部的悬浮玻璃栏：滑动时收起，停下来后弹回。
 * 页面顶部附近始终显示；iOS 惯性滚动期间会持续触发 scroll，所以惯性结束后才会弹回。
 */
export function useScrollChrome(idle = 320, edge = 64) {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    let last = window.scrollY
    let timer = 0
    const onScroll = () => {
      const y = window.scrollY
      const delta = y - last
      last = y
      window.clearTimeout(timer)
      if (y < edge) {
        setHidden(false)
        return
      }
      if (Math.abs(delta) > 2) setHidden(true)
      timer = window.setTimeout(() => setHidden(false), idle)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.clearTimeout(timer)
    }
  }, [idle, edge])
  return hidden
}
