# TARA SISTER SNS自動投稿 — 運用・保守手順

最終更新: 2026-09-29（Threads 本番稼働開始日）

## 現在の稼働状態

| 項目 | 状態 |
|---|---|
| 投稿先 | Threads `@tara_sister_`（`POST_TARGETS=threads`） |
| X `@Kuroe_cc` | 停止中（API 401）。コードは残置、`POST_TARGETS` に `x` を含めれば再開 |
| 自動投稿 | 3時間おき（`postTweet` トリガー） |
| エンゲージメント取得 | 毎朝9時 JST（`updateEngagement`、投稿後24〜168hの行が対象） |
| トークン更新 | 毎週月曜3時 JST（`refreshThreadsToken`、期限14日前から更新） |
| Web App | バージョン26（2026-09-29）、URL不変 |
| 管理画面 | https://ts.ginzasugiden.com（tara-admin） |

## 日常の確認（週1回・5分）

1. 管理画面 → ダッシュボード → ステータスカードが「✅ …」になっているか（「❌」ならエラー内容を読む）
2. 投稿ログ → 直近の行が「成功」か。「失敗」が続いていたら「エラー内容」列を確認
3. Threads アプリで `@tara_sister_` の投稿を目視（本文＋URLリプライの2段になっているか、内容が変でないか）
4. 分析タブ → Claude / OpenAI の投稿数が極端に偏っていないか（Claude側が0ならAPIキーか max_tokens を疑う）

## 定期メンテナンス

### 毎月
- **商品マスタの棚卸し**: 商品マスタタブで、終売商品の削除・新商品の追加。「特徴」列にBASEの決済案内（PAY ID あと払い等）や誤った容量・価格が混ざっていたら手で削る（投稿文にそのまま出る）
- **プロンプト調整**: プロンプトタブ B3（Threads用）。投稿の反応を見て切り口・長さ・絵文字量を調整。変更は即時反映（デプロイ不要）

### 2026-11 中旬（初回のみ）
- 現在のトークンはMeta管理画面の「ユーザートークン生成ツール」で手動投入したもの。管理画面の「Threadsと連携する」→ `@tara_sister_` でログイン→承認 で OAuth 経由に切り替える。以降は `THREADS_TOKEN_EXPIRES` が正確に入り、週次更新が完全自動になる
- 目安: `THREADS_TOKEN_EXPIRES` は初回の週次実行で「50日後」が仮設定される（2026-11-17 前後）

### 60日ごと（自動、確認のみ）
- 週次トリガーがトークンを更新する。ステータス履歴（ステータスシート）に「🔑 Threadsトークン更新」が出ていればOK
- 「❌ Threadsトークン更新失敗」が出たら → 上の OAuth 再連携を実施

## トラブル時の対応

| 症状 | 原因の当たり | 対処 |
|---|---|---|
| ログイン「認証エラー」 | 認証シートB2とパスワード不一致 | `setupSpreadsheet` を実行すると tara-admin / tarasister2026 で再生成 |
| ステータス `Threads未連携` | トークンかユーザーIDが空 | 管理画面から「Threadsと連携する」 |
| `Threads API (create 400)` に `OAuthException` / `code 190` | トークン失効 | 「Threadsと連携する」で再取得 |
| `Threads API (create 400)` に `image_url` 関連 | 商品画像URLが非公開 or 取得不可 | 商品マスタの画像URLを確認。空にすればテキスト＋リンクプレビュー投稿にフォールバック |
| `Claude: ...` エラーが続く | APIキー失効 / モデル廃止 | OpenAI に自動フォールバックするので投稿は止まらない。`poster.js` の model 名を最新に |
| `OpenAI: ...` エラー | APIキー失効 / 残高不足 | OpenAI ダッシュボードで確認 |
| 投稿が3時間おきに来ない | トリガーが消えた / 実行失敗が続いて自動停止 | GASエディタ ⏰ トリガー画面で確認 → `setupTrigger` を再実行 |
| 250件/24hエラー | Threads のレート上限 | 通常運用（1日8件）では到達しない。手動投稿を連打しない |
| 管理画面が古い表示 | GitHub Pages のキャッシュ | Ctrl+F5。反映は push 後1〜2分 |

## コード変更の手順

```
cd X:\projects\tarasister\gas
clasp push --force          # GAS に反映（Pushed 8 files の時刻が新しいことを確認）
```
→ GASエディタ → デプロイ → **デプロイを管理** → 鉛筆 → バージョン「新バージョン」→ デプロイ
（`clasp push` だけでは /exec は更新されない。トリガー関数はデプロイ不要で即反映）

フロント（index.html / js / css）は `git push` で GitHub Pages に反映。

新しい .js ファイルを追加したら `gas/.claspignore` に `!ファイル名.js` を追記（許可リスト方式）。

## X を再開する場合

1. X Developer Portal でクレジット購入（2026-02 以降は従量課金のみ）
2. アプリのキーとトークンを再発行 → スクリプトプロパティの `X_*` 4つを差し替え
3. 管理画面の投稿先セレクタを「both」に（`POST_TARGETS=threads,x`）
4. 「今すぐ投稿」で1件テスト → 投稿ログの X 行が成功になれば復旧

## 今後の改善候補（優先度順）

1. **スクレイパーの抽出精度**: `scraper.js` が BASE 商品ページの決済案内まで「特徴」に取り込んでいる。商品説明ブロックだけに絞る
2. **投稿URL（N列）の取得**: `GET /{media-id}?fields=permalink` で Threads の投稿URLをログに残す（現在は空）
3. **Claude Code への依頼時の注意**: エディタで直接直した場合は `clasp pull` でローカルに同期してから commit。逆にローカルを直したら必ず `clasp push`
4. **Threads の返信監視**: `threads_manage_replies` は取得済みなので、リプライを Chatwork に通知する拡張が可能（SNS競合リサーチDBと同じ流儀）
5. **Instagram 連携**: 同じ Meta アプリに Instagram Graph API ユースケースを足せば、同じ商品マスタから画像投稿を流せる
