import type { ReactNode } from "react"

/**
 * 解读里的每一块都用同一个外壳：左边小标题，右边一行普通文字（不带彩色状态点）。
 * 模块之间只靠留白和细边框区分，颜色留给真正要强调的东西。
 */
export function Module({ title, meta, className = "", children }: { title: string, meta?: ReactNode, className?: string, children: ReactNode }) {
  return (
    <section className={`mod ${className}`}>
      <header className="mod-head">
        <h3>{title}</h3>
        {meta !== undefined && meta !== null && meta !== "" && <span className="mod-meta">{meta}</span>}
      </header>
      {children}
    </section>
  )
}

/** 默认收起的次要内容（判断依据、原始简介等） */
export function More({ label, children }: { label: string, children: ReactNode }) {
  return (
    <details className="mod-more">
      <summary>{label}</summary>
      {children}
    </details>
  )
}
