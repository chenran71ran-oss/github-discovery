# 上游来源与改动说明

## NewsNow

- 来源：https://github.com/newsnext/newsnow
- 导入提交：`0560c993b226cd2fd07d8a79875d50551f52c584`
- 许可：MIT，原文保留于根目录 `LICENSE`。
- 用途：React、Vite、TanStack Router / Query、UnoCSS、主题、PWA、Nitro 与 Cloudflare 部署基础。
- 修改：首页换为 GitHub 发现；补充中文项目卡片、筛选、详情、收藏、历史快照与静态构建；调整站点元信息和安全隔离的预览工作流；修复原牛客源未知类型返回无效 URL 的类型问题。
- 原始作者信息仍保留于 package.json；原说明见 `docs/NEWSNOW-README.md`。

## Ibook000/GithubTrending

- 来源：https://github.com/Ibook000/GithubTrending
- 导入提交：`9a550950e2d3541961775dbbb89f035c031d6210`
- 许可：Apache-2.0，原文见 `collector/vendor/LICENSE`。
- 未修改的解析器位于 `collector/vendor/github_trending/app.py` 和 `__init__.py`。
- 适配层 `collector/collect.py` 调用原解析器，读取完整日/周/月榜、增量、历史、失败保留，以及可选 README 中文分析。
- 部分初始中文速览来自其已发布 JSON，`summarySource=upstream`，不标为本项目独立 README 分析。

## 首批资料整理

`collector/editorial.json` 记录对应仓库公开简介或 README 链接、整理时间、内容依据及简介哈希。用于补齐启动数据，标为 `summarySource=editorial`。非外部模型生成，不作为长期自动翻译服务。

本预览把以上源码引入现有 github-discovery 的独立分支，没有创建 GitHub 原生 Fork 关系。根目录 MIT 不替代嵌入代码的 Apache-2.0 许可；后续分发时须一并保留相关许可与来源说明。
