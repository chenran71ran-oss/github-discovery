# NewsNow 原版界面适配

本次只调整发现站前端，基于已有 NewsNow 源码的原版排版：顶部品牌与居中导航、多列 500px 高榜单、彩色外壳、内嵌滚动内容和紧凑排名列表。

- 原版参考：https://newsnow.busiyi.world/
- 源码依据：src/components/column/card.tsx、src/components/navbar.tsx、src/routes/__root.tsx、uno.config.ts（MIT）。
- 直接复用原 OverlayScrollbar、主题、字体、图标资产与颜色系统；发现首页适配层位于 src/components/discovery/。
- index.tsx：数据加载、搜索筛选、导航与收藏状态。
- board.tsx：共用榜单面板与项目列表，保留原始排名和各周期新增值。
- detail.tsx：项目详情、内容来源说明和 README 入口。
- utils.tsx：图标和北京时间格式。
- style.css：跟随原版外壳尺寸、间距、彩色面板和嵌套内容层，补充移动端与焦点样式。

默认最热视图并排展示日、周、月完整榜单，下方展示今日用途分类；今日/本周/本月切换对应单周期与分类面板。搜索、历史日期、语言、用途分类、排序应用于当前显示的面板。关注显示现有浏览器收藏，沿用原存储键，项目详情单独打开。

未引入其他主题模板或新依赖。抓取任务、模型配置、JSON 数据格式、生产域名与旧版回滚配置均不在本次改动范围。此 UI 分支提供 Cloudflare Pages 预览，验收后再合入 main。
