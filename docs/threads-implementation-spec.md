# TARA SISTER SNS投稿 — Threads自動投稿 実装指示書

対象リポジトリ: `X:\projects\tarasister`
対象GAS: `TARA SISTER SNS投稿`（scriptId `1PuLPZr3GOjOkYNlEwKTpxLED1uepFznOpoZzdGQBNhzPmpwOw0hOj00y` = `gas/.clasp.json` と一致）
フロント: `ts.ginzasugiden.com`（GitHub Pages、ルート直下の `index.html` / `js/` / `css/` が本番。`web/` は旧コピー）

## 0. 目的と方針

- X API が 401（トークン無効化）で停止中。**Threads を第2の投稿先として追加**し、当面は Threads のみで自動投稿を回す。
- X のコード（`oauth.js` / `postToX_` / `getTweetMetrics_`）は削除せず残す。投稿先はスクリプトプロパティ `POST_TARGETS` で切替（`threads` / `x` / `both`、既定 `threads`）。
- 既存の構成（GitHub Pages → GAS Web App、`tk` 認証、JSONP不要の fetch）はそのまま。新規エンドポイントは `handleRequest_` の switch に追加する。
- Threads API は無料。制限は 250投稿/24h、コンテナ作成→公開の間に約30秒待つことが推奨。

## 1. Meta側の手動セットアップ（2026-09-29 完了済み）

確定値:
- Metaアプリ: 「TARA SISTER SNS Research」（アプリID 1373027731699171、ビジネス tarasister_kirei.time）に Threads API ユースケースを追加済み
- **Threads App ID: `1808465410150635`**（`THREADS_APP_ID`）。App Secret は同画面の「Threadsのapp secret」を `THREADS_APP_SECRET` に
- Redirect / Uninstall / Delete Callback URL: すべて `https://ts.ginzasugiden.com/threads-callback.html`
- Threadsテスター: **`@tara_sister_`**（招待・承諾済み）
- 権限: threads_basic / threads_content_publish / threads_manage_replies / threads_manage_insights

以下は参考手順（実施済み）。

1. Meta for Developers（GSDアカウント）→ 既存アプリ「TARA SISTER SNS Research」→ **ユースケースを追加 → Threads API** を追加（新規アプリ作成より確実。以前 v2 で権限が付かなかった経緯あり）。
2. 「Threads API」ユースケースの設定画面で **Threads App ID / Threads App Secret** を控える（Facebook App ID とは別物なので注意）。
3. 権限: `threads_basic`, `threads_content_publish`, `threads_manage_replies`（リプライ投稿用）, `threads_manage_insights`（エンゲージメント取得用）を有効化。
4. **Redirect Callback URL** に `https://ts.ginzasugiden.com/threads-callback.html` を登録。Uninstall/Delete Callback URL は同じURLで可。
5. アプリのロール → **Threads テスター** に TARA SISTER の Threads アカウント（Instagram `tarasister_kirei.time` 連動のもの）を招待。招待は Threads アプリ側「設定 → アカウント → ウェブサイトの権限 → 招待」で承諾が必要。テスターなら審査なしで投稿できる。
6. 落とし穴: 2025年夏以降、開発者アカウントの電話番号認証で詰まる報告が多い。既存アプリの流用で回避できる見込み。

## 2. GAS 変更

### 2-1. `gas/appsscript.json`
- `timeZone` を `"America/New_York"` → `"Asia/Tokyo"` に修正（`atHour(9)` の日次トリガーがNY時間で動いているバグ）。

### 2-2. 新規 `gas/threads.js`

スクリプトプロパティ:
`THREADS_APP_ID`, `THREADS_APP_SECRET`, `THREADS_ACCESS_TOKEN`, `THREADS_USER_ID`, `THREADS_TOKEN_EXPIRES`（ISO文字列）

