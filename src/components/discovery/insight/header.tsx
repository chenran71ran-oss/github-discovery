import type { Repository } from "@shared/discovery"
import { categoryOf, domainLabel } from "@shared/taxonomy"
import { time } from "../format"
import { Icon, RepoIcon } from "../icons"
import { More } from "./module"

const sources: Record<Repository["summarySource"], string> = {
  "ai-readme": "README 解读",
  "upstream": "上游速览",
  "editorial": "资料整理",
  "machine": "机翻",
  "pending": "原始简介",
}

/**
 * 简介卡片：是谁、是什么、属于哪类、用什么做的。
 * 名字只占一行小标题，重心放在一句话简介；分类与技术栈作为醒目的标签放在简介下面，不再单独成框。
 */
export function InsightIntro({ repo, onClose }: { repo: Repository, onClose: () => void }) {
  const [owner, name] = repo.fullName.split("/")
  const main = categoryOf(repo.category)
  const tags = (repo.tags ?? []).map(t => categoryOf(t).label).filter(t => t !== main.label)
  const stack = [repo.language, ...repo.techStack].filter((s, i, all) => s && s !== "未知" && all.indexOf(s) === i)
  const translated = !!repo.summary && repo.summary !== repo.description
  return (
    <section className="mod intro" aria-label="简介">
      <header className="intro-head">
        <RepoIcon fullName={repo.fullName} />
        <div className="intro-name">
          <h2>{name}</h2>
          <span>{owner}</span>
        </div>
        <button type="button" className="icon-btn" aria-label="关闭项目解读" onClick={onClose}><Icon name="x" /></button>
      </header>
      <p className="intro-lead">{repo.summary || repo.description}</p>
      <ul className="tags" aria-label="分类与技术栈">
        <li className="tag main" title={`${domainLabel(main.domain)} / ${main.label}`}>{main.label}</li>
        {tags.map(t => <li key={t} className="tag cat">{t}</li>)}
        {stack.map(s => <li key={s} className="tag">{s}</li>)}
      </ul>
      <div className="intro-source">
        <span title={repo.summarySource === "machine" ? "只翻译了项目简介，可能不够准确" : undefined}>
          {sources[repo.summarySource]}
          {repo.summaryAt ? ` · ${time(repo.summaryAt)}` : ""}
        </span>
        {translated && (
          <More label="原文">
            <p lang="en">{repo.description}</p>
          </More>
        )}
      </div>
    </section>
  )
}
