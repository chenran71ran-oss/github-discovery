# 架构：四层分工

采集器与前端都按同样的四层组织：**下层不依赖上层**，换掉某一层的实现不影响其他层。

| 层 | 职责 | 采集器（`collector/`） | 前端 |
| :--- | :--- | :--- | :--- |
| 1 类型与配置 | 数据结构、静态配置，不含逻辑 | `core/types.py`、`core/settings.py`、`core/taxonomy.py` | `shared/discovery.ts`、`shared/taxonomy.ts` |
| 2 积木 | 单一职责、可替换的模块与算法 | `blocks/`：抓取、解析、分类信号、翻译、模型 | `src/components/discovery/` 下的界面组件 |
| 3 实验 | 把积木组装成策略与流程，并评估效果 | `lab/`：分类策略、采集流水线、标注集评估 | `model.ts`：筛选、排序、统计的组合 |
| 4 外交 | 与外部交互：配置、日志、调度、读写 | `app/`：环境变量、日志、阶段计时、发布、命令行 | `api.ts`：读取快照、账号接口、收藏 |

两边共用的分类体系只有一份：`shared/taxonomy.json`。环境变量、自动采集、部署与回滚见 [OPERATIONS.md](OPERATIONS.md)。

## 采集器

```bash
python -m collector run        # 采集、增强、分类、发布（定时任务调用这一条）
python -m collector classify   # 只用当前分类体系重新分类最新快照，不重新抓榜
python -m collector evaluate --readme --errors   # 在标注集上比较分类策略
python -m unittest discover -s collector -p 'test_*.py'
```

`collector/collect.py` 保留为兼容入口，等同于 `python -m collector run`。

### 数据流

```
Trending 总榜 ─┐
语言榜 ×12 ────┼─ lab.pipeline.merge_period ─ 去重、排名 ─┐
GitHub 搜索 ───┘   （总体 + 每个分类的主题流）            │
                                                         ▼
     特征：仓库主题（REST，需 token）、README 摘要（缓存 14 天）
                                                         ▼
     中文：README 模型解读 > 上游速览 > 资料整理 > 机器翻译
                                                         ▼
     GIT Bot 分类引擎（blocks/classify） ─ 主分类、次要标签、用途、技术栈、依据
                                                         ▼
     app.store.publish → public/data/latest.json、history/、*-cache.json
```

发布前还有一步「历史」（`blocks/history.py`）：拿当天榜单和之前发布的快照比较，给**每个**项目算出 Star 增长（`starDelta`，日榜比 1 天前、周榜比 7 天前、月榜比 30 天前，快照不够时取窗口内最早的一份并记下天数 `starDeltaDays`），并维护 `first-seen.json` 记录每个项目第一次上榜的日期（`firstSeen`）。Trending 只给自己的项目周期增量，搜索来的项目原本没有增长数字，这一步补上了。

每个阶段失败都有退路：某个周期抓取失败时保留上次完整榜单；搜索、主题、README 或翻译失败时跳过，并用缓存继续分类；完全没有数据时拒绝发布。

### 数据源

- **Trending 总榜与 12 种语言榜**：保留原始排名与周期新增 Star。
- **搜索流**：总体流（近期新建、Star 增长快）加上每个分类的主题流（`streamTopics`）。主题流让工具类、生活类等很少上总榜的项目也能出现。有 token 时每个周期约 29 次搜索，三个周期合计约 3 分钟。
- **仓库主题**：Trending 页面不显示主题，有 token 时通过 REST 补全，缓存 3 天。
- **README**：只取开头一段做分类信号，不发布原文；摘要缓存在 `feature-cache.json`。

## GIT Bot 分类引擎

分类体系有 4 个领域（开发、工具、生活、学习）、23 个细类，外加「其他」。每个细类标注一种视角：

- **用途**：项目拿来做什么，例如理财、健身、截图、自托管。
- **技术**：项目用什么做的，例如 AI、前端、后端、数据库、移动端。

