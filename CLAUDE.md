# CLAUDE.md - TARA SISTER SNS自動投稿システム（Threads / X）

## プロジェクト概要
TARA SISTER（ウェルネス・ボディケアブランド）のSNS自動投稿システム。投稿先は Threads（@tara_sister_、2026-09 稼働中）と X（@Kuroe_cc、API 401 で停止中）。スクリプトプロパティ `POST_TARGETS`（threads / x / threads,x）で切替。
GitHub Pages + GAS Web App API 構成。ginzasugiden@gmail.com で完結。

## 既存リソース
- **スプレッドシート**: `12jG6r6WrUFbTdJfk86i9zdCxbc0ZP8tlBOojTDjQnBU`
- **GASプロジェクト**: 「TARA SISTER SNS投稿」scriptId `1PuLPZr3GOjOkYNlEwKTpxLED1uepFznOpoZzdGQBNhzPmpwOw0hOj00y`（.clasp.json と一致。`TARA_X_AutoPoster` は clasp create の副産物で未使用）
- **Web App**: デプロイ「Threads対応 v2」ID `AKfycbxHnbZxy1wvqUeK7idIGUvGBHrqzhX6Nx30IW0403l_hjkJRVOA25lkg0Uo5cNC5V7Ujg`（URL不変。更新は「デプロイを管理」→ 新バージョン）
- **Metaアプリ**: 「TARA SISTER SNS Research」(1373027731699171) の Threads API ユースケース。Threads App ID `1808465410150635`。テスター: @tara_sister_
- **本番フロント**: https://ts.ginzasugiden.com（GitHub Pages、リポジトリ直下の index.html / js / css。`web/` は旧コピーで未使用）
- **Xアカウント**: @Kuroe_cc（X Developer Console 設定済み）
- **ローカル**: `X:\projects\tarasister`

## アーキテクチャ
```
  クライアント（ブラウザ）           ginzasugiden@gmail.com
  ┌──────────────────┐            ┌──────────────────────────┐
  │  GitHub Pages     │  ──API──▶ │  GAS Web App              │
  │  gas-auth認証     │            │  ┌──────────────────────┐│
  │  ダッシュボード    │            │  │ doGet/doPost API     ││
  │  商品マスタ編集   │            │  │ 自動投稿(3hトリガー)  ││
  │  プロンプト調整   │            │  │ Claude/OpenAI AB生成  ││
  │  投稿ログ閲覧    │            │  │ Threads API 投稿      ││
                                   │  │ X API v2 投稿(停止中) ││
  │  AB分析          │            │  │ エンゲージメント取得   ││
  │                  │            │  │ BASE商品スクレイピング ││
  └──────────────────┘            │  └──────────────────────┘│
                                   │  📊 スプレッドシート      │
                                   │  🔐 スクリプトプロパティ  │
                                   └──────────────────────────┘
```

## ディレクトリ構造
```
tarasister/
├── CLAUDE.md
├── gas/                    ← GASバックエンド（clasp push対象）
│   ├── .clasp.json         ← 既存GASプロジェクトのスクリプトID
│   ├── appsscript.json
│   ├── main.js             ← APIエンドポイント + トリガー管理
│   ├── auth.js             ← gas-auth認証（.claspignore は許可リスト方式: 新規ファイルは !name.js を追記）
│   ├── poster.js           ← AI生成(Claude/OpenAI AB, Claude失敗時OpenAIへ) + X投稿
│   ├── threads.js          ← Threads OAuth / 投稿(本文+リプライ) / トークン更新 / インサイト
│   ├── sheets.js           ← スプレッドシートCRUD + セットアップ
│   ├── oauth.js            ← OAuth 1.0a署名
│   └── scraper.js          ← BASE商品スクレイピング（既存機能）
└── web/                    ← GitHub Pages
    ├── index.html
    ├── css/style.css
    └── js/
        ├── api.js          ← ★ BASE_URL をデプロイ後に設定
        ├── auth.js
        ├── app.js
        ├── products.js
        ├── prompts.js
        ├── logs.js
        └── analysis.js
```

## セットアップ手順

### STEP 1: clasp 設定
```bash
npm install -g @google/clasp
clasp login   # ginzasugiden@gmail.com でログイン
```

### STEP 2: .clasp.json にスクリプトIDを設定
GASエディタのURL `script.google.com/.../projects/XXXXX/edit` からIDをコピーし、
`gas/.clasp.json` の `scriptId` に設定。

### STEP 3: GASコードをアップロード
```bash
cd gas
clasp push    # 既存のコード.gs, tweet.gs は上書きされる
```
※ push前に既存ファイルを消す必要があれば `clasp open` でエディタから削除

