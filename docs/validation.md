# 验证记录 — v0.1

## 已通过

- `npm run check`：Astro 16 个源文件，0 错误／警告；采集 Worker TypeScript 校验通过。
- `npm test`：11 项测试全部通过。覆盖跨周期成员保留、日期＋周期＋语言＋分类＋搜索、快照事务回滚、24h 样本和积累状态、HTML 解析、备用 JSON 格式与旧数据拒绝、AI JSON 校验、非法日期、采集部分失败保留旧榜、数据库任务互斥、手动触发鉴权。
- `npm run build`：生产 SSR 与客户端构建通过，客户端 JS gzip 约 18.9 kB。
- `wrangler deploy --config worker/wrangler.jsonc --dry-run`：采集 Worker 打包通过，D1 / AI 绑定解析正确。
- 编译后的前端直接在 Miniflare / workerd 运行：首页 SSR、仓库详情页面、仓库详情 API、联合筛选 API、Rising API、无效查询返回 400 全部通过。
- 本地 D1 迁移、演示数据导入、前后端共用 DB 绑定已验证。
- 用户提供的 D1 ID 已写入前端和采集器配置，采集器重新执行 Wrangler dry-run 通过；此检查不代表远程数据库权限或表结构已验证。

## 修复的运行时问题

Cloudflare 的 Node process v2 与 Astro 5 SSR 存在兼容问题，可能造成页面仅输出 `[object Object]`。根目录 `wrangler.jsonc` 增加 `disable_nodejs_process_v2`，运行时检查确认页面输出完整 HTML。采集 Worker 不需要该 SSR 兼容设置。

## 线上部署证据（2026-10-11）

|      项目      | 已确认的证据                                         | 尚待确认                               |
| :------------: | :--------------------------------------------------- | :------------------------------------- |
|     Pages      | Cloudflare 成功页面显示 `github-discovery.pages.dev` | 浏览器完整交互与布局                   |
|       D1       | Studio 显示五张 `discovery_` 表                      | 真实采集写入结果                       |
| 前端数据库查询 | `/api/status` 返回 `{"jobs":[]}`                     | 采集后的任务和榜单展示                 |
|  采集 Worker   | 构建日志显示部署成功，绑定 DB、AI，发布两条 Cron     | Cron 实际采集、GitHub 请求、AI 输出    |
|   自定义域名   | Pages 已添加 `radar.chenran71ran.cc`                 | 最后截图为 Initializing，未确认 Active |

以上来自维护者提供的 Cloudflare 截图与状态接口结果。当前环境直接请求 Pages 收到 HTTP 403，不能据此认定用户侧站点异常，也不能声称已完成独立线上验收。

## 尚未完成的验证

- 浏览器二进制下载未成功，未完成自动化浏览器点击、视觉布局及手机／电脑截图验证。
- 未确认首次真实榜单采集、Workers AI 摘要、账户配额和 Rising 样本积累。
- 离线演示与本地测试不能代替线上真实数据验收。

## 演示页

`GitHub-Discovery-preview.html` 是自包含文件，使用明确标注的本地演示数据。模拟接口基于本地 D1 的输出，所有 JS / CSS 内嵌，不调用线上 AI。源码中的生产接口仍读取真实 D1。收藏保存在打开演示文件的浏览器内。

## 可复现方式

参照[完整指南](guide.md) 执行本地初始化和演示 seed 后构建。浏览器正常的环境可以打开本地生产预览检查交互；没有演示 seed 的全新数据库会显示等待采集。

## 2026-10-12 中文摘要修复

线上 `/api/status` 读取结果：最近五次任务 summarized 均为 0，其中一次采集 published=3。已确认采集在运行，但旧实现将摘要失败吞掉并记为 success；未取得线上 AI 原始响应，不能断言全部失败均由同一个原因造成。

新增回归覆盖：聊天补全响应写入真实本地 D1 后能被中文查询读出；旧 response 格式兼容；截断与纯英文摘要拒绝；失败任务记录原因；冷却后可重试成功。AI 调用使用模拟响应，不代表生产 Workers AI 已生成成功。线上需要两端部署后以 summarized>0、ready 数量和真实卡片验证。

本次本地验证结果：14 项测试通过；Astro/Worker 类型检查、前端构建、Worker 部署 dry-run 与编译后 SSR/D1/API 运行时验证通过。未调用生产 Workers AI，也未修改生产 D1。

## 2026-10-12 第二轮：JSON 对象响应与 README 备用源

线上诊断记录显示 ready=2、failed=36，任务出现 AI_OUTPUT_INVALID 和 README_UNAVAILABLE。核对 Cloudflare JSON Mode 官方文档，确认合法返回可以是 `response: { ... }` 对象；原提取器只接受字符串。回归复现对象响应导致五个仓库摘要全部失败，修复后五个仓库均写入 D1，并能通过前端查询读取。

新增 README API 403 时使用公开 `raw.githubusercontent.com/<owner>/<repo>/HEAD/README.md` 的测试，确认 GitHub Token 不传给备用源。HEAD 跟随默认分支；非标准 README 路径仍需 GitHub API。此备用源不能保证所有仓库获取成功。

增加独立输出诊断：截断、空内容、JSON 无效、字段结构无效、非中文。仍保留严格校验与小时级重试，不把编造的中文内容写入数据库。未获得生产 AI 原始输出，因此对象兼容问题已确认可复现，但不能解释所有线上失败。需自动部署后继续依据真实任务结果验收。

第二轮本地结果：18 项测试通过；类型检查、前端构建、Worker 部署 dry-run 通过。生产 AI 成功率尚待新版定时任务验证。