```js
const THREADS_API = 'https://graph.threads.net/v1.0';

// --- OAuth ---
// 認可URL（フロントに返す）
function getThreadsAuthUrl_() {
  const appId = prop_('THREADS_APP_ID');
  if (!appId) throw new Error('THREADS_APP_ID 未設定');
  const redirect = 'https://ts.ginzasugiden.com/threads-callback.html';
  const scope = 'threads_basic,threads_content_publish,threads_manage_replies,threads_manage_insights';
  return 'https://threads.net/oauth/authorize?client_id=' + appId
    + '&redirect_uri=' + encodeURIComponent(redirect)
    + '&scope=' + scope + '&response_type=code';
}

// code → 短期トークン → 長期トークン(60日) を保存
function exchangeThreadsCode_(code) {
  code = String(code || '').replace(/#_$/, '');          // Threadsは末尾に #_ を付ける
  const appId = prop_('THREADS_APP_ID'), secret = prop_('THREADS_APP_SECRET');
  const redirect = 'https://ts.ginzasugiden.com/threads-callback.html';
  // 1) 短期
  let res = UrlFetchApp.fetch(THREADS_API.replace('/v1.0','') + '/oauth/access_token', {
    method:'post',
    payload:{ client_id:appId, client_secret:secret, grant_type:'authorization_code', redirect_uri:redirect, code:code },
    muteHttpExceptions:true });
  let r = JSON.parse(res.getContentText());
  if (!r.access_token) throw new Error('Threads短期トークン取得失敗: ' + res.getContentText());
  const userId = String(r.user_id);
  // 2) 長期
  res = UrlFetchApp.fetch(THREADS_API.replace('/v1.0','') + '/access_token?grant_type=th_exchange_token&client_secret='
    + encodeURIComponent(secret) + '&access_token=' + encodeURIComponent(r.access_token), { muteHttpExceptions:true });
  r = JSON.parse(res.getContentText());
  if (!r.access_token) throw new Error('Threads長期トークン取得失敗: ' + res.getContentText());
  saveThreadsToken_(r.access_token, r.expires_in, userId);
  return getThreadsStatus_();
}

function saveThreadsToken_(token, expiresIn, userId) {
  const p = PropertiesService.getScriptProperties();
  p.setProperty('THREADS_ACCESS_TOKEN', token);
  p.setProperty('THREADS_TOKEN_EXPIRES', new Date(Date.now() + Number(expiresIn)*1000).toISOString());
  if (userId) p.setProperty('THREADS_USER_ID', userId);
}

// 週次トリガー: 期限まで14日を切ったら更新（長期トークンは24時間以上経過後に更新可）
function refreshThreadsToken() {
  const token = prop_('THREADS_ACCESS_TOKEN'); if (!token) return;
  const exp = new Date(prop_('THREADS_TOKEN_EXPIRES') || 0);
  if (exp - Date.now() > 14*86400e3) return;
  const res = UrlFetchApp.fetch(THREADS_API.replace('/v1.0','') + '/refresh_access_token?grant_type=th_refresh_token&access_token='
    + encodeURIComponent(token), { muteHttpExceptions:true });
  const r = JSON.parse(res.getContentText());
  if (r.access_token) { saveThreadsToken_(r.access_token, r.expires_in); updateStatus_('🔑 Threadsトークン更新'); }
  else updateStatus_('❌ Threadsトークン更新失敗: ' + res.getContentText());
}

function getThreadsStatus_() {
  return { connected: !!prop_('THREADS_ACCESS_TOKEN'), userId: prop_('THREADS_USER_ID'),
           expires: prop_('THREADS_TOKEN_EXPIRES'), targets: prop_('POST_TARGETS') || 'threads' };
}

// --- 投稿 ---
// opts: { imageUrl, linkUrl, replyToId }
// 戻り値: 公開後の media id
function postToThreads_(text, opts) {
  opts = opts || {};
  const token = prop_('THREADS_ACCESS_TOKEN'), uid = prop_('THREADS_USER_ID');
  if (!token || !uid) throw new Error('Threads未連携');
  const payload = { text: text, access_token: token };
  if (opts.imageUrl) { payload.media_type = 'IMAGE'; payload.image_url = opts.imageUrl; }
  else { payload.media_type = 'TEXT'; if (opts.linkUrl) payload.link_attachment = opts.linkUrl; }
  if (opts.replyToId) payload.reply_to_id = opts.replyToId;

  let res = UrlFetchApp.fetch(THREADS_API + '/' + uid + '/threads', { method:'post', payload, muteHttpExceptions:true });
  let r = JSON.parse(res.getContentText());
  if (!r.id) throw new Error('Threads API (create ' + res.getResponseCode() + '): ' + res.getContentText());

  Utilities.sleep(opts.imageUrl ? 30000 : 5000);   // 公式推奨: 平均30秒待機（画像時）。テキストは短くて可

  res = UrlFetchApp.fetch(THREADS_API + '/' + uid + '/threads_publish',
    { method:'post', payload:{ creation_id:r.id, access_token:token }, muteHttpExceptions:true });
  r = JSON.parse(res.getContentText());
  if (!r.id) throw new Error('Threads API (publish ' + res.getResponseCode() + '): ' + res.getContentText());
  return r.id;
}

function getThreadsInsights_(mediaId) {
  const token = prop_('THREADS_ACCESS_TOKEN');
  const res = UrlFetchApp.fetch(THREADS_API + '/' + mediaId + '/insights?metric=views,likes,replies,reposts,quotes&access_token='
    + encodeURIComponent(token), { muteHttpExceptions:true });
  const r = JSON.parse(res.getContentText());
  if (!r.data) return null;
  const m = {}; r.data.forEach(d => { m[d.name] = (d.values && d.values[0] && d.values[0].value) || 0; });
  return m;   // {views, likes, replies, reposts, quotes}
}
```