引擎由互相独立的信号组成（`blocks/classify/signals.py`），每个信号只给出各分类的得分和依据：

| 信号 | 依据 |
| :--- | :--- |
| 主题 | 作者自己设置的 GitHub topics，最可靠 |
| 关键词 | 项目名、简介、中文简介里的中英文关键词，按词边界匹配 |
| README | README 开头的关键词命中，权重较低且有上限 |
| 语言 | 少数语言的倾向，例如 Swift → 移动与桌面 |
| 技术栈 | 识别出的框架，例如 Godot → 游戏与图形 |
| 模型 | 配置了模型时，经校验的 README 解读给出的分类 |

策略（`lab/strategies.py`）决定每个信号的权重。生产使用的 `full` 策略会给「技术」视角的分类打折，所以「AI 修图工具」的主分类是音视频与图像，再带上 AI 标签；Android 上的 VPN 归入安全与隐私。得分接近主分类的其他分类成为次要标签，最多两个；筛选某个分类时，带有这个次要标签的项目也会出现。

每条结果都附带置信度（主分类得分占全部得分的比例）和依据，例如「主题 self-hosted」「关键词 budget」，并显示在项目详情里。

### 评估

`lab/gold.json`（113 个）与 `lab/holdout.json`（60 个）是从真实榜单里人工标注的仓库，附带真实的 GitHub 主题。gold 用来调关键词和权重；holdout 只用来报告，不参与调参。2026-11-02 的结果：

| | 旧规则（9 类） | 新引擎 `full`，主分类 | 新引擎，主分类或次要标签 |
| :--- | :--- | :--- | :--- |
| holdout（未参与调参） | 28% | 53% | 72% |
| gold（参与调参） | 32% | 68% | 85% |

主分类准确率只有一半左右，主要是因为很多项目本来就跨类，例如「给编程智能体用的安全扫描」。所以界面同时展示次要标签和依据。单元测试会在离线条件下确认 `full` 策略在两个标注集上不低于关键词基线，避免改关键词时悄悄变差。

### 调整分类

1. 改 `shared/taxonomy.json`：分类、主题、关键词、用途、技术栈都在这里，前端和采集器同时生效。改了词表要把 `version` 加一，README 摘要缓存会随之刷新。
2. 运行 `python -m collector evaluate --readme --errors`，看 gold 上的错误。只加通用的词，不要为了某一个仓库加专门的词。
3. 确认 holdout 没有变差，再提交。
4. 新增分类时，同时在 gold 或 holdout 里标注几个样本。

## 账号模块（`edge/` + `functions/`）

网站只对受邀成员开放：用 GitHub 登录，站长与管理员负责邀请、审批和停用成员。它跑在 Cloudflare Pages Functions 上，数据存在 Pages 绑定的 D1（`DB`），同样按四层组织：

| 层 | 文件 | 内容 |
| :--- | :--- | :--- |
| 类型与配置 | `edge/types.ts`、`edge/config.ts` | 成员、会话、Cookie 名、有效期、公开路径 |
| 积木 | `edge/session.ts`、`edge/github.ts`、`edge/store.ts` | HMAC 签名 Cookie、GitHub 登录、D1 存储（表名带 `gb_` 前缀，首次访问自动建表） |
| 策略 | `edge/access.ts`、`edge/admin.ts`、`edge/favorites.ts` | 登录后的准入、每个请求的放行规则、管理操作的边界、收藏的读写规则 |
| 外交 | `edge/http.ts`、`edge/pages.ts`、`functions/**` | HTTP 工具、日志、登录页，以及很薄的路由文件 |

**请求怎么走**
- `functions/_middleware.ts` 拦在所有请求前面：没有有效会话时，打开页面跳到 `/login`，数据与接口返回 401。榜单数据 JSON 同样受保护。
- `public/_routes.json` 让带哈希的 JS / CSS、图标和图片不经过 Functions（它们就是仓库里公开的代码），减少调用次数；页面、数据和接口都经过。
- 缺少任何一个环境变量或 D1 绑定时，整站返回 503，而不是不设防地放行。

