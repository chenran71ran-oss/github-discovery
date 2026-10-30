<div align="center">

<img src="public/icon.svg" width="96" alt="GIT Bot">

# GIT Bot

**用中文发现 GitHub 上正在升温的开源项目。**

简体中文 · [English](README.en.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko.md)

[在线访问](https://radar.chenran71ran.cc/) · [功能](#功能) · [数据从哪来](#数据从哪来) · [本地运行](#本地运行) · [配置密钥](#配置密钥) · [部署](#部署) · [开发约定](#开发约定)

</div>

## 简介

GIT Bot 每天汇总 GitHub 上的热门和新兴项目，按日榜、周榜、月榜展示，并给每个项目配上中文简介、分类和来源标注，让你快速判断它能做什么、值不值得一试。

整个站点是纯静态的：数据由 GitHub Actions 每天采集成 JSON，前端直接读取同源文件，不需要数据库，也不需要后端服务。

项目基于 [NewsNow](https://github.com/newsnext/newsnow)（MIT）二次开发，复用 [GithubTrending](https://github.com/Ibook000/GithubTrending)（Apache-2.0）的榜单解析器，详见 [UPSTREAM.md](UPSTREAM.md)。

## 功能

**浏览**
- 日榜 / 周榜 / 月榜，可选历史日期，查看过去的快照。
- 两种布局：按名次排列的卡片列表，或按用途分栏。
- 每个项目一张圆角玻璃卡：项目图标、名次与排名变化、中文简介、语言、Star、周期新增。
- 「爆发」标记：周期新增 Star 占总数的比例和绝对增量都很高的项目。

**筛选**
- 中文搜索（⌘K / Ctrl K），可以搜项目名、简介、用途、技术栈。
- 9 个分类：AI 与智能体、开发工具、前端与界面、自托管、数据与基础设施、安全与隐私、移动与桌面、学习与研究、其他。
- 按编程语言筛选；按榜单名次、总 Star 或周期新增排序。
- 周期、搜索词、语言、分类、日期都会写进网址，可以直接分享。

**外观与手机**
- 液态玻璃风格，10 套配色（6 深 4 浅），也可以跟随系统深浅色。
- 为 iPhone 适配：悬浮底栏、贴底弹出面板、安全区避让；可以添加到主屏幕当作应用使用。
- 支持系统的「减弱动态效果」和「降低透明度」设置。

**收藏**
- 收藏保存在当前浏览器，不需要账号，不会同步到 GitHub Star。

## 数据从哪来

采集脚本 `collector/collect.py` 每天北京时间 08:20 运行，每个周期从三类来源取数，按仓库去重后依次排列：

| 来源 | 内容 | 页面标签 |
| :--- | :--- | :--- |
| GitHub Trending 总榜 | 全语言 Trending 的完整列表，保留原始名次和周期新增 Star | — |
| 语言榜 | 12 种语言（Python、TypeScript、JavaScript、Go、Rust、Java、C++、C、C#、Swift、Kotlin、PHP）各自的 Trending，每种最多取 5 个总榜没有的项目 | 语言榜 |
| GitHub 搜索 | 日榜取近 7 天、周榜近 30 天、月榜近 90 天内新建、Star 增长快的项目：总体前 30 个，加上 8 个主题各最多 8 个 | 新项目 |

GitHub Trending 现在每页只列出约 8–20 个项目，所以另外两类来源是主要的补充。2026-10-30 的一次采集为：日榜 141、周榜 150、月榜 166 个，去重后共 385 个项目。

分类根据项目名、简介和 GitHub 主题标签的关键词打分得出；配置了 AI 解读后，以经过校验的 AI 结果为准。

任何一个来源失败都只会跳过它本身。如果某个周期的总榜抓不到，就保留该周期上一次的完整榜单，并在页面上标出时间；第一次采集就失败时直接报错，不会发布空站。

### 中文内容

每个项目的中文简介按以下顺序取第一个可用的，页面上都会标明来源：

| 顺序 | 来源 | 页面标签 |
| :--- | :--- | :--- |
| 1 | 读取 README 后由 AI 生成，并经过格式校验（需配置 `LLM_*`） | README 解读 |
| 2 | GithubTrending 发布的中文速览（7 天内） | 中文速览 |
| 3 | 按项目公开简介整理的首批资料（`collector/editorial.json`），简介变化后不再沿用 | 资料速览 |
| 4 | 用 MyMemory 免费接口机器翻译项目自己的简介 | 机器翻译 |
| 5 | 都没有时显示原文 | 解读待补充 |

机器翻译按简介的哈希缓存在 `public/data/translation-cache.json`，同一段简介只翻译一次，也不会覆盖前三种来源。不会用模板文字冒充 AI 分析。

## 本地运行

需要 Node.js 24、pnpm 10.30.3；运行采集还需要 Python 3.12。

```bash
corepack pnpm install --frozen-lockfile
pnpm dev                 # 静态数据模式，直接读取 public/data/ 里的 JSON
```

仓库里已有采集好的数据，打开前端不需要数据库或任何密钥。

```bash
pnpm build:preview       # 纯静态构建，产物在 dist/
pnpm typecheck           # 类型检查（需先构建一次，生成自动导入声明）
pnpm exec vitest run shared/discovery.test.ts
```

运行采集：

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r collector/requirements.txt
export GITHUB_TOKEN=你的个人令牌   # 可选；不设置时搜索每个周期只做一次总体查询
python collector/collect.py
python -m unittest discover -s collector -p 'test_*.py'
```

> 本地采集会改写 `public/data/`。这个目录只由每天的采集机器人提交，测试完请用 `git restore public/data && git clean -fd public/data` 还原。

## 配置密钥

采集在 GitHub Actions 里运行，所以密钥要加在 **GitHub 仓库** 的 Settings → Secrets and variables → Actions 中，不是 Cloudflare。全部是可选的：

| 名称 | 作用 |
| :--- | :--- |
| `LLM_BASE_URL` | 兼容 OpenAI Chat Completions 的 HTTPS 接口地址 |
| `LLM_MODEL` | 模型标识 |
| `LLM_API_KEY` | 模型服务的密钥 |
| `MYMEMORY_EMAIL` | 机器翻译的联系邮箱，把每天的免费额度从 5,000 字符提高到 50,000 字符 |

三个 `LLM_*` 都配置后，会读取 README 生成中文简介、适用场景、技术栈、亮点和分类；请求或校验失败时保留原有内容。密钥不会写进前端或数据文件。

搜索用的 `GITHUB_TOKEN` 由 GitHub Actions 自动提供，不需要手动添加。

## 部署

生产环境部署在 Cloudflare Pages，项目名 `github-discovery`，生产分支 `main`。

| 配置项 | 值 |
| :--- | :--- |
| 构建命令 | `npx --yes pnpm@10.30.3 install --frozen-lockfile && npm run build:preview` |
| 输出目录 | `dist` |
| Node 版本 | `24` |
| 数据库 / 环境变量 | 不需要 |

采集机器人每天把新数据提交到 `main` 后，Cloudflare 会重新构建。页面上的「刷新」只重新读取已发布的数据，不会触发采集。

仓库保留了 NewsNow 原有的 Nitro 后端（`server/`），需要时可以用 `CF_PAGES=1 npm run build` 构建完整版本，配置方法见 [NewsNow 原说明](docs/NEWSNOW-README.md)。生产环境目前不使用它。

## 目录

| 路径 | 内容 |
| :--- | :--- |
| `src/components/discovery/` | 首页：卡片、筛选、配色、详情、样式 |
| `shared/discovery.ts` | 前端和采集共用的数据格式、筛选与校验 |
| `collector/` | 采集、分类、中文内容、测试，以及上游解析器 |
| `public/data/` | 最新榜单、历史快照、AI 与翻译缓存 |
| `.github/workflows/` | 每日采集与 CI 检查 |
| `server/` | 保留的 NewsNow Nitro 后端 |

## 开发约定

- `main` 是生产基线。新功能用 `feat/<模块>` 分支，修复用 `fix/<问题>`，维护用 `chore/<任务>`，经 PR 和 CI 通过后合并。详见 [CONTRIBUTING.md](CONTRIBUTING.md)。
- CI（Discovery checks）会依次运行：完整构建、类型检查、数据格式测试、采集器测试、静态构建，并上传 `discovery-static-preview` 预览产物。
- 数据格式集中在 `shared/discovery.ts`。改字段时，要同时更新采集输出、校验、前端读取和测试。
- 只有采集机器人可以直接向 `main` 提交 `public/data/**`。

**回滚**：改版前的旧版源码保留在 [`backup/radar-before-newsnow-20261026`](https://github.com/chenran71ran-oss/github-discovery/tree/backup/radar-before-newsnow-20261026) 分支。需要回滚时，优先在 Cloudflare Pages 的部署列表里对旧部署执行 Rollback，不需要改数据库或域名。

## 来源与许可

- [NewsNow](https://github.com/newsnext/newsnow)：MIT，许可原文见 [LICENSE](LICENSE)。
- [GithubTrending](https://github.com/Ibook000/GithubTrending)：Apache-2.0，许可原文见 [collector/vendor/LICENSE](collector/vendor/LICENSE)，解析器未作修改。
- 改动说明见 [UPSTREAM.md](UPSTREAM.md)。本项目是引入源码后的二次开发，不是 GitHub 上的正式 Fork，也不代表上游认可本项目。
- 项目图标来自仓库所有者的 GitHub 头像；榜单数据来自 GitHub。