### 2-3. `gas/poster.js` — 文章生成を投稿先別に

- `generateTweetText_(product, target)` にする。`target === 'threads'` のときは:
  - プロンプトシート **B3（Threads用システムプロンプト）** を使う。B3が空なら B1 を使う。
  - 140字トリムは行わない（Threads上限 500字）。500字超なら 497字 + `...`。
- ユーザーテンプレート（B2）は共通。`{{画像URL}}` プレースホルダも置換対象に追加。

### 2-4. `gas/main.js` — 投稿の振り分け

`postTweet()`（トリガー名は互換のため維持）と `postTweetManual_()` を共通化:

```js
function runPost_(manual) {
  const targets = (prop_('POST_TARGETS') || 'threads').split(',').map(s => s.trim());
  const product = getRandomProduct_();
  const results = [];
  targets.forEach(t => {
    let text='', api='', id='';
    try {
      const r = generateTweetText_(product, t); text = r.tweetText; api = r.apiUsed;
      if (t === 'x') {
        if (text.length > 140) text = text.substring(0,137) + '...';
        id = postToX_(text);
        Utilities.sleep(3000);
        try { postToX_(replyText_(product), id); } catch(e) { Logger.log('Xリプライ: '+e.message); }
      } else {
        // Threads: 画像があれば画像投稿、なければリンクプレビュー付きテキスト
        id = postToThreads_(text, product['画像URL'] ? { imageUrl: product['画像URL'] } : { linkUrl: product['URL'] });
        try { postToThreads_(replyText_(product), { replyToId: id }); } catch(e) { Logger.log('Threadsリプライ: '+e.message); }
      }
      writeLog_(product, text, api, id, '成功', '', t);
      results.push({ target:t, ok:true, id, text, api });
    } catch (err) {
      writeLog_(product, text, api, '', '失敗', err.message, t);
      results.push({ target:t, ok:false, error: err.message });
    }
  });
  const okN = results.filter(r=>r.ok).length;
  updateStatus_((okN ? '✅ ' : '❌ ') + product['商品名'] + ' → ' + results.map(r => r.target + (r.ok ? ' OK' : ' NG: ' + r.error)).join(' / '));
  return { product: product['商品名'], results };
}
function replyText_(p) { return '🛒 ' + p['商品名'] + '\n💰 ' + p['価格'] + '\n\n詳細はこちら👇\n' + p['URL']; }
function postTweet() { try { runPost_(false); } catch(e) { updateStatus_('❌ ' + e.message); } }
function postTweetManual_() { return runPost_(true); }
```

新規エンドポイント（switch に追加、いずれも `tk` 認証必須）:

| action | 処理 |
|---|---|
| `getThreadsStatus` | `getThreadsStatus_()` |
| `getThreadsAuthUrl` | `{ url: getThreadsAuthUrl_() }` |
| `threadsExchange` | `exchangeThreadsCode_(p.code)`（GETクエリ `code` で受ける） |
| `setPostTargets` | `post.targets` を `POST_TARGETS` に保存（`threads`/`x`/`both`→`threads,x`） |
| `testGenerate` | `p.target`（既定 threads）を渡して生成 |

`setupTrigger()` に `ScriptApp.newTrigger('refreshThreadsToken').timeBased().everyWeeks(1).create();` を追加し、削除対象リストにも `refreshThreadsToken` を含める。

### 2-5. `gas/sheets.js`

- 投稿ログシート: **M列 `投稿先`**、**N列 `投稿URL`** を追加（`setupSpreadsheet` は既存ヘッダーが12列のときだけ M1:N1 を追記。既存行は空のまま＝X扱い）。
  - `writeLog_(product, text, api, id, status, err, target)`: 13列目に `target`（`x` / `threads`）、14列目に URL（Threadsは `https://www.threads.net/@<ハンドル>/post/` の shortcode が API から取れないため、`threads` の場合は空でよい。将来 `GET /{media-id}?fields=permalink` で取得可能なので、取得できたら入れる）。
  - `getLogs_` は既存のヘッダー走査で自動的に新列を含む。
- `updateEngagement()`: 13列目が `threads` の行は `getThreadsInsights_(id)` を呼び、J=likes、K=reposts、L=views に書く（列の意味は「いいね / RT(リポスト) / インプレッション(ビュー)」として共用）。空欄 or `x` の行は従来通り。X側が401のときは行ごとにエラーを投げ続けるので、**X用は1回失敗したらその実行内では以降スキップ**する。
- `getAnalysis_()`: 戻り値に `byTarget: { x: {count, avgLikes,...}, threads: {...} }` を追加（`calc()` を再利用）。既存フィールドは変更しない。
- プロンプトシート: `setupSpreadsheet` で A3=「Threads用システムプロンプト」、B3 が空なら以下の初期値を入れる（既存シートには追記のみ）:

```
あなたはTARA SISTERというウェルネス・ボディケアブランドのSNSマーケターです。
ブランドコンセプト: 日本古来の知恵（禊・お茶・天然素材）を現代の美容に昇華。
トーン: 上品で温かみがあり、押しつけがましくない。Threads向けに、会話のきっかけになる一言や問いかけを入れる。
投稿ルール:
- 日本語200〜300文字。改行を使って読みやすく
- ハッシュタグは付けない（Threadsでは効果が薄い）
- URLは含めない（リプライで送る）
- 毎回違う切り口。薬機法NG表現を避ける
- 絵文字は2〜4個
```

## 3. フロントエンド変更（ルート直下 `index.html` / `js/`）

### 3-1. 新規 `threads-callback.html`（リポジトリ直下）
Threads からのリダイレクト先。`?code=XXX#_` を受け取り、sessionStorage の `tara_x_auth` トークンで `API.request('threadsExchange', null, { code })` を叩き、結果を表示して `index.html` に戻すリンクを出す。ログインしていない（トークンなし）場合は「先にログインしてから連携ボタンを押してください」を表示。`js/api.js` と `js/auth.js` を読み込む。

### 3-2. ダッシュボード（`index.html` + `js/app.js`）
- ステータスカードの隣に **「Threads連携」カード**を追加: 連携状態（未連携 / 連携済み・期限 yyyy/mm/dd）、「Threadsと連携する」ボタン（`getThreadsAuthUrl` → `location.href`）。
- **投稿先セレクタ**（`threads` / `x` / `both`）を追加し、変更時に `setPostTargets`。
- 「今すぐ投稿」の confirm 文言を「{投稿先}に投稿します。よろしいですか？」に。結果表示は `results[]` をループして投稿先ごとに OK/NG を出す。
- 「テスト生成」は現在の投稿先（`both` なら threads）で生成。
- ヘッダーのサブタイトル `X Auto Post Management` → `SNS Auto Post Management`。`<title>` も「TARA SISTER - SNS投稿管理」に。

### 3-3. 投稿ログ / 分析（`js/logs.js`, `js/analysis.js`）
- ログ一覧に「投稿先」列を追加（空欄は `X` 表示）。
- 分析ページに「投稿先別」の小テーブル（`byTarget`）を追加。既存の Claude/OpenAI 比較はそのまま。

## 4. デプロイ手順（Claude Code が実行するもの／手動のもの）

1. `cd X:\projects\tarasister\gas && clasp push --force`
2. **手動**: GASエディタ → デプロイ → 「デプロイを管理」→ 新バージョンでデプロイ（URL不変）。`clasp push` だけでは `/exec` は更新されない。
3. **手動**: スクリプトプロパティに `THREADS_APP_ID` / `THREADS_APP_SECRET` / `POST_TARGETS=threads` を設定。
4. **手動**: GASエディタで `setupSpreadsheet` を実行（ログ列・B3追記）→ `setupTrigger` を実行（3h投稿・日次エンゲージメント・週次トークン更新の3本）。
5. `git add -A && git commit && git push`（GitHub Pages 反映）。
6. **手動**: ts.ginzasugiden.com にログイン → 「Threadsと連携する」→ TARA SISTER の Threads アカウントで承認 → 戻ってきたら「連携済み」表示を確認 → 「今すぐ投稿」で1件テスト。

## 5. 受け入れ条件

- [ ] 「Threadsと連携する」→ 承認 → 連携済み表示（期限が約60日後）
- [ ] 「今すぐ投稿」で Threads に本文投稿＋URL付きリプライが付く
- [ ] 投稿ログに `投稿先=threads` で1行、ステータス成功
- [ ] `POST_TARGETS=x` にすると従来の X 経路が呼ばれ、401 がログに残る（回帰なし）
- [ ] 翌朝9時 JST に `updateEngagement` が走り、Threads行に views/likes が入る
- [ ] `refreshThreadsToken` を手動実行してもエラーにならない（期限14日超なら何もしない）

## 6. 参考

- Threads API 概要: https://developers.facebook.com/docs/threads
- 投稿: https://developers.facebook.com/docs/threads/posts
- 長期トークン: https://developers.facebook.com/docs/threads/get-started/long-lived-tokens
- リプライ: https://developers.facebook.com/docs/threads/reply-management
- インサイト: https://developers.facebook.com/docs/threads/insights