### STEP 4: GASエディタで初期設定（ブラウザ）
1. `clasp open` でGASエディタを開く
2. `setupSpreadsheet` を実行
   → 認証/商品マスタ/投稿ログ/プロンプト/ステータスシートが作成される
   → 既存の商品一覧/Sheet1のデータは残る
   → ログイン情報: `tara-admin` / `tarasister2026`
3. ⚙️ プロジェクトの設定 → スクリプトプロパティ:
   - `X_CONSUMER_KEY` / `X_CONSUMER_SECRET` / `X_ACCESS_TOKEN` / `X_ACCESS_TOKEN_SECRET`
   - `THREADS_APP_ID` / `THREADS_APP_SECRET` / `THREADS_ACCESS_TOKEN` / `THREADS_USER_ID` / `THREADS_TOKEN_EXPIRES`
   - `POST_TARGETS` (threads / x / threads,x)
   - `CLAUDE_API_KEY` (sk-ant-...)  ※モデルは claude-sonnet-5-5、max_tokens 2000（拡張思考分）
   - `OPENAI_API_KEY` (sk-...)
   - `OPENAI_MODEL` (gpt-4o-mini)
   ※ 既存の X_API_KEY 等は X_CONSUMER_KEY 等に名前統一
4. 「デプロイ」→「新しいデプロイ」→ ウェブアプリ → URLコピー
5. `setupTrigger` を実行（3h投稿 / 毎朝9時エンゲージメント / 毎週月曜3時 Threadsトークン更新）

### STEP 5: フロントエンド設定
`web/js/api.js` の `BASE_URL` にデプロイURLを記入

### STEP 6: GitHub Pages デプロイ
```bash
cd web
git init && git add . && git commit -m "init"
git remote add origin https://github.com/ginzasugiden/tara-x-poster.git
git branch -M main && git push -u origin main
```
GitHub → Settings → Pages → main branch

### クライアントに渡すもの
- GitHub Pages URL
- ログイン: tara-admin / tarasister2026

## 開発コマンド
```bash
cd gas && clasp push           # GASデプロイ
cd gas && clasp pull           # GAS→ローカル同期
cd gas && clasp logs --watch   # ログ監視
cd gas && clasp open           # GASエディタ
```

## スプレッドシート構造（ID: 12jG6r6WrUFbTdJfk86i9zdCxbc0ZP8tlBOojTDjQnBU）

| シート | 用途 |
|--------|------|
| 認証 | gas-auth用。ユーザーID, Base64トークン, 権限, メモ |
| 商品マスタ | 商品名, 価格, カテゴリ, 特徴, ターゲット, URL, 画像URL |
| 投稿ログ | 日時, 商品名, カテゴリ, 使用API, 投稿文, 文字数, 投稿ID, ステータス, エラー, いいね, RT(リポスト), Imp(ビュー), 投稿先(M), 投稿URL(N) |
| プロンプト | B1:X用システム, B2:ユーザーテンプレート(共通), B3:Threads用システム（空ならB1） |
| ステータス | 最終実行日時, ステータス, 実行履歴 |
| 商品一覧 | スクレイパーが出力（既存）。refreshProducts で商品マスタに同期可能 |

## APIエンドポイント
`?action=XXX&tk=TOKEN` でアクセス（GASは `auth` パラメータを落とすため `tk`）
- getProducts / saveProduct / deleteProduct
- getPrompts / savePrompts
- getLogs (page, perPage)
- getAnalysis
- getStatus
- testGenerate (target=threads|x) / postNow
- getThreadsStatus / getThreadsAuthUrl / threadsExchange (code) / setPostTargets
- refreshProducts（BASEから商品再取得して商品マスタ更新）
- ping（認証不要）

## 注意事項
- 既存の `コード.gs` `tweet.gs` は clasp push で上書きされる（バックアップ推奨）
- スクリプトプロパティのキー名: X_API_KEY→X_CONSUMER_KEY に統一
- GAS再デプロイ時は「デプロイを管理」→バージョン更新（URL不変）
- X API: 2026-02 に無料投稿ティア廃止。現在 401（トークン無効）で停止中。復旧にはクレジット購入＋キー再発行が必要
- Threads API: 無料。250投稿/24h。画像投稿はコンテナ作成→公開の間に30秒待機（GAS側で sleep）
- 週次トリガーは `.onWeekDay()` 必須（everyWeeks だけだと例外）
- appsscript.json の timeZone は Asia/Tokyo（旧 America/New_York は日次トリガーの時刻ずれの原因）
- 運用・保守手順: docs/maintenance.md
