# 验证记录 — v0.1

## 已通过

- `npm run check`：Astro 16 个源文件，0 错误／警告；采集 Worker TypeScript 校验通过。
- `npm test`：11 项测试全部通过。覆盖跨周期成员保留、日期＋周期＋语言＋分类＋搜索、快照事务回滚、24h 样本和积累状态、HTML 解析、备用 JSON 格式与旧数据拒绝、AI JSON 校验、非法日期、采集部分失败保留旧榜、数据库任务互斥、手动触发鉴权。
- `npm run build`：生产 SSR 与客户端构建通过，客户端 JS gzip 约 18.9 kB。
- `wrangler deploy --config worker/wrangler.jsonc --dry-run`：采集 Worker 打包通过，D1 / AI 绑定解析正确。
- 编译后的前端直接在 Miniflare / workerd 运行：首页 SSR、仓库详情页面、仓库详情 API、联合筛选 API、Rising API、无效查询返回 400 全部通过。
- 本地 D1 迁移、演示数据导入、前后端共用 DB 绑定已验证。

## 修复的运行时问题

Cloudflare 的 Node process v2 与 Astro 5 SSR 存在兼容问题，可能造成页面仅输出 `[object Object]`。根目录 `wrangler.jsonc` 增加 `disable_nodejs_process_v2`，运行时检查确认页面输出完整 HTML。采集 Worker 不需要该 SSR 兼容设置。

## 尚未完成的验证

- 当前环境无法成功取得浏览器二进制，未完成浏览器点击、视觉布局、手机／电脑截图验证。HTML 演示是已构建界面的离线展示，不能代替浏览器实测。
- 未在你的 Cloudflare 账号中运行 Cron 或 Workers AI；模型可用性、账户配额和线上 GitHub 请求需部署后验证。
- 未创建你账号中的 GitHub Fork，未创建远程 D1，未发布站点或绑定域名。

## 演示页

`GitHub-Discovery-preview.html` 是自包含文件，使用明确标注的本地演示数据。模拟接口基于本地 D1 的输出，所有 JS / CSS 内嵌，不调用线上 AI。源码中的生产接口仍读取真实 D1。收藏保存在打开演示文件的浏览器内。

## 可复现方式

参照 README.zh-CN.md 执行本地初始化和演示 seed 后构建。浏览器正常的环境可以打开本地生产预览检查交互；没有演示 seed 的全新数据库会显示等待采集。
