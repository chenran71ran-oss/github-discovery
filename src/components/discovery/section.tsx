import type { ReactNode } from "react"

export type ChipTone = "neutral" | "ok" | "warn" | "accent"

/**
 * 侧栏与解读里每一块内容的标题：左边小标题，右边一个小状态框，
 * 用来一眼区分「这一块是什么、现在是什么状态」，例如更新时间、数量、内容来源。
 */
export function Section({ title, icon, chip, tone = "neutral", className = "", children }: { title: string, icon?: ReactNode, chip?: ReactNode, tone?: ChipTone, className?: string, children: ReactNode }) {
  return (
    <section className={`sec ${className}`}>
      <header className="sec-head">
        <h3>
          {icon}
          {title}
        </h3>
        {chip !== undefined && chip !== null && chip !== "" && <span className={`sec-chip ${tone}`}>{chip}</span>}
      </header>
      {children}
    </section>
  )
}
