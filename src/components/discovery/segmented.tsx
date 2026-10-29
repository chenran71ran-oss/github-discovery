import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react"

interface Option<T extends string> {
  value: T
  label: ReactNode
  ariaLabel?: string
}

/**
 * 分段控件：选中态是一块会滑动的玻璃滑块，位置变化带轻微回弹。
 * 滑块只用 transform 与 width，iPhone 上不会触发整页重排。
 */
export function Segmented<T extends string>({ value, options, onChange, label, className = "" }: { value: T, options: Option<T>[], onChange: (value: T) => void, label: string, className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState<{ x: number, w: number } | null>(null)
  const [ready, setReady] = useState(false)
  const measure = () => {
    const active = ref.current?.querySelector<HTMLElement>("button[aria-pressed=\"true\"]")
    if (active) setPill(prev => prev && prev.x === active.offsetLeft && prev.w === active.offsetWidth ? prev : { x: active.offsetLeft, w: active.offsetWidth })
  }
  useLayoutEffect(measure, [value, options.length])
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true))
    const el = ref.current
    if (!el || typeof ResizeObserver === "undefined") return () => cancelAnimationFrame(frame)
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])
  return (
    <div ref={ref} className={`seg ${ready ? "ready" : ""} ${className}`} role="group" aria-label={label}>
      <span className="seg-pill" aria-hidden="true" style={pill ? { transform: `translateX(${pill.x}px)`, width: pill.w } : { opacity: 0 }} />
      {options.map(option => (
        <button key={option.value} type="button" aria-pressed={value === option.value} aria-label={option.ariaLabel} onClick={() => onChange(option.value)}>{option.label}</button>
      ))}
    </div>
  )
}
