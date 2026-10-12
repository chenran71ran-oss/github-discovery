# 上游与改造记录

主副本：Softween/softween-trending-web，基线 6e43e125f78eeca44600d170df503a3a0a0a2a53，MIT，原版权声明见 LICENSE。

采集 Worker 来源：Softween/softween-trending-mailer，基线 8e54eb2fe2ec0227eea251547b72bd41c3c1ce64，MIT，原版权声明见 worker/LICENSE。保留其 fetch/cron/README/AI 的组织方式，替换邮件流水线、HTML 解析器、快照发布与摘要模型。

github-trending-history：借鉴中文摘要、技术栈与适用场景的信息结构，未复制实现。
isboyjc/github-trending-api：仅消费其公开备用 JSON，不复制源码。
AndrewGodlewsky/trendingrepos：仅参考多信号发现思路，重新实现基于实际观测的排名，未复制 Python 代码。
OmniTrends：仅参考聚合导航交互，未复制其 AGPL 代码或素材。

## 副本与维护方式

改造仓库：[chenran71ran-oss/github-discovery](https://github.com/chenran71ran-oss/github-discovery)，由 Softween Web Fork 后二次开发，保留主上游 Git 历史。采集器作为同仓库的独立 Worker 部署。

更新上游时先审查差异、在分支合并并运行验证，再发布。不要用原版文件整体覆盖本项目，否则会丢失数据库、UI 和采集改造。

## 排版参考

文档的信息组织参考 [Astro](https://github.com/withastro/astro) 与 [Hono](https://github.com/honojs/hono) 的官方仓库：清晰的项目介绍、快速开始、独立文档入口与贡献说明。文案和视觉标识为本项目编写，未复制其代码或品牌素材。

### 2026-10-12 中文分析整合

核对 `bhwa233/github-trending-history` 的 `ai-service.ts`，将“中文摘要、技术栈、适用场景”的分析流程与 JSON 输出约束适配到现有 Workers AI binding + D1 队列。独立实现响应格式兼容、中文校验、失败分类和小时级重试，不引入其 Next.js 部署或 Gateway 账户配置，也未复制其实现代码。原始描述保留，卡片优先显示中文摘要并展示技术栈，详情继续展示用途与亮点。
