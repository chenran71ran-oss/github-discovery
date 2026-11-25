import type { Repository } from "@shared/discovery"
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

/** 模块一：是谁、是什么。名字之下直接给一句话简介，这是打开解读最想知道的 */
export function InsightHeader({ repo, onClose }: { repo: Repository, onClose: () => void }) {
  const [owner, name] = repo.fullName.split("/")
  const translated = !!repo.summary && repo.summary !== repo.description
  return (
    <header className="ins-top">
      <div className="ins-head">
        <RepoIcon fullName={repo.fullName} />
        <div className="ins-title">
          <span className="own">{owner}</span>
          <h2>{name}</h2>
        </div>
        <button type="button" className="icon-btn" aria-label="关闭项目解读" onClick={onClose}><Icon name="x" /></button>
      </div>
      <p className="ins-lead">{repo.summary || repo.description}</p>
      <div className="ins-source">
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
    </header>
  )
}
