# GitHub Discovery

基于 Softween Web Fork 的中文开源项目发现站，整合 Softween Mailer 采集 Worker。

## 已实现

- 今日／本周／本月原始榜单，保留跨周期重复出现的项目与名次。
- 历史日期、语言、用途分类、关键词、排序联合筛选。
- 中文 README 解读：用途、适用场景、技术栈、关注点；失败显示原始描述，后台重试。
- 桌面卡片／列表、移动单列、深浅色主题、项目详情与 Star 历史。
- 浏览器本地收藏、已读、隐藏已读、JSON 备份导入导出。
- Rising：独立 GitHub API 采样约 24 小时增长，仅覆盖本站跟踪的项目。
- 主抓取失败时尝试 isboyjc JSON；校验其发布时刻，拒绝超过 36 小时的旧数据。两者失败时保留上次成功榜单。
- D1 事务批量发布快照，单任务数据库锁，采集与摘要独立调度。

## 架构

一个仓库、两个部署：Astro SSR 前端与同域 API → D1；采集 Worker + Cron + Workers AI → D1。用户浏览网页不触发抓取或 AI 调用。

`shared/contracts.ts` 是公共数据定义与校验；`worker/` 负责采集与摘要；`src/` 负责查询与展示；`migrations/` 负责数据库。上游和许可证记录见 [来源记录](../UPSTREAM.md)。

## 本地运行

Node.js 22 或以上：

```bash
npm ci
npm run db:local
npm run seed -- --demo   # 可选，仅写入本地演示数据，页面会明确标注
npm run dev
```

不使用演示数据也可启动，页面显示等待首次采集。两个本地服务共用项目根目录 `.wrangler/state`。生产构建可用 `npx wrangler pages dev dist --persist-to .wrangler/state` 验证。

```bash
npm run check
npm test
npm run build
npx wrangler deploy --config worker/wrangler.jsonc --dry-run
```

## 在你的 Cloudflare 部署

1. Fork 或克隆 [本站仓库](https://github.com/chenran71ran-oss/github-discovery)。推荐使用[网页部署指南](deployment.md)，无需本地常驻服务。
2. 本站已配置 D1 `github-discovery-db`，ID `b4eb73ce-f62b-4168-99a4-8173e2482cc6`，前端和采集器共用此数据库。其他用户 Fork 时应创建自己的 D1，并同时替换根目录和 `worker/` 内的 `wrangler.jsonc`。
3. 登录 Wrangler，执行 `npm run db:remote` 初始化数据库。
4. 为采集 Worker 设置密钥：

```bash
npx wrangler secret put GITHUB_TOKEN --config worker/wrangler.jsonc
npx wrangler secret put TRIGGER_SECRET --config worker/wrangler.jsonc
npm run worker:deploy
```

`GITHUB_TOKEN` 仅访问公开仓库内容，不需要仓库写入权限；不要放在前端或提交到 Git。Token 可不设置，但会减小 metadata 采样数，较容易受匿名 API 限流。`TRIGGER_SECRET` 使用随机长字符串，用于手动触发。

5. Cloudflare Pages 连接你的 Fork。构建命令 `npm run build`，输出目录 `dist`，Node 版本 22。绑定同一 D1，绑定名 **DB**。也可先在 Pages 创建名为 `github-discovery` 的项目，然后执行 `npm run deploy`。
6. 采集 Worker 每 6 小时在 UTC 00:15 / 06:15 / 12:15 / 18:15 运行，对应北京时间 08:15 / 14:15 / 20:15 / 02:15。每小时 UTC 第 45 分钟仅补充摘要。页面历史日期以北京时间分组。
7. 初次部署可等待 Cron，也可对采集 Worker 的 `/trigger` 发起 POST，Authorization 为 `Bearer <TRIGGER_SECRET>`，JSON 为 `{"mode":"collect"}`。调用会等待任务完成；请保持连接，不要把长任务放入 HTTP `waitUntil`。`{"mode":"summarize"}` 只补摘要。该接口不放在公开前端。
8. 前端和采集器用各自的 workers.dev / pages.dev 地址运行即可。需要时，再在 Pages 中绑定你的子域名。

## 数据口径与边界

- `periodStars` 是 GitHub Trending 页面对应周期显示的新增值。
- Rising 只使用 API 计数器的两个实际样本，时间间隔 22–26 小时；界面显示实际小时数，不把周榜或月榜增量当成 24h 增长。
- 默认每轮 metadata 采样最多 24 个项目，含部分已离开榜单的历史项目。Rising 是跟踪集合排名，无法声称覆盖全 GitHub。可以修改预算，但先考虑 API 与 Workers 配额。
- Rising 指数：归一化 Star 增量 60%、增长率 30%、Fork 增量 10%，范围 0–100。它反映近期关注变化，不是质量评分。
- 摘要每小时默认最多补 6 个，README 哈希相同则复用，最多每 7 天检查一次；失败间隔至少 6 小时重试。模型名称在 Worker 配置中可替换，模型不可用时榜单仍可展示。
- 收藏不跨设备自动同步，可通过备份迁移。历史页使用历史榜单数值与最新项目解读，未实现历史摘要版本回放。
- 列表 API 缓存最多 60 秒；摘要补齐与新榜单可能在一分钟后显示。搜索范围为选定榜单或浏览器收藏。
- 尚未配置自动清理历史快照，长期运行可按需求增加保留策略。
- 本项目不复制 OmniTrends 的 AGPL 源码，也不直接复用 trendingrepos 的 Python 评分实现。

## 当前运行状态

截至 2026-10-11：Pages 与采集 Worker 已部署，D1 五张业务表已创建；部署日志确认采集器的 DB、AI 绑定及两条 Cron。前端状态接口返回 `{"jobs":[]}`，确认能够查询任务表，当时尚无任务记录。自定义域名已添加，最后截图状态为 Initializing。

首次真实采集、AI 摘要生成、域名 Active 状态和完整线上交互尚待验收。部署成功不等于全部运行链路已验证。见[验证记录](validation.md)。

## 运行时复现检查

本地执行演示 seed 和 `npm run build` 后，可运行 `node scripts/verify-runtime.mjs`。它使用独立的内存 D1 测试生产 SSR 与 API，并在项目根目录输出离线演示 HTML，不写入远程数据。

前端 Wrangler 配置包含 `disable_nodejs_process_v2`，用于避免 Astro 5 在 Cloudflare SSR 中错误识别 Node 环境而输出 `[object Object]`。请保留该配置。
