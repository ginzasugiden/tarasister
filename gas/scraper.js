/**
 * BASE商品スクレイピング
 * 既存の コード.gs を統合・クリーンアップ
 * tarasister.com から商品情報を取得して商品マスタに反映
 */

/**
 * BASEから商品を取得して「商品一覧」シートに保存
 */
function scrapeBaseShop_() {
  const s = ss_();
  let sheet = s.getSheetByName('商品一覧');
  if (!sheet) sheet = s.insertSheet('商品一覧');
  sheet.clearContents();
  sheet.getRange(1,1,1,5).setValues([['商品名','価格','商品URL','画像URL','商品説明']]);

  // 全商品URLを取得
  const html = UrlFetchApp.fetch('https://www.tarasister.com/search?q=', {muteHttpExceptions:true}).getContentText();
  const urlRe = /href=["']((?:https?:\/\/www\.tarasister\.com)?\/items\/(\d+))["']/gi;
  const urls = [];
  let m;
  while ((m = urlRe.exec(html)) !== null) {
    let u = m[1];
    if (u.indexOf('http')!==0) u = 'https://www.tarasister.com' + u;
    if (urls.indexOf(u)===-1) urls.push(u);
  }
  Logger.log('Found ' + urls.length + ' items');

  const items = [];
  for (const url of urls) {
    try {
      const ih = UrlFetchApp.fetch(url, {muteHttpExceptions:true}).getContentText();

      // 商品名
      let name = '';
      const og = ih.match(/property="og:title"\s+content="([^"]+)"/) || ih.match(/content="([^"]+)"\s+property="og:title"/);
      if (og) name = og[1];
      else { const t = ih.match(/<title>([^<]+)<\/title>/); if (t) name = t[1].replace(/ - .+$/,'').trim(); }

      // 価格
      let price = '';
      const pm = ih.match(/[¥￥]([\d,]+)/);
      if (pm) price = '¥'+pm[1];

      // 画像
      let img = '';
      const oi = ih.match(/property="og:image"\s+content="([^"]+)"/) || ih.match(/content="([^"]+)"\s+property="og:image"/);
      if (oi) img = oi[1];

      // 説明文
      let desc = '';
      const od = ih.match(/property="og:description"\s+content="([^"]+)"/) || ih.match(/content="([^"]+)"\s+property="og:description"/);
      if (od) desc = od[1];
      // 本文からも取得（より詳しい）
      const body = ih.match(/class="[^"]*item[_-]?description[^"]*"[^>]*>([\s\S]*?)(?:<div[^>]*class="[^"]*report|通報する)/i)
        || ih.match(/税込([\s\S]*?)通報する/i);
      if (body) {
        const raw = body[1].replace(/<img[^>]*>/gi,'').replace(/<style[^>]*>[\s\S]*?<\/style>/gi,'')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]+>/g,'\n')
          .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
          .replace(/カートに入れる[\s\S]*?(?=\n\n)/i,'').replace(/.*最短で.*お届けします.*/g,'')
          .replace(/.*送料無料.*/g,'').replace(/種類を選択する/g,'').replace(/\n{3,}/g,'\n\n').trim();
        if (raw.length > desc.length) desc = raw;
      }

      if (name) items.push([name, price, url, img, desc.substring(0,5000)]);
      Utilities.sleep(1500);
    } catch(e) { Logger.log('Error: '+url+' '+e.message); }
  }

  if (items.length > 0) {
    sheet.getRange(2,1,items.length,5).setValues(items);
    sheet.autoResizeColumns(1,4);
  }
  Logger.log('取得完了: ' + items.length + '商品');
  return items.length;
}

/**
 * 「商品一覧」→「商品マスタ」に同期
 */
function syncToProductMaster_() {
  const s = ss_();
  const src = s.getSheetByName('商品一覧');
  if (!src || src.getLastRow() < 2) { Logger.log('商品一覧にデータなし'); return 0; }

  let dst = s.getSheetByName(SH_PRODUCTS);
  if (!dst) {
    dst = s.insertSheet(SH_PRODUCTS);
    dst.getRange(1,1,1,7).setValues([['商品名','価格','カテゴリ','特徴','ターゲット','URL','画像URL']]);
  }

  const srcData = src.getRange(2,1,src.getLastRow()-1,5).getValues(); // 名前,価格,URL,画像,説明
  const existingUrls = dst.getLastRow() > 1
    ? dst.getRange(2,6,dst.getLastRow()-1,1).getValues().map(r=>String(r[0]).trim())
    : [];

  let added = 0;
  for (const row of srcData) {
    const [name, price, url, img, desc] = row;
    if (!name) continue;
    if (existingUrls.includes(String(url).trim())) continue; // 重複スキップ

    // カテゴリ推定
    let cat = 'その他';
    if (/セット/.test(name)) cat = 'セット';
    else if (/ブラシ/.test(name)) cat = 'ケアグッズ';
    else if (/オイル|ウォッシュ|DANA|Mary/i.test(name)) cat = 'コスメ';
    else if (/茶/.test(name)) cat = 'その他';

    // 特徴はdescの先頭200文字
    const feature = desc ? desc.substring(0,200) : '';
    const target = ''; // 手動で後から入力

    dst.appendRow([name, price, cat, feature, target, url, img]);
    added++;
  }

  Logger.log('商品マスタに ' + added + '件追加');
  return added;
}

/**
 * スクレイプ → 同期 を一括実行（メニューから呼ぶ）
 */
function scrapeAndSyncProducts() {
  const count = scrapeBaseShop_();
  const added = syncToProductMaster_();
  SpreadsheetApp.getUi().alert('✅ BASE商品取得完了\n取得: '+count+'商品\n商品マスタに追加: '+added+'件');
}

/**
 * APIから呼ぶ版
 */
function refreshProductsFromBase_() {
  const count = scrapeBaseShop_();
  const added = syncToProductMaster_();
  return { scraped: count, addedToMaster: added };
}
