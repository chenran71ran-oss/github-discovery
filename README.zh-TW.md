<div align="center">

<img src="public/icon.svg" width="96" alt="GIT Bot">

# GIT Bot

**用中文發現 GitHub 上正在升溫的開源專案。**

[简体中文](README.md) · [English](README.en.md) · 繁體中文 · [日本語](README.ja-JP.md) · [한국어](README.ko.md)

[線上瀏覽](https://radar.chenran71ran.cc/) · [功能](#功能) · [資料從哪來](#資料從哪來) · [本機執行](#本機執行) · [設定金鑰](#設定金鑰) · [部署](#部署) · [開發約定](#開發約定)

</div>

## 簡介

GIT Bot 每天彙整 GitHub 上的熱門與新興專案，以日榜、週榜、月榜呈現，並替每個專案附上中文簡介、分類與來源標註，讓你很快判斷它能做什麼、值不值得一試。

整個網站是純靜態的：資料由 GitHub Actions 每天採集成 JSON，前端直接讀取同源檔案，不需要資料庫，也不需要後端服務。

網站介面為簡體中文。專案以 [NewsNow](https://github.com/newsnext/newsnow)（MIT）為基礎二次開發，沿用 [GithubTrending](https://github.com/Ibook000/GithubTrending)（Apache-2.0）的榜單解析器，詳見 [UPSTREAM.md](UPSTREAM.md)。

## 功能

**瀏覽**
- 日榜／週榜／月榜，也能選擇歷史日期，查看過去的快照。
- 兩種版面：依名次排列的卡片清單，或依用途分欄。
- 每個專案一張圓角玻璃卡：專案圖示、名次與排名變化、中文簡介、語言、Star、週期新增。
- 「爆发」（爆發）標記：週期新增 Star 佔總數的比例與絕對增量都很高的專案。

**篩選**
- 搜尋（⌘K／Ctrl K），可搜尋專案名稱、簡介、用途、技術棧。
- 9 個分類：AI 與智慧代理、開發工具、前端與介面、自架服務、資料與基礎設施、安全與隱私、行動與桌面、學習與研究、其他。
- 依程式語言篩選；依榜單名次、總 Star 或週期新增排序。
- 週期、搜尋詞、語言、分類、日期都會寫進網址，可以直接分享。

**外觀與手機**
- 液態玻璃風格，10 套配色（6 深 4 淺），也能跟隨系統深淺色。
- 針對 iPhone 調整：懸浮底欄、自底部彈出的面板、安全區域避讓；可以加入主畫面當作 App 使用。
- 支援系統的「減少動態效果」與「降低透明度」設定。

**收藏**
- 收藏存在目前的瀏覽器，不需要帳號，也不會同步到 GitHub Star。

## 資料從哪來

採集程式 `collector/collect.py` 每天台北時間 08:20 執行，每個週期從三類來源取資料，依儲存庫去重後依序排列：

| 來源 | 內容 | 頁面標籤 |
| :--- | :--- | :--- |
| GitHub Trending 總榜 | 全語言 Trending 的完整清單，保留原始名次與週期新增 Star | — |
| 語言榜 | 12 種語言（Python、TypeScript、JavaScript、Go、Rust、Java、C++、C、C#、Swift、Kotlin、PHP）各自的 Trending，每種最多取 5 個總榜沒有的專案 | 语言榜 |
| GitHub 搜尋 | 日榜取近 7 天、週榜近 30 天、月榜近 90 天內新建、Star 成長快的專案：整體前 30 個，再加上 8 個主題各最多 8 個 | 新项目 |

GitHub Trending 現在每頁只列出約 8–20 個專案，所以另外兩類來源是主要的補充。2026-10-30 的一次採集為：日榜 141、週榜 150、月榜 166 個，去重後共 385 個專案。

分類依專案名稱、簡介與 GitHub 主題標籤的關鍵字評分得出；設定 AI 解讀後，以通過驗證的 AI 結果為準。

任何一個來源失敗都只會略過它本身。若某個週期的總榜抓不到，就保留該週期上一次的完整榜單，並在頁面上標出時間；第一次採集就失敗時直接報錯，不會發布空白網站。

### 中文內容

每個專案的中文簡介依下列順序取第一個可用的，頁面上都會標明來源：

| 順序 | 來源 | 頁面標籤 |
| :--- | :--- | :--- |
| 1 | 讀取 README 後由 AI 產生，並通過格式驗證（需設定 `LLM_*`） | README 解读 |
| 2 | GithubTrending 發布的中文速覽（7 天內） | 中文速览 |
| 3 | 依專案公開簡介整理的首批資料（`collector/editorial.json`），簡介變更後不再沿用 | 资料速览 |
| 4 | 透過 MyMemory 免費介面機器翻譯專案自己的簡介 | 机器翻译 |
| 5 | 都沒有時顯示原文 | 解读待补充 |

機器翻譯依簡介的雜湊值快取在 `public/data/translation-cache.json`，同一段簡介只翻譯一次，也不會覆蓋前三種來源。不會用範本文字冒充 AI 分析。

## 本機執行

需要 Node.js 24、pnpm 10.30.3；執行採集還需要 Python 3.12。

```bash
corepack pnpm install --frozen-lockfile
pnpm dev                 # 靜態資料模式，直接讀取 public/data/ 的 JSON
```

儲存庫裡已有採集好的資料，開啟前端不需要資料庫或任何金鑰。

```bash
pnpm build:preview       # 純靜態建置，產物在 dist/
pnpm typecheck           # 型別檢查（需先建置一次，產生自動匯入宣告）
pnpm exec vitest run shared/discovery.test.ts
```

執行採集：

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r collector/requirements.txt
export GITHUB_TOKEN=你的個人權杖   # 選用；不設定時，搜尋每個週期只做一次整體查詢
python collector/collect.py
python -m unittest discover -s collector -p 'test_*.py'
```

> 本機採集會改寫 `public/data/`。這個資料夾只由每天的採集機器人提交，測試完請用 `git restore public/data && git clean -fd public/data` 還原。

## 設定金鑰

採集在 GitHub Actions 裡執行，所以金鑰要加在 **GitHub 儲存庫** 的 Settings → Secrets and variables → Actions，不是 Cloudflare。全部都是選用的：

| 名稱 | 作用 |
| :--- | :--- |
| `LLM_BASE_URL` | 相容 OpenAI Chat Completions 的 HTTPS 介面位址 |
| `LLM_MODEL` | 模型識別名稱 |
| `LLM_API_KEY` | 模型服務的金鑰 |
| `MYMEMORY_EMAIL` | 機器翻譯的聯絡信箱，把每天的免費額度從 5,000 字元提高到 50,000 字元 |

三個 `LLM_*` 都設定後，會讀取 README 產生中文簡介、適用情境、技術棧、亮點與分類；請求或驗證失敗時保留原有內容。金鑰不會寫進前端或資料檔。

搜尋用的 `GITHUB_TOKEN` 由 GitHub Actions 自動提供，不需要手動新增。

## 部署

正式環境部署在 Cloudflare Pages，專案名稱 `github-discovery`，正式分支 `main`。

| 設定項目 | 值 |
| :--- | :--- |
| 建置指令 | `npx --yes pnpm@10.30.3 install --frozen-lockfile && npm run build:preview` |
| 輸出目錄 | `dist` |
| Node 版本 | `24` |
| 資料庫／環境變數 | 不需要 |

採集機器人每天把新資料提交到 `main` 後，Cloudflare 會重新建置。頁面上的「刷新」只會重新讀取已發布的資料，不會觸發採集。

儲存庫保留了 NewsNow 原有的 Nitro 後端（`server/`），需要時可以用 `CF_PAGES=1 npm run build` 建置完整版本，設定方式見 [NewsNow 原說明](docs/NEWSNOW-README.md)。正式環境目前沒有使用。

## 目錄

| 路徑 | 內容 |
| :--- | :--- |
| `src/components/discovery/` | 首頁：卡片、篩選、配色、詳情、樣式 |
| `shared/discovery.ts` | 前端與採集共用的資料格式、篩選與驗證 |
| `collector/` | 採集、分類、中文內容、測試，以及上游解析器 |
| `public/data/` | 最新榜單、歷史快照、AI 與翻譯快取 |
| `.github/workflows/` | 每日採集與 CI 檢查 |
| `server/` | 保留的 NewsNow Nitro 後端 |

## 開發約定

- `main` 是正式環境基線。新功能用 `feat/<模組>` 分支，修正用 `fix/<問題>`，維護用 `chore/<任務>`，經 PR 與 CI 通過後合併。詳見 [CONTRIBUTING.md](CONTRIBUTING.md)。
- CI（Discovery checks）會依序執行：完整建置、型別檢查、資料格式測試、採集程式測試、靜態建置，並上傳 `discovery-static-preview` 預覽產物。
- 資料格式集中在 `shared/discovery.ts`。修改欄位時，要同時更新採集輸出、驗證、前端讀取與測試。
- 只有採集機器人可以直接向 `main` 提交 `public/data/**`。

**回復**：改版前的舊版原始碼保留在 [`backup/radar-before-newsnow-20261026`](https://github.com/chenran71ran-oss/github-discovery/tree/backup/radar-before-newsnow-20261026) 分支。需要回復時，優先在 Cloudflare Pages 的部署清單對舊部署執行 Rollback，不需要更動資料庫或網域。

## 來源與授權

- [NewsNow](https://github.com/newsnext/newsnow)：MIT，授權全文見 [LICENSE](LICENSE)。
- [GithubTrending](https://github.com/Ibook000/GithubTrending)：Apache-2.0，授權全文見 [collector/vendor/LICENSE](collector/vendor/LICENSE)，解析器未經修改。
- 修改說明見 [UPSTREAM.md](UPSTREAM.md)。本專案是引入原始碼後的二次開發，不是 GitHub 上的正式 Fork，也不代表上游認可本專案。
- 專案圖示來自儲存庫擁有者的 GitHub 大頭貼；榜單資料來自 GitHub。
