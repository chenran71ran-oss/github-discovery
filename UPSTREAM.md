# 上游与改造记录

主副本：Softween/softween-trending-web，基线 6e43e125f78eeca44600d170df503a3a0a0a2a53，MIT，原版权声明见 LICENSE。

采集 Worker 来源：Softween/softween-trending-mailer，基线 8e54eb2fe2ec0227eea251547b72bd41c3c1ce64，MIT，原版权声明见 worker/LICENSE。保留其 fetch/cron/README/AI 的组织方式，替换邮件流水线、HTML 解析器、快照发布与摘要模型。

github-trending-history：借鉴中文摘要、技术栈与适用场景的信息结构，未复制实现。
isboyjc/github-trending-api：仅消费其公开备用 JSON，不复制源码。
AndrewGodlewsky/trendingrepos：仅参考多信号发现思路，重新实现基于实际观测的排名，未复制 Python 代码。
OmniTrends：仅参考聚合导航交互，未复制其 AGPL 代码或素材。

所有代码在主副本历史上修改；GitHub 账户中的 Fork 尚未创建。后续创建 Fork 后，可直接推送此改造分支；worker 上游作为独立 upstream-mailer remote 同步。
