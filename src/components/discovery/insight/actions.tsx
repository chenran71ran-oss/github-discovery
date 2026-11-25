import { Icon } from "../icons"

/** 底部操作条：主按钮一个（蓝），其余是中性按钮 */
export function InsightActions({ fullName, saved, onSave, onCopyLink }: { fullName: string, saved: boolean, onSave: () => void, onCopyLink: () => void }) {
  return (
    <div className="ins-actions">
      <a className="act primary" href={`https://github.com/${fullName}`} target="_blank" rel="noreferrer">
        <Icon name="github" />
        在 GitHub 打开
      </a>
      <button type="button" className={`act ${saved ? "on" : ""}`} onClick={onSave} aria-pressed={saved}>
        <Icon name="bookmark" />
        {saved ? "已收藏" : "收藏"}
      </button>
      <button type="button" className="act icon-only" onClick={onCopyLink} aria-label="复制这个项目的链接" title="复制链接">
        <Icon name="link" />
      </button>
    </div>
  )
}
