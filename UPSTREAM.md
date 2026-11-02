# 上游来源与改动说明

## NewsNow

- 来源：https://github.com/newsnext/newsnow
- 导入提交：`0560c993b226cd2fd07d8a79875d50551f52c584`
- 许可：MIT，原文保留于根目录 `LICENSE`。
- 用途：React、Vite、TanStack Router / Query、UnoCSS、主题、PWA、Nitro 与 Cloudflare 部署基础。
- 修改：首页换为 GitHub 发现页（`src/components/discovery/`），包括单列榜单、侧栏 / 底部面板解读、两级分类筛选、GIT Bot 分类卡片、浏览器收藏、历史快照、悬浮玻璃栏和深浅色切换；新增纯静态构建；调整站点元信息和安全隔离的预览工作流；修复原牛客源未知类型返回无效 URL 的类型问题。NewsNow 的聚合页面与 Nitro 后端仍保留在 `server/` 与原有路由中，生产环境未使用。
- 原说明及其中、日文译本见 `docs/NEWSNOW-README.md`、`docs/NEWSNOW-README.zh-CN.md`、`docs/NEWSNOW-README.ja-JP.md`。
- 原始作者信息仍保留于 package.json。

## Ibook000/GithubTrending

- 来源：https://github.com/Ibook000/GithubTrending
- 导入提交：`9a550950e2d3541961775dbbb89f035c031d6210`
- 许可：Apache-2.0，原文见 `collector/vendor/LICENSE`。
- 未修改的解析器位于 `collector/vendor/github_trending/app.py` 和 `__init__.py`。
- 本项目只通过 `collector/blocks/http.py` 引入原解析器（`create_http_session`、`parse_trending_html`），由 `collector/blocks/trending.py` 读取完整日 / 周 / 月榜与周期增量。采集流程、搜索、分类、中文增强等均为本项目代码，见 `docs/ARCHITECTURE.md`。
- 每次采集都会读取其公开发布的中文速览 JSON（`collector/blocks/upstream.py`，只接受 7 天内的数据，并排除通用模板句），标为 `summarySource=upstream`，不标为本项目独立的 README 分析。

## 首批资料整理

`collector/editorial.json` 记录对应仓库公开简介或 README 链接、整理时间、内容依据及简介哈希。用于补齐启动数据，标为 `summarySource=editorial`。非外部模型生成，不作为长期自动翻译服务。

本项目把以上源码引入现有 github-discovery 仓库，没有创建 GitHub 原生 Fork 关系。根目录 MIT 不替代嵌入代码的 Apache-2.0 许可；后续分发时须一并保留相关许可与来源说明。