**登录与准入**
1. `/api/auth/login` 生成一次性 state（签名后放在 10 分钟有效的 Cookie 里），跳到 GitHub 授权页。
2. `/api/auth/callback` 核对 state，用 code 换取令牌、读取 GitHub 用户，令牌随即丢弃（第一步不保存任何 GitHub 令牌）。
3. 准入：`ADMIN_GITHUB_LOGIN` 指定的站长总是管理员；被邀请的人直接成为成员（邀请随即作废）；其他人进入「待审批」；被停用的人进不来。
4. 写入会话 Cookie：`__Host-` 前缀、HttpOnly、Secure、SameSite=Lax，HMAC-SHA256 签名，有效 7 天。

**会话核对**：会话每 10 分钟回 D1 核对一次成员状态，停用或移除最迟 10 分钟后生效。管理接口每次都以 D1 里的当前角色为准，不信任 Cookie 里的角色。

**防护**
- 改数据的请求必须同源（`Origin`，或浏览器写的 `Sec-Fetch-Site: same-origin`）且是 JSON，防跨站请求伪造。
- 会话令牌与登录过程中的 state 令牌用不同的密钥签名（主密钥加上用途派生），并带有用途字段，二者不能互相冒充；会话还要求字段齐全，核对时间缺失或异常时一律回数据库核对。
- 登录后的跳转先拒绝控制字符、空白和反斜杠，再按浏览器的方式解析，结果必须仍在本站，防开放重定向。
- 登录页与登录接口不做会话续期，下游已设置或清除会话 Cookie 时也不追加续期，保证退出登录一定生效。
- 不能修改自己的账号，也不能修改站长账号。
- 日志一行一个 JSON，不记录 Cookie、令牌或密钥。

**收藏**：`gb_favorites` 按（GitHub ID，仓库全名）保存收藏时的项目快照，项目掉出榜单后仍能显示。接口是 `/api/favorites`（GET 读取、PUT 收藏、DELETE 取消）和 `/api/favorites/import`（第一次登录时导入浏览器里的收藏，已有的不覆盖）。每人只能读写自己的收藏，管理员也看不到别人的；写操作同样要求同源 JSON；每人最多 1000 个，单条不超过 16 KB；移除成员时一并删除其收藏。

**看过的项目**：`gb_seen` 记录每人点开过的项目（保留 90 天，每人最多 5000 条），用来淡化已读和筛选「没看过」。接口是 `/api/seen`（GET 读取、POST 上报，每次最多 100 个）。前端攒两秒批量上报，切到后台时用 `keepalive` 发出；没有账号层时存在浏览器里。

**测试**：`edge/accounts.test.ts` 用真正的 SQLite 模拟 D1，覆盖签名、准入、放行规则、中间件、完整的 GitHub 登录回调（GitHub 接口用桩替代）和管理接口的权限。另外在本地用 `wrangler pages dev` 跑过真实的 Workers 运行时，见 `docs/OPERATIONS.md`。

## 前端

- `shared/taxonomy.ts` 读取同一份分类体系，并把旧快照里改过名的分类映射到新分类（例如「学习与研究」→「教程与资源」）。没有分类字段的旧快照照常显示。
- `api.ts` 是唯一会 `fetch` 或读写 `localStorage` 的文件；收到 401 时跳到登录页。登录后收藏读写账号接口，没有账号层时读写浏览器存储。`/api/me` 返回 404 说明没有账号层（本地纯静态开发），界面不显示账号入口。
- `account.tsx` 是状态栏里的头像菜单和成员管理面板。
- `model.ts` 是纯函数：收藏视图的数据来源、筛选与排序、领域和分类计数、分类分布。
- 组件只负责展示：`category-filter.tsx` 是两级分类筛选，`classified.tsx` 是 GIT Bot 分类卡片，其余见 `docs/DISCOVERY-UI.md`。
