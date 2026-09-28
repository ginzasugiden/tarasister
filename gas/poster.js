/**
 * AI文章生成 (Claude/OpenAI ABテスト) + X API投稿
 * ※ 既存 tweet.gs のロジックを統合・拡張
 */

function prop_(key) { return PropertiesService.getScriptProperties().getProperty(key) || ''; }

// 商品名の整形: BASEのページタイトル末尾「 | TARA SISTER powered by BASE」等を除去
function cleanName_(name) {
  return String(name || '').replace(/\s*[|｜]\s*TARA SISTER.*$/i, '').replace(/\s*[|｜].*powered by BASE.*$/i, '').trim();
}

function generateTweetText_(product, target) {
  const { systemPrompt, userTemplate } = getPromptTemplate_(target);
  const useClaude = Math.random() < 0.5;
  const apiUsed = useClaude ? 'Claude' : 'OpenAI';

  const userPrompt = userTemplate
    .replace(/\{\{商品名\}\}/g, cleanName_(product['商品名']))
    .replace(/\{\{価格\}\}/g, product['価格']||'')
    .replace(/\{\{特徴\}\}/g, product['特徴']||'')
    .replace(/\{\{ターゲット\}\}/g, product['ターゲット']||'')
    .replace(/\{\{URL\}\}/g, product['URL']||'')
    .replace(/\{\{カテゴリ\}\}/g, product['カテゴリ']||'')
    .replace(/\{\{画像URL\}\}/g, product['画像URL']||'');

  let tweetText, api = apiUsed;
  if (useClaude) {
    try { tweetText = callClaude_(systemPrompt, userPrompt); }
    catch (e) { Logger.log('Claude失敗→OpenAIへフォールバック: ' + e.message); tweetText = callOpenAI_(systemPrompt, userPrompt); api = 'OpenAI'; }
  } else {
    tweetText = callOpenAI_(systemPrompt, userPrompt);
  }

  // Threads は上限500字
  if (target === 'threads' && tweetText.length > 500) tweetText = tweetText.substring(0, 497) + '...';

  return { tweetText, apiUsed: api };
}

function callClaude_(sys, user) {
  const key = prop_('CLAUDE_API_KEY');
  if (!key) throw new Error('CLAUDE_API_KEY 未設定');
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method:'post', contentType:'application/json',
    headers: { 'x-api-key':key, 'anthropic-version':'2023-06-01' },
    payload: JSON.stringify({ model:'claude-sonnet-5-5', max_tokens:2000, system:sys, messages:[{role:'user',content:user}] }),
    muteHttpExceptions:true
  });
  const r = JSON.parse(res.getContentText());
  if (r.error) throw new Error('Claude: '+r.error.message);
  const text = (r.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
  if (!text) throw new Error('Claude: テキスト応答なし: ' + res.getContentText().slice(0, 300));
  return text;
}

function callOpenAI_(sys, user) {
  const key = prop_('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY 未設定');
  const model = prop_('OPENAI_MODEL') || 'gpt-4o-mini';
  const res = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method:'post', contentType:'application/json',
    headers: { 'Authorization':'Bearer '+key },
    payload: JSON.stringify({ model, max_tokens:300, messages:[{role:'system',content:sys},{role:'user',content:user}] }),
    muteHttpExceptions:true
  });
  const r = JSON.parse(res.getContentText());
  if (r.error) throw new Error('OpenAI: '+r.error.message);
  return r.choices[0].message.content.trim();
}

/**
 * X API v2 投稿（リプライ対応）
 */
function postToX_(text, replyToId) {
  const url = 'https://api.x.com/2/tweets';
  const ck=prop_('X_CONSUMER_KEY'), cs=prop_('X_CONSUMER_SECRET');
  const at=prop_('X_ACCESS_TOKEN'), ats=prop_('X_ACCESS_TOKEN_SECRET');
  if (!ck||!cs||!at||!ats) throw new Error('X API認証情報不足');

  const body = { text };
  if (replyToId) body.reply = { in_reply_to_tweet_id: replyToId };

  const oauthP = buildOAuthParams_(ck, at);
  oauthP.oauth_signature = genSig_('POST', url, oauthP, cs, ats);
  const res = UrlFetchApp.fetch(url, {
    method:'post', contentType:'application/json',
    headers: { 'Authorization': buildAuthHeader_(oauthP) },
    payload: JSON.stringify(body), muteHttpExceptions:true
  });
  const code = res.getResponseCode();
  const rb = JSON.parse(res.getContentText());
  if (code !== 201) throw new Error('X API ('+code+'): '+JSON.stringify(rb));
  return rb.data.id;
}

function getTweetMetrics_(tweetId) {
  const baseUrl = 'https://api.x.com/2/tweets/' + tweetId;
  const ck=prop_('X_CONSUMER_KEY'), cs=prop_('X_CONSUMER_SECRET');
  const at=prop_('X_ACCESS_TOKEN'), ats=prop_('X_ACCESS_TOKEN_SECRET');
  const oauthP = buildOAuthParams_(ck, at);
  const all = Object.assign({}, oauthP, {'tweet.fields':'public_metrics'});
  oauthP.oauth_signature = genSig_('GET', baseUrl, all, cs, ats);
  const res = UrlFetchApp.fetch(baseUrl+'?tweet.fields=public_metrics', {
    method:'get', headers:{'Authorization':buildAuthHeader_(oauthP)}, muteHttpExceptions:true
  });
  const r = JSON.parse(res.getContentText());
  return r.data ? r.data.public_metrics : null;
}
