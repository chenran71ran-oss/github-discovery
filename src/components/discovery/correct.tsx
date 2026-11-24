import { type FormEvent, useState } from "react"
import type { Repository } from "@shared/discovery"
import { categories, categoryOf, domains } from "@shared/taxonomy"
import type { CorrectionInput } from "./api"

export type OnCorrect = (body: CorrectionInput) => Promise<boolean>

/** 「分错了？」：选一个正确的主分类提交；站长审核后对所有人生效（站长自己提交的直接生效） */
export function CategoryFix({ repo, onCorrect }: { repo: Repository, onCorrect: OnCorrect }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(categoryOf(repo.category).label)
  const [busy, setBusy] = useState(false)
  if (!open) return <button type="button" className="link fix-open" onClick={() => setOpen(true)}>分错了？</button>
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (value === categoryOf(repo.category).label) return setOpen(false)
    setBusy(true)
    if (await onCorrect({ kind: "category", repo: repo.fullName, category: value })) setOpen(false)
    setBusy(false)
  }
  return (
    <form className="fix" onSubmit={e => void submit(e)}>
      <label>
        <span>应该是</span>
        <select value={value} onChange={e => setValue(e.target.value)} aria-label="正确的分类">
          {domains.map(d => (
            <optgroup key={d.id} label={d.label}>
              {categories.filter(c => c.domain === d.id).map(c => <option key={c.id} value={c.label}>{c.label}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      <button type="submit" className="act primary sm" disabled={busy}>提交</button>
      <button type="button" className="link" onClick={() => setOpen(false)}>取消</button>
    </form>
  )
}

/** 「译得不对？」：把译文里错的词改成对的。改正是全局术语：通过后所有机翻简介里的这个词都会改。 */
export function TermFix({ repo, onCorrect }: { repo: Repository, onCorrect: OnCorrect }) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [busy, setBusy] = useState(false)
  if (!open) {
    return (
      <button
        type="button"
        className="link fix-open"
        onClick={() => {
          // 选中了简介里的一段文字时，直接填进「原译法」
          const picked = window.getSelection()?.toString().trim() || ""
          if (picked && picked.length <= 30 && repo.summary?.includes(picked)) setFrom(picked)
          setOpen(true)
        }}
      >
        译得不对？
      </button>
    )
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    if (await onCorrect({ kind: "term", repo: repo.fullName, from: from.trim(), to: to.trim() })) {
      setOpen(false)
      setFrom("")
      setTo("")
    }
    setBusy(false)
  }
  const missing = !!from.trim() && !repo.summary?.includes(from.trim())
  return (
    <form className="fix term" onSubmit={e => void submit(e)}>
      <input aria-label="原译法" placeholder="原译法，如：代理技能" value={from} maxLength={30} onChange={e => setFrom(e.target.value)} />
      <span aria-hidden="true">→</span>
      <input aria-label="正确译法" placeholder="应改为，如：智能体技能" value={to} maxLength={30} onChange={e => setTo(e.target.value)} />
      <button type="submit" className="act primary sm" disabled={busy || missing || [...from.trim()].length < 2 || !to.trim() || from.trim() === to.trim()}>提交</button>
      <button type="button" className="link" onClick={() => setOpen(false)}>取消</button>
      <small className="fix-hint">{missing ? "这段简介里没有这个词，请从上面的译文里复制。" : "通过审核后，所有机翻简介里的这个词都会改正。"}</small>
    </form>
  )
}
