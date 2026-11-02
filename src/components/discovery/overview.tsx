import type { CSSProperties } from "react"
import { type DiscoverySnapshot, type Period, type Repository, compact, isBreakout } from "@shared/discovery"
import { time } from "./detail"
import { Icon, RepoIcon } from "./icons"
import { distribution } from "./model"
import { categoryHues, labels } from "./row"
import { Section } from "./section"

interface Props {
  data: DiscoverySnapshot | undefined
  period: Period
  onOpen: (repo: Repository) => void
}

/** 右侧栏在没有选中项目时的内容：本期概况、GIT Bot 分类分布、刚冒头的项目与快捷键，每块各自一张小卡片。 */
export function Overview({ data, period, onOpen }: Props) {
  const rows = data?.periods[period] || []
  const breakouts = rows.filter(r => isBreakout(r, period))
  const spread = distribution(rows)
  const most = Math.max(1, ...spread.map(d => d.count))
  const status = data?.status[period]
  return (
    <div className="overview">
      <Section
        title={`${labels[period]}概况`}
        chip={status ? `${status.ok ? "已更新" : "沿用上次"} ${time(status.capturedAt)}` : "读取中"}
        tone={!status ? "neutral" : status.ok ? "ok" : "warn"}
      >
        <dl className="ins-stats three">
          <div>
            <dt>项目</dt>
            <dd>{rows.length || "—"}</dd>
          </div>
          <div>
            <dt>中文解读</dt>
            <dd>{data ? `${Math.round(data.enrichment.ready / Math.max(1, data.enrichment.total) * 100)}%` : "—"}</dd>
          </div>
          <div>
            <dt>爆发</dt>
            <dd>{breakouts.length}</dd>
          </div>
        </dl>
      </Section>
      {spread.length > 0 && (
        <Section title="GIT Bot 分类" icon={<Icon name="bot" />} chip="用途优先" tone="accent">
          <ul className="spread">
            {spread.map(d => (
              <li key={d.id}>
                <span className="sp-label">{d.label}</span>
                <i><b style={{ width: `${(d.count / most) * 100}%` }} /></i>
                <span className="n">{d.count}</span>
                <span className="sp-top">
                  {d.top.map(t => <em key={t.label} style={{ "--ch": categoryHues[t.label] ?? 210 } as CSSProperties}>{`${t.label} ${t.count}`}</em>)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {breakouts.length > 0 && (
        <Section title="刚冒头的项目" icon={<Icon name="flame" />} chip={breakouts.length > 5 ? `前 5 / ${breakouts.length}` : `${breakouts.length} 个`} tone="warn">
          <ul className="mini">
            {breakouts.slice(0, 5).map(r => (
              <li key={r.fullName}>
                <button type="button" onClick={() => onOpen(r)}>
                  <RepoIcon fullName={r.fullName} />
                  <span>{r.fullName.split("/")[1]}</span>
                  <b>{`+${compact(r.periodStars ?? 0)}`}</b>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="快捷键" chip="键盘">
        <p className="keys">
          <span>
            <kbd>J</kbd>
            <kbd>K</kbd>
            上下切换
          </span>
          <span>
            <kbd>S</kbd>
            收藏
          </span>
          <span>
            <kbd>/</kbd>
            搜索
          </span>
          <span>
            <kbd>Esc</kbd>
            关闭
          </span>
        </p>
      </Section>
    </div>
  )
}

/** 数据来源说明：放在榜单底部，所有屏幕都能看到。 */
export function DataNote({ aiConfigured }: { aiConfigured?: boolean }) {
  return (
    <aside id="data-note" className="data-note">
      <h3>关于数据</h3>
      <p>
        排名与 Star 增量来自 GitHub Trending，每天采集一次，页面读取的是已发布的快照；更新时间以页面上显示的为准。总榜之后依次补充「语言榜」（各语言自己的 Trending 榜）和「新项目」（GitHub 搜索到的近期新建、Star 涨得快的项目，包括按每个分类的 GitHub 主题搜到的工具类、生活类项目；这类项目没有周期增量）。分类由 GIT Bot 根据 GitHub 主题、简介、README、语言和技术栈判断，项目详情里列出依据，可能分错。
      </p>
      <p>
        中文内容会标注来源：GithubTrending 中文速览、按公开资料整理、README 解读，或只翻译简介的「机翻」。
        {aiConfigured === false && "当前未配置独立 AI 服务，缺少的深度解读不会用模板内容代替。"}
        「爆发」表示周期新增 Star 占总数的比例和增量都很高。收藏仅保存在当前浏览器。
      </p>
    </aside>
  )
}
