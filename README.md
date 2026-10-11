# GitHub Discovery

中文开源项目发现站，基于 Softween Web 副本并整合采集 Worker。

[完整说明与 Cloudflare 部署步骤](README.zh-CN.md) · [上游与来源记录](UPSTREAM.md)

Astro 5 + TypeScript + Cloudflare Pages / Workers + D1 + Workers AI + Cron。支持日／周／月榜、历史、中文解读、Rising、筛选、收藏与深浅色主题。

```bash
npm ci
npm run db:local
npm run seed -- --demo # 可选，仅本地演示
npm run dev
```

生产运行不需要 VPS、Docker 或本地常驻电脑。所有数据库 ID 均为占位值，部署时替换为你自己的 D1。
