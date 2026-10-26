<div align="center">

# 开源雷达 · GitHub Discovery

**从开源趋势到中文解读，找到下一个想动手的项目。**

基于 [NewsNow](https://github.com/newsnext/newsnow) 二次开发，整合 [GithubTrending](https://github.com/Ibook000/GithubTrending) 采集与中文速览。

[功能](#功能) · [本地运行](#本地运行) · [采集与中文解读](#采集与中文解读) · [Cloudflare 部署](#cloudflare-部署) · [来源与许可](UPSTREAM.md)

</div>

## 当前状态

这是 `codex/newsnow-discovery-preview` 独立验收版本。未替换原站域名、main 分支、D1 或 Worker。

已接入真实 GitHub Trending 日榜、周榜、月榜，首批数据日期为 2026-10-26：14 / 15 / 21 条，合计 40 个独立项目，均有中文简介。历史列表当前只有首日，后续采集会逐日积累。

README 深度解读的接口已经实现，但本预览**没有配置独立模型密钥**。首批中文内容由 GithubTrending 速览和有来源记录的资料整理组成，页面明确标注；没有用模板冒充 AI 分析。自动采集工作流已提供，预览分支本身不会启用 GitHub 默认分支的定时任务。

## 功能

| 发现项目 | 理解用途 | 日常使用 |
| :--- | :--- | :--- |
| 日 / 周 / 月真实排名 | 中文简介与来源标注 | 中文搜索与组合筛选 |
| 总 Star、周期新增、Fork | README 原文入口 | 本地收藏、卡片 / 列表 |
| 语言与用途分类 | 可选 README 结构化解读 | 深浅主题、手机适配 |
| 历史快照、昨日排名比较 | 缓存避免重复生成 | URL 保存周期、搜索与筛选 |

收藏保存在当前浏览器，不需要账号；不会自动同步 GitHub Star。初始分类来自关键词规则，配置模型后可由经过校验的 README 分析补充。尚未实现独立 Rising 算法、跨设备收藏和 GPT 推送。

## 本地运行

需要 Node.js 24、pnpm 10.30.3；采集另需 Python 3.11+。

```bash
corepack pnpm install --frozen-lockfile
pnpm dev
```

已有首批 JSON 数据，可直接打开前端，不需要数据库或密钥。

```bash
# 纯静态构建；产物 dist/
pnpm build:preview

# 保留 NewsNow Nitro 后端的 Cloudflare Pages 构建
CF_PAGES=1 pnpm build

# 完整类型检查前须先构建，生成自动导入声明及 Nitro 类型
pnpm typecheck
pnpm exec vitest run shared/discovery.test.ts
```

`pnpm dev` 默认启动静态数据模式。`pnpm dev:full` 启动保留的 NewsNow 后端；原有聚合页面仍在源码内，本次首页专注 GitHub 发现。

## 采集与中文解读

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r collector/requirements.txt
python collector/collect.py
python -m unittest discover -s collector -p 'test_*.py'
```

采集器直接读取 GitHub Trending，复用 GithubTrending 的解析器，并将每榜上限从默认 10 改为完整榜单。按仓库去重后统一补充简介，再生成 `public/data/latest.json`、`history/YYYY-MM-DD.json`、`dates.json` 和分析缓存。任一榜采集异常时保留该榜上次完整快照并标注时间；首次采集没有有效数据时直接失败，防止发布空站。

中文内容依次使用：经过校验的 README 分析缓存、七天内的上游中文速览、简介哈希匹配的资料整理。没有可用内容时明确显示待处理。`collector/editorial.json` 保存首批资料整理的依据和来源；简介变化后不会继续套用旧整理。

可选模型环境变量：

| 变量 | 用途 |
| :--- | :--- |
| `LLM_BASE_URL` | 支持 OpenAI Chat Completions 的 HTTPS 接口地址 |
| `LLM_MODEL` | 模型标识 |
| `LLM_API_KEY` | 密钥，仅配置于采集任务 Secrets |

配置后读取 README，输出中文简介、适用场景、技术栈与亮点；校验失败或模型请求失败不会覆盖已有有效内容。密钥不会写入前端或 JSON。不要求购买特定模型服务；暂未直连 Workers AI Binding。

`.github/workflows/discovery-collect.yml` 每日 00:20 UTC（北京时间 08:20）采集，在工作流所在分支提交数据。**GitHub schedule 仅在默认分支生效**；将来启用新版时，再把工作流合入默认分支并配置所需 Secrets。Actions 机器人提交通常不会触发其他 GitHub Actions，Cloudflare Git 集成的构建需在接入后验证。

## Cloudflare 部署

建议先创建独立测试 Pages 项目，连接本分支：

| 配置项 | 纯静态预览 |
| :--- | :--- |
| 构建命令 | `npx --yes pnpm@10.30.3 install --frozen-lockfile && npm run build:preview` |
| 输出目录 | `dist` |
| 根目录 | 仓库根目录 |
| Node 版本 | `24` |
| 数据库 / API 密钥 | 不需要 |

静态前端与 JSON 同源部署，读取不依赖跨域代理、Worker 在线状态或 D1。自动采集由 GitHub Actions 执行，更新后重新构建；页面“刷新”读取已发布快照，不会现场触发采集或模型。

若需要保留 NewsNow 其他实时聚合源，使用 `CF_PAGES=1 npm run build`、输出 `dist/output/public`，按 NewsNow 原说明配置 Nitro/D1、`nodejs_compat` 与兼容日期。这条完整后端路径已做本地构建验证，**尚未部署到用户 Cloudflare 账号**。现有生产 D1、Cron、域名配置未改动。

## 目录

- `src/components/discovery/`：发现首页与响应式样式。
- `shared/discovery.ts`：前后端共享数据契约、查询与校验。
- `collector/`：采集、中文增强、原解析器与许可。
- `public/data/`：可直接部署的榜单与历史快照。
- `server/`：保留的 NewsNow Nitro 聚合后端。

## 来源与许可

请阅读 [UPSTREAM.md](UPSTREAM.md)。NewsNow MIT 许可和 GithubTrending Apache-2.0 许可保留在仓库中。本分支是源码引入与二次开发，不冒充 GitHub 平台的正式 Fork 关系，也不宣称上游认可本项目。上游文档保留于 `docs/NEWSNOW-README.md`。
