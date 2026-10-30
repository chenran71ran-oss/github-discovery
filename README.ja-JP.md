<div align="center">

<img src="public/icon.svg" width="96" alt="GIT Bot">

# GIT Bot

**GitHub で注目を集め始めたオープンソースプロジェクトを、中国語の解説つきで見つける。**

[简体中文](README.md) · [English](README.en.md) · [繁體中文](README.zh-TW.md) · 日本語 · [한국어](README.ko.md)

[サイトを開く](https://radar.chenran71ran.cc/) · [機能](#機能) · [データの出どころ](#データの出どころ) · [ローカルで動かす](#ローカルで動かす) · [シークレット](#シークレット) · [デプロイ](#デプロイ) · [開発ルール](#開発ルール)

</div>

## 概要

GIT Bot は、GitHub で人気のプロジェクトと新しく伸びているプロジェクトを毎日集め、日間・週間・月間のランキングにまとめます。各プロジェクトには中国語の紹介文、カテゴリ、紹介文の出どころを示すラベルが付くので、何ができるのか、試す価値があるのかをすぐに判断できます。

サイトは完全な静的サイトです。GitHub Actions が毎日データを JSON に収集し、ページは同じオリジンのファイルを直接読み込みます。データベースもバックエンドも必要ありません。

画面は簡体字中国語です。[NewsNow](https://github.com/newsnext/newsnow)（MIT）をベースに開発し、[GithubTrending](https://github.com/Ibook000/GithubTrending)（Apache-2.0）のランキング解析処理を利用しています。詳しくは [UPSTREAM.md](UPSTREAM.md) を参照してください。

## 機能

**見る**
- 日間・週間・月間ランキング。過去の日付のスナップショットも選べます。
- 2 つのレイアウト：順位順のカード一覧と、用途別のボード。
- プロジェクトごとに角丸のガラス風カード：アイコン、順位と順位の変化、中国語の紹介、言語、スター数、期間中に増えたスター数。
- 「爆发」（急上昇）バッジ：期間中に増えたスターが、絶対数でも総数に対する割合でも大きいプロジェクトに付きます。

**絞り込む**
- 検索（⌘K / Ctrl K）：名前、紹介、用途、技術スタックが対象です。
- 9 つのカテゴリ：AI とエージェント、開発ツール、フロントエンドと UI、セルフホスト、データとインフラ、セキュリティとプライバシー、モバイルとデスクトップ、学習と研究、その他。
- プログラミング言語で絞り込み。順位、総スター数、期間中の増加数で並べ替え。
- 期間・検索語・言語・カテゴリ・日付は URL に残るので、そのまま共有できます。

**見た目とスマートフォン**
- リキッドグラス風のデザインと 10 種類の配色（ダーク 6・ライト 4）。システムのライト／ダーク設定にも追従できます。
- iPhone 向けの調整：フローティングの下部バー、下から出るシート、セーフエリア対応。ホーム画面に追加してアプリのように使えます。
- システムの「視差効果を減らす」「透明度を下げる」設定に対応します。

**お気に入り**
- 今使っているブラウザに保存されます。アカウントは不要で、GitHub のスターとは同期しません。

## データの出どころ

収集スクリプト `collector/collect.py` は毎日 09:20（日本時間）に実行されます。期間ごとに 3 種類のソースから取得し、リポジトリの重複を除いて次の順に並べます。

| ソース | 内容 | ページ上のラベル |
| :--- | :--- | :--- |
| GitHub Trending（全言語） | Trending の全リスト。元の順位と期間中の増加スター数をそのまま使います | — |
| 言語別ページ | 12 言語（Python、TypeScript、JavaScript、Go、Rust、Java、C++、C、C#、Swift、Kotlin、PHP）それぞれの Trending から、全言語版にないプロジェクトを最大 5 件ずつ | 语言榜（言語別） |
| GitHub 検索 | 最近作られてスターが急増しているプロジェクト。日間は直近 7 日、週間は 30 日、月間は 90 日以内に作成されたもの。全体の上位 30 件に、8 つのトピックごとに最大 8 件を加えます | 新项目（新着） |

GitHub Trending は現在 1 ページに 8〜20 件ほどしか載らないため、残りの 2 つのソースが大部分を補っています。2026-10-30 のある回の収集では、日間 141 件、週間 150 件、月間 166 件、重複を除いて 385 件でした。

カテゴリは、プロジェクト名・説明・GitHub トピックのキーワードを点数化して決めます。AI 解説を設定している場合は、検証を通った AI の結果が優先されます。

あるソースが失敗しても、そのソースだけを飛ばします。ある期間の全言語版リストが取得できなかったときは、その期間の前回の完全なランキングを残し、取得日時をページに表示します。初回の収集から失敗した場合は、空のサイトを公開せずにエラーで止まります。

### 中国語の紹介文

各プロジェクトの紹介文は、次の順で最初に使えるものを採用し、ページにその出どころを必ず表示します。

| 順番 | 出どころ | ページ上のラベル |
| :--- | :--- | :--- |
| 1 | README を読んだ AI が生成し、形式を検証したもの（`LLM_*` の設定が必要） | README 解读（README 解説） |
| 2 | GithubTrending が公開している中国語の概要（7 日以内） | 中文速览（中国語概要） |
| 3 | 各プロジェクトの公開説明から作成した初期データ（`collector/editorial.json`）。説明が変わると使われません | 资料速览（資料概要） |
| 4 | MyMemory の無料 API による、プロジェクト自身の説明の機械翻訳 | 机器翻译（機械翻訳） |
| 5 | どれもない場合は元の説明を表示 | 解读待补充（準備中） |

機械翻訳は説明文のハッシュをキーに `public/data/translation-cache.json` へキャッシュされ、同じ説明は一度しか翻訳しません。1〜3 の内容を上書きすることもありません。テンプレートの文章を AI の分析として見せることはしません。

## ローカルで動かす

Node.js 24 と pnpm 10.30.3 が必要です。収集を実行するには Python 3.12 も必要です。

```bash
corepack pnpm install --frozen-lockfile
pnpm dev                 # 静的データモード：public/data/ の JSON を読み込みます
```

収集済みのデータがリポジトリに入っているので、フロントエンドを開くだけならデータベースもシークレットも不要です。

```bash
pnpm build:preview       # 静的ビルド。出力は dist/
pnpm typecheck           # 型チェック（自動インポートの型宣言を作るため、先に一度ビルドが必要）
pnpm exec vitest run shared/discovery.test.ts
```

収集の実行：

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r collector/requirements.txt
export GITHUB_TOKEN=あなたの個人トークン   # 任意。未設定だと、検索は期間ごとに全体クエリを 1 回だけ実行します
python collector/collect.py
python -m unittest discover -s collector -p 'test_*.py'
```

> ローカルで収集すると `public/data/` が書き換わります。このフォルダは毎日の収集ボットだけがコミットするので、試したあとは `git restore public/data && git clean -fd public/data` で元に戻してください。

## シークレット

収集は GitHub Actions で動くため、シークレットは Cloudflare ではなく **GitHub リポジトリ** の Settings → Secrets and variables → Actions に追加します。どれも任意です。

| 名前 | 用途 |
| :--- | :--- |
| `LLM_BASE_URL` | OpenAI Chat Completions 互換 API の HTTPS エンドポイント |
| `LLM_MODEL` | モデル名 |
| `LLM_API_KEY` | そのサービスの API キー |
| `MYMEMORY_EMAIL` | 機械翻訳用の連絡先メール。1 日の無料枠が 5,000 文字から 50,000 文字に増えます |

`LLM_*` の 3 つをすべて設定すると、各 README を読み込んで中国語の紹介、用途、技術スタック、見どころ、カテゴリを生成します。リクエストや検証に失敗した場合は既存の内容を残します。シークレットがフロントエンドやデータファイルに書き込まれることはありません。

検索に使う `GITHUB_TOKEN` は GitHub Actions が自動で用意するので、追加は不要です。

## デプロイ

本番環境は Cloudflare Pages で動いています。プロジェクト名は `github-discovery`、本番ブランチは `main` です。

| 設定 | 値 |
| :--- | :--- |
| ビルドコマンド | `npx --yes pnpm@10.30.3 install --frozen-lockfile && npm run build:preview` |
| 出力ディレクトリ | `dist` |
| Node のバージョン | `24` |
| データベース／環境変数 | 不要 |

収集ボットが新しいデータを `main` にコミットすると、Cloudflare がサイトを再ビルドします。ページの更新ボタンは公開済みのデータを読み直すだけで、収集を始めることはありません。

NewsNow の Nitro バックエンド（`server/`）は残してあります。必要なら `CF_PAGES=1 npm run build` で完全版をビルドできます。設定方法は [NewsNow の README](docs/NEWSNOW-README.ja-JP.md) を参照してください。本番環境では使っていません。

## ディレクトリ構成

| パス | 内容 |
| :--- | :--- |
| `src/components/discovery/` | トップページ：カード、絞り込み、配色、詳細、スタイル |
| `shared/discovery.ts` | ページと収集処理が共有するデータ形式、絞り込み、検証 |
| `collector/` | 収集、カテゴリ分け、中国語の紹介文、テスト、上流の解析処理 |
| `public/data/` | 最新ランキング、過去のスナップショット、AI と翻訳のキャッシュ |
| `.github/workflows/` | 毎日の収集と CI チェック |
| `server/` | 残してある NewsNow の Nitro バックエンド |

## 開発ルール

- `main` が本番の基準です。機能追加は `feat/<モジュール>`、修正は `fix/<問題>`、保守は `chore/<作業>` のブランチで行い、PR と CI を通してからマージします。詳しくは [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。
- CI（Discovery checks）は、フルビルド、型チェック、データ形式のテスト、収集処理のテスト、静的ビルドを順に実行し、`discovery-static-preview` のプレビューをアップロードします。
- データ形式は `shared/discovery.ts` にまとまっています。フィールドを変えるときは、収集の出力、検証、フロントエンド、テストを一緒に更新してください。
- `public/data/**` を `main` に直接コミットできるのは収集ボットだけです。

**ロールバック**：リニューアル前のソースは [`backup/radar-before-newsnow-20261026`](https://github.com/chenran71ran-oss/github-discovery/tree/backup/radar-before-newsnow-20261026) ブランチに残っています。戻す必要があるときは、まず Cloudflare Pages のデプロイ一覧で以前のデプロイに Rollback を実行してください。データベースやドメインを変更する必要はありません。

## クレジットとライセンス

- [NewsNow](https://github.com/newsnext/newsnow)：MIT。ライセンス全文は [LICENSE](LICENSE)。
- [GithubTrending](https://github.com/Ibook000/GithubTrending)：Apache-2.0。ライセンス全文は [collector/vendor/LICENSE](collector/vendor/LICENSE)。解析処理は改変せずに使っています。
- 変更点は [UPSTREAM.md](UPSTREAM.md) にまとめています。本プロジェクトは上流のソースを取り込んで発展させたもので、GitHub 上の正式なフォークではなく、上流プロジェクトの承認を受けたものでもありません。
- プロジェクトのアイコンは各リポジトリ所有者の GitHub アバター、ランキングのデータは GitHub から取得しています。
