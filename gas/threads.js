/**
 * Threads API 連携（OAuth / 投稿 / インサイト）
 * スクリプトプロパティ: THREADS_APP_ID, THREADS_APP_SECRET, THREADS_ACCESS_TOKEN, THREADS_USER_ID, THREADS_TOKEN_EXPIRES
 */

const THREADS_API = 'https://graph.threads.net/v1.0';
const THREADS_ROOT = 'https://graph.threads.net';
const THREADS_REDIRECT = 'https://ts.ginzasugiden.com/threads-callback.html';

// --- OAuth ---
// 認可URL（フロントに返す）
function getThreadsAuthUrl_() {
  const appId = prop_('THREADS_APP_ID');
  if (!appId) throw new Error('THREADS_APP_ID 未設定');
  const scope = 'threads_basic,threads_content_publish,threads_manage_replies,threads_manage_insights';
  return 'https://threads.net/oauth/authorize?client_id=' + appId
    + '&redirect_uri=' + encodeURIComponent(THREADS_REDIRECT)
    + '&scope=' + scope + '&response_type=code';
}

// code → 短期トークン → 長期トークン(60日) を保存
function exchangeThreadsCode_(code) {
  code = String(code || '').replace(/#_$/, '');          // Threadsは末尾に #_ を付ける
  if (!code) throw new Error('code がありません');
  const appId = prop_('THREADS_APP_ID'), secret = prop_('THREADS_APP_SECRET');
  if (!appId || !secret) throw new Error('THREADS_APP_ID / THREADS_APP_SECRET 未設定');
  // 1) 短期
  let res = UrlFetchApp.fetch(THREADS_ROOT + '/oauth/access_token', {
    method: 'post',
    payload: { client_id: appId, client_secret: secret, grant_type: 'authorization_code', redirect_uri: THREADS_REDIRECT, code: code },
    muteHttpExceptions: true });
  let r = JSON.parse(res.getContentText());
  if (!r.access_token) throw new Error('Threads短期トークン取得失敗: ' + res.getContentText());
  const userId = String(r.user_id);
  // 2) 長期
  res = UrlFetchApp.fetch(THREADS_ROOT + '/access_token?grant_type=th_exchange_token&client_secret='
    + encodeURIComponent(secret) + '&access_token=' + encodeURIComponent(r.access_token), { muteHttpExceptions: true });
  r = JSON.parse(res.getContentText());
  if (!r.access_token) throw new Error('Threads長期トークン取得失敗: ' + res.getContentText());
  saveThreadsToken_(r.access_token, r.expires_in, userId);
  return getThreadsStatus_();
}

function saveThreadsToken_(token, expiresIn, userId) {
  const p = PropertiesService.getScriptProperties();
  p.setProperty('THREADS_ACCESS_TOKEN', token);
  p.setProperty('THREADS_TOKEN_EXPIRES', new Date(Date.now() + Number(expiresIn) * 1000).toISOString());
  if (userId) p.setProperty('THREADS_USER_ID', userId);
}

// 週次トリガー: 期限まで14日を切ったら更新（長期トークンは24時間以上経過後に更新可）
function refreshThreadsToken() {
  const token = prop_('THREADS_ACCESS_TOKEN'); if (!token) return;
  const exp = new Date(prop_('THREADS_TOKEN_EXPIRES') || 0);
  if (exp - Date.now() > 14 * 86400e3) return;
  const res = UrlFetchApp.fetch(THREADS_ROOT + '/refresh_access_token?grant_type=th_refresh_token&access_token='
    + encodeURIComponent(token), { muteHttpExceptions: true });
  const r = JSON.parse(res.getContentText());
  if (r.access_token) { saveThreadsToken_(r.access_token, r.expires_in); updateStatus_('🔑 Threadsトークン更新'); }
  else updateStatus_('❌ Threadsトークン更新失敗: ' + res.getContentText());
}

function getThreadsStatus_() {
  return { connected: !!prop_('THREADS_ACCESS_TOKEN'), userId: prop_('THREADS_USER_ID'),
           expires: prop_('THREADS_TOKEN_EXPIRES'), targets: prop_('POST_TARGETS') || 'threads' };
}

// POST_TARGETS へ保存。threads / x / both を受け付ける
function setPostTargets_(targets) {
  const t = String(targets || '').trim();
  const v = t === 'both' ? 'threads,x' : t;
  if (!['threads', 'x', 'threads,x'].includes(v)) throw new Error('不正な投稿先: ' + t);
  PropertiesService.getScriptProperties().setProperty('POST_TARGETS', v);
  return getThreadsStatus_();
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

  let res = UrlFetchApp.fetch(THREADS_API + '/' + uid + '/threads', { method: 'post', payload: payload, muteHttpExceptions: true });
  let r = JSON.parse(res.getContentText());
  if (!r.id) throw new Error('Threads API (create ' + res.getResponseCode() + '): ' + res.getContentText());

  Utilities.sleep(opts.imageUrl ? 30000 : 5000);   // 公式推奨: 平均30秒待機（画像時）。テキストは短くて可

  res = UrlFetchApp.fetch(THREADS_API + '/' + uid + '/threads_publish',
    { method: 'post', payload: { creation_id: r.id, access_token: token }, muteHttpExceptions: true });
  r = JSON.parse(res.getContentText());
  if (!r.id) throw new Error('Threads API (publish ' + res.getResponseCode() + '): ' + res.getContentText());
  return r.id;
}

function getThreadsInsights_(mediaId) {
  const token = prop_('THREADS_ACCESS_TOKEN');
  const res = UrlFetchApp.fetch(THREADS_API + '/' + mediaId + '/insights?metric=views,likes,replies,reposts,quotes&access_token='
    + encodeURIComponent(token), { muteHttpExceptions: true });
  const r = JSON.parse(res.getContentText());
  if (!r.data) return null;
  const m = {}; r.data.forEach(d => { m[d.name] = (d.values && d.values[0] && d.values[0].value) || 0; });
  return m;   // {views, likes, replies, reposts, quotes}
}
