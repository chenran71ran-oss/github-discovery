import { useEffect } from "react"

/**
 * 弹层打开时锁住页面滚动。iOS Safari 的原生 dialog 不会阻止背景滚动，
 * 不锁的话在面板上滑动会带着后面的榜单一起动。
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = "hidden"
    return () => {
      root.style.overflow = previous
    }
  }, [active])
}
