import { type DiscoverySnapshot, type Period, type Repository, compact, isBreakout } from "@shared/discovery"
import { time } from "./detail"
import { Icon, RepoIcon } from "./icons"
import { labels, languageColors } from "./row"

interface Props {
  data: DiscoverySnapshot | undefined
  period: Period
  language: string
  onLanguage: (language: string) => void
  onOpen: (repo: Repository) => void
}

/** 右侧栏在没有选中项目时的内容：本期概况、爆发项目、语言分布与数据说明。 */
export function Overview({ data, period, language, onLanguage, onOpen }: Props) {
  const rows = data?.periods[period] || []
  const breakout = rows.filter(r => isBreakout(r, period)).slice(0, 5)
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r.language, (counts.get(r.language) || 0) + 1)
  const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 8)
  return (
    <div className="overview">
      <section>
        <h3>{`${labels[period]}概况`}</h3>
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
            <dd>{rows.filter(r => isBreakout(r, period)).length}</dd>
          </div>
        </dl>
        <p className="hint">
          <Icon name="clock" />
          {data ? `更新于 ${time(data.status[period].capturedAt)} · 每日 08:20 采集` : "正在读取榜单…"}
        </p>
      </section>
      {breakout.length > 0 && (
        <section>
          <h3>
            <Icon name="flame" />
            刚冒头的项目
          </h3>
          <ul className="mini">
            {breakout.map(r => (
              <li key={r.fullName}>
                <button type="button" onClick={() => onOpen(r)}>
                  <RepoIcon fullName={r.fullName} />
                  <span>{r.fullName.split("/")[1]}</span>
                  <b>{`+${compact(r.periodStars ?? 0)}`}</b>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {top.length > 0 && (
        <section>
          <h3>语言分布</h3>
          <div className="lang-chips">
            {top.map(([l, n]) => (
              <button key={l} type="button" aria-pressed={language === l} onClick={() => onLanguage(language === l ? "" : l)}>
                <i style={{ backgroundColor: languageColors[l] || "#9b8ca9" }} />
                {l}
                <span className="n">{n}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      <section>
        <h3>快捷键</h3>
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
      </section>
    </div>
  )
}

/** 数据来源说明：放在榜单底部，所有屏幕都能看到。 */
export function DataNote({ aiConfigured }: { aiConfigured?: boolean }) {
  return (
    <aside id="data-note" className="data-note">
      <h3>关于数据</h3>
      <p>
        排名与 Star 增量来自 GitHub Trending，每天北京时间 08:20 采集一次；「刷新」只读取已发布的快照。总榜之后依次补充「语言榜」（各语言自己的 Trending 榜）和「新项目」（GitHub 搜索到的近期新建、Star 涨得快的项目，没有周期增量）。
      </p>
      <p>
        中文内容会标注来源：GithubTrending 中文速览、按公开资料整理、README 解读，或只翻译简介的「机翻」。
        {aiConfigured === false && "当前未配置独立 AI 服务，缺少的深度解读不会用模板内容代替。"}
        「爆发」表示周期新增 Star 占总数的比例和增量都很高。收藏仅保存在当前浏览器。
      </p>
    </aside>
  )
}
