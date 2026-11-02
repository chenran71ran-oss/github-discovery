<div align="center">

<img src="public/icon.svg" width="88" alt="GIT Bot">

# GIT Bot · GitHub Discovery

**用中文发现 GitHub 上正在升温的开源项目，不只是 AI，还有工具和生活类项目。**

[在线访问](https://radar.chenran71ran.cc/) · [功能](#功能) · [数据从哪来](#数据从哪来) · [GIT Bot 分类](#git-bot-分类) · [本地运行](#本地运行) · [配置](#配置) · [部署](#部署) · [目录与架构](#目录与架构)

</div>

## 简介

GIT Bot 每天汇总 GitHub 上的热门与新兴项目，按日榜、周榜、月榜展示，给每个项目配上中文简介、分类和来源标注，帮你快速判断它能做什么、值不值得一试。

整个站点是纯静态的：GitHub Actions 每天把数据采集成 JSON，前端直接读取同源文件，不需要数据库或后端服务。

项目基于 [NewsNow](https://github.com/newsnext/newsnow)（MIT）二次开发，复用 [GithubTrending](https://github.com/Ibook000/GithubTrending)（Apache-2.0）的榜单解析器，详见 [UPSTREAM.md](UPSTREAM.md)。

## 当前状态

*核对于 2026-11-02*

- **已上线**：[radar.chenran71ran.cc](https://radar.chenran71ran.cc/)，Cloudflare Pages 从 `main` 自动部署；机器人的每日数据提交也会触发重新部署（约 1 分钟后完成）。
- **每日采集**：2026-10-27 起每天都成功运行，历史快照从 2026-10-26 开始，共 8 天。
- **最近一次旧流程采集**（2026-11-02 14:27）：日榜 149、周榜 157、月榜 168，去重后 397 个项目，其中 331 个有中文简介（83%）：机器翻译 302、上游中文速览 21、资料整理 8，其余 66 个显示原始简介。
- **新流程**：GIT Bot 分类引擎与分类搜索流已在 #9 合入，首次完整运行（Actions 第 10 次）正在进行；在它完成之前，线上数据还是旧的 9 类分类，页面会把旧分类映射到新体系后显示。
- **未配置模型**：目前没有配置 `LLM_*` 密钥，所以没有 README 解读；中文简介来自上游速览、资料整理和机器翻译，页面都有标注。
- **已知问题**：Cloudflare 上保留用于回滚的旧采集 Worker（`github-discovery-collector`）仍关联本仓库，每次提交都会构建失败。不影响网站，可以在 Cloudflare 控制台断开它的 Git 关联。

## 功能

**浏览**
- 日榜 / 周榜 / 月榜单列排行，名次从上往下读；可选历史日期，查看过去的快照。
- 每行包含名次、项目图标、两行中文简介、语言、Star、分类、名次变化和周期新增 Star。
- 「爆发」标记：周期新增 Star 占总数的比例与绝对增量都很高的项目。
- 宽屏点击某行，项目解读显示在右侧栏，不遮挡列表；手机上改为贴底面板，向下拖可关闭。

**筛选**
- 中文搜索（`/` 或 `⌘K`），可以搜项目名、简介、用途、技术栈、分类和 GitHub 主题。
- 两级分类：先选领域（开发 / 工具 / 生活 / 学习），再选细类；细类自动换行，不需要横向滑动。
- 按编程语言筛选；按榜单名次、周期新增或总 Star 排序。
- 周期、筛选条件和选中的项目都会写进网址，可以直接分享。

**理解项目**
- 中文简介都标注来源：README 解读、上游中文速览、资料整理或「机翻」。
- 「GIT Bot 分类」卡片：领域与主分类、次要标签、置信度、判断依据、用途、GitHub 主题。

**日常使用**
- 收藏保存在当前浏览器，不需要账号，不会同步到 GitHub Star。
- 快捷键：`J` / `K` 上下切换项目，`S` 收藏，`Esc` 关闭。
- 液态玻璃风格的悬浮栏，滑动时收起、停下后弹回；10 套配色，也可以跟随系统深浅色。
- 适配 iPhone：安全区避让，可以添加到主屏幕；支持系统的「减弱动态效果」和「降低透明度」。

界面细节见 [docs/DISCOVERY-UI.md](docs/DISCOVERY-UI.md)。

## 数据从哪来

采集器 `python -m collector run` 为每个周期从三类来源取数，按仓库去重后依次排列：

| 来源 | 内容 | 页面标签 |
| :--- | :--- | :--- |
| GitHub Trending 总榜 | 全语言 Trending 的完整列表，保留原始名次与周期新增 Star | — |
| 语言榜 | 12 种语言（Python、TypeScript、JavaScript、Go、Rust、Java、C++、C、C#、Swift、Kotlin、PHP）各自的 Trending，每种最多取 5 个总榜没有的项目 | 语言榜 |
| GitHub 搜索 | 总体流：近期新建、Star 增长快的项目（日榜近 7 天、周榜近 30 天、月榜近 90 天）。分类流：按每个分类的 GitHub 主题搜索近期新项目，共 28 个，需要 token | 新项目 |

GitHub Trending 每页只列出约 8–20 个项目，而且大多是 AI 项目，所以语言榜和搜索是主要的补充；分类流专门补上工具类、生活类等很少登上总榜的项目。

为了分类，采集器还会读取：
- **仓库主题**：Trending 页面不显示主题，有 token 时通过 REST 补全，缓存 3 天。
- **README 开头**：只用作分类信号，不发布原文；摘要缓存在 `public/data/feature-cache.json`，14 天刷新一次。

**中文简介**按可信程度依次选用：

1. 配置了模型时，经过校验的 README 解读（`ai-readme`）
2. GithubTrending 每天发布的中文速览，只接受 7 天内的（`upstream`）
3. 有来源记录的资料整理，简介变化后不再沿用（`editorial`）
4. 只翻译项目自己简介的机器翻译，页面标为「机翻」（`machine`）

都没有时显示原始英文简介。机器翻译按简介哈希缓存，同一段简介只翻译一次。

**失败处理**：任何一个来源失败都只跳过它本身；某个周期的总榜抓不到时，保留该周期上一次的完整榜单并在页面上标出；第一次采集就失败时直接报错，不会发布空站。

## GIT Bot 分类

分类体系有 4 个领域、23 个细类，外加「其他」：

| 领域 | 细类 |
| :--- | :--- |
| 开发 | AI 与智能体、开发工具、前端与界面、后端与 API、数据与基础设施、安全与隐私、移动与桌面、游戏与图形 |
| 工具 | 效率与办公、命令行与系统、音视频与图像、浏览器与插件、自托管、自动化与爬虫 |
| 生活 | 理财与金融、健康与运动、影音娱乐、游戏、智能家居与硬件、社交与通讯、出行与生活 |
| 学习 | 教程与资源、科研与论文 |

分类体系只有一份 `shared/taxonomy.json`，前端与采集器共用。分类引擎综合 GitHub 主题、简介关键词、README、编程语言和技术栈五类信号；配置了模型时，经过校验的 README 解读也作为一项信号。判断时**用途优先**：「AI 修图工具」归到音视频与图像、带上 AI 标签，而不是反过来。

每条结果都附带次要标签（最多 2 个）、置信度和判断依据（例如「主题 self-hosted」「关键词 budget」），在项目详情里可以看到。

**准确率**：在 60 个人工标注、未参与调参的真实仓库上，旧的关键词规则为 28%，新引擎的主分类为 53%，主分类或次要标签命中为 72%。很多项目本来就跨类，所以界面同时展示次要标签和依据，分错了也看得出原因。评估方法、调参规则与修改分类的步骤见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 本地运行

需要 Node.js 24、pnpm 10.30.3；采集另需 Python 3.11+。

```bash
corepack pnpm install --frozen-lockfile
pnpm dev
```

仓库里已有采集好的 JSON 数据，可以直接打开前端，不需要数据库或密钥。`pnpm dev` 默认是静态数据模式；`pnpm dev:full` 会启动保留的 NewsNow 后端。

```bash
pnpm build:preview          # 纯静态构建，产物在 dist/（生产环境使用）
CF_PAGES=1 pnpm build       # 保留 NewsNow Nitro 后端的构建
pnpm typecheck              # 完整类型检查，需先构建以生成自动导入声明
pnpm exec vitest run shared/discovery.test.ts
```

采集器：

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r collector/requirements.txt

python -m collector run                 # 采集、中文增强、分类、发布到 public/data/
python -m collector classify            # 不重新抓榜，只用当前分类体系重新分类最新快照
python -m collector evaluate --readme   # 在人工标注集上比较分类策略
python -m unittest discover -s collector -p 'test_*.py'
```

也可以用 `pnpm collect`、`pnpm classify`、`pnpm evaluate`。没有 token 时只运行总体搜索流，不补仓库主题；本地访问 GitHub Trending 页面失败时，会保留上一次的榜单。

## 配置

都通过环境变量传给采集器；在 GitHub Actions 里，密钥放 Secrets，其余放 Variables。都是可选的。

| 变量 | 作用 |
| :--- | :--- |
| `GITHUB_TOKEN` | 开启 28 个分类搜索流，补全仓库主题。Actions 自动提供 |
| `LLM_BASE_URL`、`LLM_MODEL`、`LLM_API_KEY` | 支持 OpenAI Chat Completions 格式的 HTTPS 接口。三项都配置后，读取 README 生成中文简介、适用场景、技术栈、亮点与分类；校验失败不会覆盖已有内容。密钥只用于采集，不会写进前端或 JSON |
| `MYMEMORY_EMAIL` | 机器翻译的每日额度从约 5,000 字符提高到约 50,000 字符 |
| `MACHINE_TRANSLATION` | 设为 `0` 关闭机器翻译 |
| `README_SIGNALS` | 设为 `0` 不读取 README 作为分类信号 |
| `CLASSIFIER_STRATEGY` | 分类策略，可选 `full`（默认）、`flat`、`topics`、`keywords`，见 `collector/lab/strategies.py` |
| `LOG_LEVEL` | 日志级别，默认 `INFO` |
| `DISCOVERY_DATA_DIR` | 数据目录，默认 `public/data` |

## 自动采集

`.github/workflows/discovery-collect.yml` 在 `main` 上运行：计划每天 00:20 UTC（北京时间 08:20）触发，也可以在 Actions 页面手动运行（Run workflow）。

GitHub 的定时任务经常延后，过去一周实际都在北京时间 13:00–14:30 之间才开始，页面上的更新时间以数据里记录的为准。

每次运行依次是：运行采集器 → 运行采集测试 → 测试通过后把 `public/data/` 的变化提交到 `main`。Cloudflare Pages 检测到新提交后会重新部署。超时 30 分钟。

## 部署

生产环境是 Cloudflare Pages 项目 `github-discovery`，生产分支为 `main`，域名 [radar.chenran71ran.cc](https://radar.chenran71ran.cc/)。每个 PR 会得到独立的预览地址。

| 配置项 | 值 |
| :--- | :--- |
| 构建命令 | `npx --yes pnpm@10.30.3 install --frozen-lockfile && npm run build:preview` |
| 输出目录 | `dist` |
| 根目录 | 仓库根目录 |
| Node 版本 | `24` |
| 数据库 / API 密钥 | 不需要 |

前端与 JSON 同源部署，不依赖跨域代理、Worker 或数据库。

如果要保留 NewsNow 的其他实时聚合源，使用 `CF_PAGES=1 npm run build`、输出 `dist/output/public`，并按 NewsNow 原说明配置 Nitro / D1、`nodejs_compat` 与兼容日期。这条路径只做过本地构建验证，没有部署到生产。

### 上线基线与回滚

- 2026-10-26 北京时间 21:13，生产部署 `27d3d4d9-2f6c-4002-99a0-0392e09c0220` 首次上线新版。之后的改版都经 PR 合入 `main` 发布（#4 液态玻璃、#5 改版、#6 采集扩容、#8 界面重构、#9 分类引擎与悬浮栏）。
- 旧版源码保留在分支 [backup/radar-before-newsnow-20261026](https://github.com/chenran71ran-oss/github-discovery/tree/backup/radar-before-newsnow-20261026)（提交 `50ab15a`），旧生产部署 `39e3297c-d641-4b26-9068-8293bd02c93c` 仍保留。
- 回滚优先在 Pages 的部署列表里对目标部署执行 Rollback，不需要删除数据库或重新绑定域名。旧 D1 与采集 Worker 保留用于回滚，新页面不读取它们。

## 目录与架构

```
shared/                 数据契约 discovery.ts、分类体系 taxonomy.json / taxonomy.ts（前端与采集器共用）
src/components/discovery/
  api.ts                唯一读写网络与浏览器存储的地方
  model.ts              筛选、排序、统计（纯函数）
  *.tsx、style.css      界面组件与样式
collector/
  core/                 第 1 层：类型、静态配置、分类体系加载
  blocks/               第 2 层：抓取器、分类信号、翻译、模型等积木
  lab/                  第 3 层：分类策略、采集流水线、标注集与评估
  app/                  第 4 层：环境配置、日志、阶段计时、发布、命令行
  vendor/               GithubTrending 原解析器（Apache-2.0，未修改）
public/data/            已发布的榜单、历史快照与缓存
server/                 保留的 NewsNow Nitro 聚合后端（生产未使用）
docs/                   架构、界面约定与上游原说明
```

采集器与前端都按「类型与配置 → 积木 → 实验 → 外交」四层组织，下层不依赖上层。详见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 开发约定

从 `main` 开分支（`feat/`、`fix/`、`chore/`），经 PR 和 CI 检查后合并；功能 PR 不提交数据文件。合并前检查、模块边界与改分类的规则见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 还没有做的

- 独立的 Rising 排名算法
- 跨设备同步收藏
- 推送订阅

## 来源与许可

见 [UPSTREAM.md](UPSTREAM.md)。NewsNow 的 MIT 许可（根目录 `LICENSE`）与 GithubTrending 的 Apache-2.0 许可（`collector/vendor/LICENSE`）都保留在仓库中。本项目是源码引入与二次开发，不是 GitHub 平台上的正式 Fork，也不代表上游认可本项目。NewsNow 原说明及其中、日文译本保留在 `docs/NEWSNOW-README*.md`。
