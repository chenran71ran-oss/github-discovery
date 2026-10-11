# Cloudflare 网页部署

本指南使用你自己的浏览器和 GitHub 集成，不需要本地运行服务。

仓库：`chenran71ran-oss/github-discovery`，分支：`main`。
数据库：`github-discovery-db`，ID：`b4eb73ce-f62b-4168-99a4-8173e2482cc6`。

## 1. 初始化数据库

打开 Cloudflare → D1 SQL Database → `github-discovery-db` → Console。

复制仓库 [`migrations/0001_discovery.sql`](../migrations/0001_discovery.sql) 的完整内容到 Console，然后点击 Execute。它只创建本站的五张表及索引，不会导入演示数据，也不会删除现有数据。若 Console 只允许单条语句，按分号分隔依次执行。

执行以下查询，结果应有五行：

```sql
SELECT name FROM sqlite_master
WHERE type = 'table' AND name LIKE 'discovery_%'
ORDER BY name;
```

应看到 `discovery_entries`、`discovery_jobs`、`discovery_metrics`、`discovery_repos`、`discovery_snapshots`。

## 2. 部署前端 Pages

Cloudflare → Workers & Pages → Create application → Pages → Connect to Git。选择本站仓库。

| 字段                       | 填写                  |
| -------------------------- | --------------------- |
| Project name               | `github-discovery`    |
| Production branch          | `main`                |
| Framework preset           | `Astro`               |
| Build command              | `npm run build`       |
| Build output directory     | `dist`                |
| Root directory             | 留空，使用仓库根目录  |
| Build environment variable | `NODE_VERSION` = `22` |

保存并部署。根目录 `wrangler.jsonc` 已声明 `DB` 与上述 D1 的绑定和所需兼容标志，以仓库配置为准。

打开生成的 Pages 地址以及 `/api/status`。首次采集前没有榜单是正常状态；数据库表结构未初始化或权限不足则会报错。

## 3. 部署采集 Worker

Cloudflare → Workers & Pages → Create application，连接同一个 GitHub 仓库，创建 Worker。

| 字段                           | 填写                                |
| ------------------------------ | ----------------------------------- |
| Worker name                    | `github-discovery-collector`        |
| Production branch              | `main`                              |
| Root directory                 | `worker`                            |
| Build command                  | `npm --prefix .. ci`                |
| Deploy command                 | `npm --prefix .. run worker:deploy` |
| Build environment variable     | `NODE_VERSION` = `22`               |
| Enable Preview builds          | 关闭                                |
| Protect with Cloudflare Access | 关闭                                |

采集器与前端属于同一仓库，依赖和 lockfile 在上一级，所以安装和部署命令明确使用父目录。Worker 的 Wrangler 配置位于 `worker/wrangler.jsonc`。

部署后检查运行时绑定：`DB` 指向上述 D1，Workers AI 绑定名为 `AI`。Cron 应有 `15 */6 * * *` 与 `45 * * * *`。

如果部署提示无权绑定 D1 或 Workers AI，检查 Cloudflare 构建使用的部署 Token 权限；只提供页面报错，不要把 Token 发到聊天或写入仓库。

在 Worker 的 Settings → Variables & Secrets 中配置运行时 Secret：

- `TRIGGER_SECRET`：自己设置随机长字符串，仅用于手动触发。未设置仍可执行 Cron，但 `/trigger` 不开放。
- `GITHUB_TOKEN`：可选，仅访问公开仓库数据，无需仓库写入权限。不设置时采样预算较小。

这些属于运行时 Secret，不能只添加到构建环境变量。配置后按页面提示发布新版本。

打开采集器根地址，应返回 `status: "ok"`。这只确认 Worker 能响应，数据库与 AI 的实际运行结果要结合 Cron 后的任务记录检查。等待下一次 Cron 后，前端应显示真实榜单。Rising 需要积累约 24 小时的 API 样本，中文摘要会按每轮预算逐步补齐。

## 4. 完成线上验证

将前端 Pages 地址和采集器 Worker 地址提供给维护者。检查 `/api/status`、日／周／月榜、联合筛选、数据库任务记录、采集来源和中文摘要，确认后在前端 Pages 的 Custom domains 中绑定自定义域名。本站入口为 `radar.chenran71ran.cc`；采集 Worker 不需要同步绑定域名。

本站部署记录见[验证记录](validation.md)。其他用户 Fork 时必须同时替换两份 Wrangler 配置中的 D1 数据库名称与 ID；本指南中的数据库属于本站，不能直接复用。

参考：[D1 初始化](https://developers.cloudflare.com/d1/get-started/)、[Pages Git 集成](https://developers.cloudflare.com/pages/get-started/git-integration/)、[Workers 构建配置](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)。
