# 常见问题

## 网站首页在哪里？

本站入口是 https://radar.chenran71ran.cc/ ，原始 Pages 地址是 https://github-discovery.pages.dev/ 。自定义域名需等待 Pages 状态变为 Active。

`/api/status` 是诊断接口，不是网站界面。返回 `{"jobs":[]}` 表示查询成功，但尚无任务记录；不代表已有榜单。

## 为什么首页没有项目？

新建 D1 没有真实数据，需要成功完成首次采集。采集按北京时间每天 02:15、08:15、14:15、20:15 执行；每小时第 45 分钟只补充摘要，不抓榜单。检查 `/api/status` 与 Worker Observability 日志，确认任务是否运行。

## 如何立即采集？

在采集 Worker 的运行时 Secrets 中设置 `TRIGGER_SECRET` 并发布，然后使用自己的密钥调用：

```bash
curl --request POST 'https://<你的采集Worker域名>/trigger' \
  --header 'Authorization: Bearer <TRIGGER_SECRET>' \
  --header 'Content-Type: application/json' \
  --data '{"mode":"collect"}'
```

这是写入数据的操作。调用会等待任务结束，避免重复发起。`{"mode":"summarize"}` 仅补充摘要。未配置密钥时手动接口关闭，Cron 仍可运行。

## 是否需要 admin 密码？

当前没有管理后台或远程收藏账户。网页只读榜单，本地收藏与已读状态保存在浏览器。手动采集接口使用独立的 `TRIGGER_SECRET`，不是访客登录密码。

## 前端换域名后，Worker 也要修改吗？

不需要。前端通过同域 API 读取 D1，采集器写入同一个 D1；仅在 Pages 中绑定自定义域名即可。

## 为什么没有中文摘要或者 Rising？

摘要按每轮预算逐步补齐，模型失败时保留原始描述。Rising 需要两个相隔 22–26 小时的真实 API 样本；刚部署时等待积累正常。GitHub Token 未设置时采样预算较小。

## 收藏会同步到手机吗？

不会自动同步。可通过界面的 JSON 导出与导入迁移。清理浏览器站点数据会删除本地收藏。

## 会推送到 ChatGPT 吗？

当前代码不包含 ChatGPT 推送。Cloudflare Cron 只更新网站数据；ChatGPT 每日精选需要另外配置自动化并验证其能读取站点数据。

## 部署成功就代表采集正常吗？

不代表。至少检查一次任务完成、D1 写入、榜单显示与 AI 摘要；完整检查项见[验证记录](validation.md)。
