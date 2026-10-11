# GitHub Discovery

中文开源项目发现站，基于 Softween Web 副本并整合采集 Worker。

[Cloudflare 网页部署](DEPLOY.dashboard.md) · [完整说明](README.zh-CN.md) · [上游与来源记录](UPSTREAM.md)

Astro 5 + TypeScript + Cloudflare Pages / Workers + D1 + Workers AI + Cron。支持日／周／月榜、历史、中文解读、Rising、筛选、收藏与深浅色主题。

```bash
npm ci
npm run db:local
npm run seed -- --demo # 可选，仅本地演示
npm run dev
```

生产运行不需要 VPS、Docker 或本地常驻电脑。前端和采集 Worker 已配置本站的 D1 ID；其他用户 Fork 时请替换两份配置为自己的数据库。
