# 运维手册

给维护者看的运行状态、配置、采集、部署与回滚。项目介绍见根目录 [README](../README.md)，代码结构见 [ARCHITECTURE.md](ARCHITECTURE.md)。

## 当前状态

*核对于 2026-11-02*

- **已上线**：[radar.chenran71ran.cc](https://radar.chenran71ran.cc/)，Cloudflare Pages 从 `main` 自动部署；机器人的每日数据提交也会触发重新部署（约 1 分钟后完成）。
- **每日采集**：2026-10-27 起每天都成功运行，历史快照从 2026-10-26 开始。
- **最近一次旧流程采集**（2026-11-02 14:27）：日榜 149、周榜 157、月榜 168，去重后 397 个项目，其中 331 个有中文简介（83%）：机器翻译 302、上游中文速览 21、资料整理 8，其余 66 个显示原始简介。
- **新流程**：GIT Bot 分类引擎与分类搜索流已在 #9 合入，首次完整运行（Actions 第 10 次）由维护者手动触发。在新流程的数据发布之前，页面会把旧的 9 类分类映射到新体系后显示。
- **未配置模型**：没有配置 `LLM_*` 密钥，所以没有 README 解读；中文简介来自上游速览、资料整理和机器翻译，页面都有标注。
- **已知问题**：Cloudflare 上保留用于回滚的旧采集 Worker（`github-discovery-collector`）仍关联本仓库，每次提交都会构建失败。不影响网站，可以在 Cloudflare 控制台断开它的 Git 关联。

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

没有 token 时只运行总体搜索流，不补仓库主题。本地访问 GitHub Trending 页面失败时，会保留上一次的榜单。

## 自动采集

`.github/workflows/discovery-collect.yml` 在 `main` 上运行：计划每天 00:20 UTC（北京时间 08:20）触发，也可以在 Actions 页面手动运行（Run workflow）。

GitHub 的定时任务经常延后，2026-10-27 至 11-02 实际都在北京时间 13:00–14:30 之间才开始；页面上的更新时间以数据里记录的为准。

每次运行依次是：运行采集器 → 运行采集测试 → 测试通过后把 `public/data/` 的变化提交到 `main`。超时 30 分钟。运行日志最后一行是一段 JSON 汇总，包含各周期数量、中文覆盖、各分类数量和每个阶段的耗时。

采集失败时：任何一个来源失败都只跳过它本身；某个周期的总榜抓不到时，保留该周期上一次的完整榜单并在页面上标出；第一次采集就失败时直接报错，不会发布空站。

## 部署

生产环境是 Cloudflare Pages 项目 `github-discovery`，生产分支为 `main`。每个 PR 会得到独立的预览地址。

| 配置项 | 值 |
| :--- | :--- |
| 构建命令 | `npx --yes pnpm@10.30.3 install --frozen-lockfile && npm run build:preview` |
| 输出目录 | `dist` |
| 根目录 | 仓库根目录 |
| Node 版本 | `24` |
| 数据库 / API 密钥 | 不需要 |

前端与 JSON 同源部署，不依赖跨域代理、Worker 或数据库。

如果要保留 NewsNow 的其他实时聚合源，使用 `CF_PAGES=1 npm run build`、输出 `dist/output/public`，并按 NewsNow 原说明配置 Nitro / D1、`nodejs_compat` 与兼容日期。这条路径只做过本地构建验证，没有部署到生产。

## 上线基线与回滚

- 2026-10-26 北京时间 21:13，生产部署 `27d3d4d9-2f6c-4002-99a0-0392e09c0220` 首次上线新版。之后的改版都经 PR 合入 `main` 发布：#4 液态玻璃、#5 改版、#6 采集扩容、#8 界面重构、#9 分类引擎与悬浮栏。
- 旧版源码保留在分支 [backup/radar-before-newsnow-20261026](https://github.com/chenran71ran-oss/github-discovery/tree/backup/radar-before-newsnow-20261026)（提交 `50ab15a`），旧生产部署 `39e3297c-d641-4b26-9068-8293bd02c93c` 仍保留。
- 回滚优先在 Pages 的部署列表里对目标部署执行 Rollback，不需要删除数据库或重新绑定域名。旧 D1 与采集 Worker 保留用于回滚，新页面不读取它们。

## 发布验收

每次发布分别确认：构建成功、线上数据时间是最新的、各周期没有失败标记、中文覆盖与分类数量正常（看采集日志最后一行的汇总）。
