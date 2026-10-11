# 贡献指南

欢迎通过 Issue 提交问题和建议，或通过 PR 改进项目。先阅读[项目首页](README.md)和[数据口径](docs/guide.md)。

## 本地开发

使用 Node.js 22+：

```bash
npm ci
npm run db:local
npm run seed -- --demo
npm run dev
```

本地采集器可使用 `npm run worker:dev`。不要在测试中调用远程 D1 写入，也不要提交 GitHub Token、Cloudflare Token 或 `TRIGGER_SECRET`。

## 改动原则

- 保留日／周／月完整成员及排名，元数据补充可以去重。
- 发布快照使用事务；采集失败保留此前成功结果。
- 浏览网页不触发 GitHub 抓取或 AI 请求。
- Rising 使用真实计数器样本，显示实际观测间隔。
- 新增 API 字段同步更新 shared 契约、调用方与文档。
- 保留上游版权、许可证与来源记录。

## 提交前

```bash
npm run check
npm test
npm run build
npx wrangler deploy --config worker/wrangler.jsonc --dry-run
```

仅改文档时检查链接、命令和实际实现是否一致即可。涉及 UI 时说明桌面与移动端检查结果；无法完成的验证如实注明。

## Pull Request

说明具体问题、最终行为和验证结果。新增功能先解释使用场景，避免引入与发现开源项目无关的依赖。提交 Issue 时提供复现步骤、实际结果和脱敏日志。
