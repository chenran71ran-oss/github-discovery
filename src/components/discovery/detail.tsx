import { useEffect, useRef } from "react"
import type { Repository } from "@shared/discovery"
import { compact } from "@shared/discovery"
import { Icon, time } from "./utils"

export function RepoDetail({ repo, onClose, saved, onSave }: { repo: Repository, onClose: () => void, saved: boolean, onSave: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ref.current?.showModal()
    return () => previous?.focus()
  }, [])
  return (
    <dialog
      ref={ref}
      className="radar-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="detail-top">
        <span className="eyebrow">PROJECT INSIGHT / 项目解读</span>
        <button className="icon-btn" aria-label="关闭项目解读" onClick={onClose}><Icon name="i-ph:x" /></button>
      </div>
      <span className="repo-owner">{repo.fullName.split("/")[0]}</span>
      <h2>{repo.fullName.split("/")[1]}</h2>
      <div className="detail-numbers">
        <span>
          ☆
          {compact(repo.stars)}
          {" "}
          Stars
        </span>
        <span>
          ⑂
          {compact(repo.forks)}
          {" "}
          Forks
        </span>
        <span>{repo.language}</span>
      </div>
      <section>
        <h3>它是什么？</h3>
        <p>{repo.summary || "中文解读尚未生成。下方保留项目原始描述，便于查看真实信息。"}</p>
        <small className="summary-origin">
          {repo.summarySource === "ai-readme" ? "基于 README 的 AI 解读" : repo.summarySource === "upstream" ? "GithubTrending 中文速览 · 尚非 README 深读" : repo.summarySource === "editorial" ? "基于项目公开资料整理 · 不代表 AI 深度分析" : "原始信息"}
          {repo.summaryAt ? ` · ${time(repo.summaryAt)}` : ""}
        </small>
      </section>
      <section>
        <h3>适用场景</h3>
        <p>{repo.useCase || "暂无经过校验的适用场景，请先查看项目文档与使用条件。"}</p>
      </section>
      {repo.techStack.length > 0 && (
        <section>
          <h3>技术栈</h3>
          <div className="detail-tags">{repo.techStack.map(s => <span key={s}>{s}</span>)}</div>
        </section>
      )}
      {repo.highlights.length > 0 && (
        <section>
          <h3>值得关注</h3>
          <ul>{repo.highlights.map(s => <li key={s}>{s}</li>)}</ul>
        </section>
      )}
      <details className="original">
        <summary>查看原始项目简介</summary>
        <p>{repo.description}</p>
      </details>
      <div className="detail-buttons">
        <a className="primary-btn" href={`https://github.com/${repo.fullName}#readme`} target="_blank" rel="noreferrer">
          阅读 README
          <Icon name="i-ph:arrow-up-right" />
        </a>
        <button className="secondary-btn" onClick={onSave} aria-pressed={saved}>
          <Icon name={saved ? "i-ph:bookmark-simple-fill" : "i-ph:bookmark-simple"} />
          {saved ? "已收藏" : "收藏项目"}
        </button>
      </div>
    </dialog>
  )
}
