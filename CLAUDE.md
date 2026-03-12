# CLAUDE.md - TARA SISTER X自動投稿システム

## プロジェクト概要
TARA SISTER（ウェルネス・ボディケアブランド @Kuroe_cc）のX自動投稿システム。
GitHub Pages + GAS Web App API 構成。ginzasugiden@gmail.com で完結。

## 既存リソース
- **スプレッドシート**: `12jG6r6WrUFbTdJfk86i9zdCxbc0ZP8tlBOojTDjQnBU`
- **GASプロジェクト**: TARA SISTER（既存。スクリプトIDは .clasp.json に記載）
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
  │  投稿ログ閲覧    │            │  │ X API v2 投稿         ││
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
│   ├── auth.js             ← gas-auth認証
│   ├── poster.js           ← AI生成(Claude/OpenAI AB) + X投稿
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
   - `CLAUDE_API_KEY` (sk-ant-...)
   - `OPENAI_API_KEY` (sk-...)
   - `OPENAI_MODEL` (gpt-4o-mini)
   ※ 既存の X_API_KEY 等は X_CONSUMER_KEY 等に名前統一
4. 「デプロイ」→「新しいデプロイ」→ ウェブアプリ → URLコピー
5. `setupTrigger` を実行

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
| 投稿ログ | 日時, 商品名, カテゴリ, 使用API, 投稿文, 文字数, ツイートID, ステータス, エラー, いいね, RT, Imp |
| プロンプト | B1:システムプロンプト, B2:ユーザープロンプト |
| ステータス | 最終実行日時, ステータス, 実行履歴 |
| 商品一覧 | スクレイパーが出力（既存）。refreshProducts で商品マスタに同期可能 |

## APIエンドポイント
`?action=XXX&auth=TOKEN` でアクセス
- getProducts / saveProduct / deleteProduct
- getPrompts / savePrompts
- getLogs (page, perPage)
- getAnalysis
- getStatus
- testGenerate / postNow
- refreshProducts（BASEから商品再取得して商品マスタ更新）
- ping（認証不要）

## 注意事項
- 既存の `コード.gs` `tweet.gs` は clasp push で上書きされる（バックアップ推奨）
- スクリプトプロパティのキー名: X_API_KEY→X_CONSUMER_KEY に統一
- GAS再デプロイ時は「デプロイを管理」→バージョン更新（URL不変）
- X API Free: 月1,500ツイート上限
