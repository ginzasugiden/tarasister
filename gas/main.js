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

    if (action === 'debugAuth') {
      var authParam = p.tk || '(なし)';
      var ss = SpreadsheetApp.openById('12jG6r6WrUFbTdJfk86i9zdCxbc0ZP8tlBOojTDjQnBU');
      var sheet = ss.getSheetByName('認証');
      var sheetToken = sheet ? String(sheet.getRange('B2').getValue()).trim() : '(シートなし)';
      return json_({
        ok: true,
        received: authParam,
        receivedLen: authParam.length,
        stored: sheetToken,
        storedLen: sheetToken.length,
        receivedTrimmed: authParam.replace(/=+$/, ''),
        storedTrimmed: sheetToken.replace(/=+$/, ''),
        match: authParam.replace(/=+$/, '') === sheetToken.replace(/=+$/, '')
      });
    }

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
      case 'testGenerate':   return json_({ ok:true, data: testGenerateOnly_() });
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

function postTweet() {
  let product={}, text='', api='';
  try {
    product = getRandomProduct_();
    const r = generateTweetText_(product);
    text = r.tweetText; api = r.apiUsed;
    if (text.length > 140) text = text.substring(0,137) + '...';

    // 1つ目: 紹介文
    const tid = postToX_(text);
    // 2つ目: リプライ（商品URL）
    Utilities.sleep(3000);
    const reply = '🛒 ' + product['商品名'] + '\n💰 ' + product['価格'] + '\n\n詳細はこちら👇\n' + product['URL'];
    try { postToX_(reply, tid); } catch(re) { Logger.log('リプライエラー: '+re.message); }

    writeLog_(product, text, api, tid, '成功', '');
    updateStatus_('✅ ' + product['商品名'] + ' (' + api + ')');
  } catch (err) {
    Logger.log('自動投稿エラー: ' + err.message);
    writeLog_(product, text, api, '', '失敗', err.message);
    updateStatus_('❌ ' + err.message);
  }
}

function postTweetManual_() {
  let product={}, text='', api='';
  product = getRandomProduct_();
  const r = generateTweetText_(product);
  text = r.tweetText; api = r.apiUsed;
  if (text.length > 140) text = text.substring(0,137) + '...';
  const tid = postToX_(text);
  Utilities.sleep(3000);
  const reply = '🛒 ' + product['商品名'] + '\n💰 ' + product['価格'] + '\n\n詳細はこちら👇\n' + product['URL'];
  try { postToX_(reply, tid); } catch(re) { Logger.log('リプライエラー: '+re.message); }
  writeLog_(product, text, api, tid, '成功', '');
  return { product:product['商品名'], apiUsed:api, tweetText:text, tweetId:tid };
}

function testGenerateOnly_() {
  const product = getRandomProduct_();
  const r = generateTweetText_(product);
  return { product:product['商品名'], apiUsed:r.apiUsed, tweetText:r.tweetText, charCount:r.tweetText.length };
}

// ===== トリガー管理 =====

function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (['postTweet','updateEngagement'].includes(t.getHandlerFunction())) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('postTweet').timeBased().everyHours(3).create();
  ScriptApp.newTrigger('updateEngagement').timeBased().atHour(9).everyDays(1).create();
  Logger.log('✅ トリガー設定完了: 3h投稿 + 毎朝9時エンゲージメント');
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
