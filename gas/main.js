/**
 * TARA SISTER X自動投稿 - APIエンドポイント + トリガー管理
 */

const SS_ID = '12jG6r6WrUFbTdJfk86i9zdCxbc0ZP8tlBOojTDjQnBU';
function ss_() { return SpreadsheetApp.openById(SS_ID); }

// ===== Web App エンドポイント =====

function doGet(e) {
  const result = handleRequest_(e);
  const jsonText = result.getContent();
  const callback = (e.parameter || {}).callback;
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + jsonText + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return result;
}
function doPost(e) { return handleRequest_(e); }

function handleRequest_(e) {
  try {
    const p = e.parameter || {};
    const action = p.action || '';
    if (action === 'ping') return json_({ ok:true });

    if (!p.tk || !verifyAuth_(p.tk)) return json_({ ok:false, error:'認証エラー' });

    let post = {};
    if (p.data) {
      try { post = JSON.parse(Utilities.newBlob(Utilities.base64Decode(p.data)).getDataAsString()); } catch(_){}
    } else if (e.postData && e.postData.contents) {
      try { post = JSON.parse(e.postData.contents); } catch(_){}
    }

    switch (action) {
      case 'getProducts':    return json_({ ok:true, data: getProducts_() });
      case 'saveProduct':    return json_({ ok:true, data: saveProduct_(post) });
      case 'deleteProduct':  return json_({ ok:true, data: deleteProduct_(post.rowIndex) });
      case 'getPrompts':     return json_({ ok:true, data: getPrompts_() });
      case 'savePrompts':    return json_({ ok:true, data: savePrompts_(post) });
      case 'getLogs':        return json_({ ok:true, data: getLogs_(parseInt(p.page)||1, parseInt(p.perPage)||50) });
      case 'getAnalysis':    return json_({ ok:true, data: getAnalysis_() });
      case 'getStatus':      return json_({ ok:true, data: getStatus_() });
      case 'testGenerate':   return json_({ ok:true, data: testGenerateOnly_(p.target || 'threads') });
      case 'getThreadsStatus':  return json_({ ok:true, data: getThreadsStatus_() });
      case 'getThreadsAuthUrl': return json_({ ok:true, data: { url: getThreadsAuthUrl_() } });
      case 'threadsExchange':   return json_({ ok:true, data: exchangeThreadsCode_(p.code) });
      case 'setPostTargets':    return json_({ ok:true, data: setPostTargets_(post.targets) });
      case 'postNow':        return json_({ ok:true, data: postTweetManual_() });
      case 'refreshProducts': return json_({ ok:true, data: refreshProductsFromBase_() });
      default: return json_({ ok:false, error:'不明: '+action });
    }
  } catch (err) {
    Logger.log('API Error: ' + err.message);
    return json_({ ok:false, error: err.message });
  }
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// ===== 自動投稿（トリガー用） =====

// 投稿先は POST_TARGETS（threads / x / threads,x、既定 threads）で切替
function runPost_(manual) {
  const targets = (prop_('POST_TARGETS') || 'threads').split(',').map(s => s.trim()).filter(Boolean);
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
      Logger.log('投稿エラー(' + t + '): ' + err.message);
      writeLog_(product, text, api, '', '失敗', err.message, t);
      results.push({ target:t, ok:false, error: err.message });
    }
  });
  const okN = results.filter(r => r.ok).length;
  updateStatus_((okN ? '✅ ' : '❌ ') + product['商品名'] + ' → ' + results.map(r => r.target + (r.ok ? ' OK' : ' NG: ' + r.error)).join(' / '));
  return { product: product['商品名'], results };
}

function replyText_(p) { return '🛒 ' + p['商品名'] + '\n💰 ' + p['価格'] + '\n\n詳細はこちら👇\n' + p['URL']; }

// トリガー名は互換のため postTweet のまま
function postTweet() {
  try { runPost_(false); } catch (e) { Logger.log('自動投稿エラー: ' + e.message); updateStatus_('❌ ' + e.message); }
}
function postTweetManual_() { return runPost_(true); }

function testGenerateOnly_(target) {
  target = target || 'threads';
  const product = getRandomProduct_();
  const r = generateTweetText_(product, target);
  return { product:product['商品名'], apiUsed:r.apiUsed, tweetText:r.tweetText, charCount:r.tweetText.length };
}

// ===== トリガー管理 =====

function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (['postTweet','updateEngagement','refreshThreadsToken'].includes(t.getHandlerFunction())) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('postTweet').timeBased().everyHours(3).create();
  ScriptApp.newTrigger('updateEngagement').timeBased().atHour(9).everyDays(1).create();
  ScriptApp.newTrigger('refreshThreadsToken').timeBased().everyWeeks(1).create();
  Logger.log('✅ トリガー設定完了: 3h投稿 + 毎朝9時エンゲージメント + 週次Threadsトークン更新');
}

function removeTriggers() {
  let n=0;
  ScriptApp.getProjectTriggers().forEach(t => { ScriptApp.deleteTrigger(t); n++; });
  Logger.log('🗑️ ' + n + '件削除');
}

// ===== メニュー =====

function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('🤖 X自動投稿')
      .addItem('📋 初期セットアップ', 'setupSpreadsheet')
      .addItem('⏰ トリガー設定', 'setupTrigger')
      .addItem('🗑️ トリガー全削除', 'removeTriggers')
      .addSeparator()
      .addItem('📮 今すぐ投稿', 'postTweet')
      .addItem('🧪 テスト生成', 'testGenerateOnly_')
      .addItem('📊 エンゲージメント取得', 'updateEngagement')
      .addSeparator()
      .addItem('🔄 BASE商品再取得', 'scrapeAndSyncProducts')
      .addToUi();
  } catch(e) {
    Logger.log('onOpen: スタンドアロンのためメニュー追加スキップ');
  }
}
