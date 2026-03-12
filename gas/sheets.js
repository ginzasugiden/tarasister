/**
 * スプレッドシートCRUD + 初期セットアップ
 */

const SH_PRODUCTS='商品マスタ', SH_LOG='投稿ログ', SH_PROMPTS='プロンプト', SH_STATUS='ステータス';

// ===== 商品マスタ =====

function getProducts_() {
  const sh = ss_().getSheetByName(SH_PRODUCTS);
  if (!sh) return [];
  const d = sh.getDataRange().getValues();
  if (d.length<=1) return [];
  const h = d[0];
  return d.slice(1).map((r,i) => {
    const o = {_rowIndex:i+2}; h.forEach((k,j)=>{o[k]=r[j]}); return o;
  }).filter(p=>p['商品名']);
}

function getRandomProduct_() {
  const p = getProducts_();
  if (!p.length) throw new Error('商品マスタが空です');
  return p[Math.floor(Math.random()*p.length)];
}

function saveProduct_(d) {
  const sh = ss_().getSheetByName(SH_PRODUCTS);
  if (!sh) throw new Error('商品マスタなし');
  const row = [d['商品名']||'',d['価格']||'',d['カテゴリ']||'',d['特徴']||'',d['ターゲット']||'',d['URL']||'',d['画像URL']||''];
  if (d._rowIndex) { sh.getRange(d._rowIndex,1,1,row.length).setValues([row]); return {action:'updated'}; }
  sh.appendRow(row); return {action:'added'};
}

function deleteProduct_(ri) {
  if (!ri) throw new Error('rowIndex必要');
  ss_().getSheetByName(SH_PRODUCTS).deleteRow(ri);
  return {action:'deleted'};
}

// ===== プロンプト =====

function getPrompts_() {
  const sh = ss_().getSheetByName(SH_PROMPTS);
  if (!sh) return {system:'',user:''};
  return { system:sh.getRange('B1').getValue()||'', user:sh.getRange('B2').getValue()||'' };
}

function savePrompts_(d) {
  const sh = ss_().getSheetByName(SH_PROMPTS);
  if (!sh) throw new Error('プロンプトシートなし');
  if (d.system!==undefined) sh.getRange('B1').setValue(d.system);
  if (d.user!==undefined)   sh.getRange('B2').setValue(d.user);
  return {action:'saved'};
}

function getPromptTemplate_() {
  const sh = ss_().getSheetByName(SH_PROMPTS);
  if (!sh) throw new Error('プロンプトシートなし');
  return { systemPrompt:sh.getRange('B1').getValue(), userTemplate:sh.getRange('B2').getValue() };
}

// ===== 投稿ログ =====

function writeLog_(product, text, api, tid, status, err) {
  const sh = ss_().getSheetByName(SH_LOG);
  if (!sh) return;
  sh.appendRow([new Date(),product['商品名']||'',product['カテゴリ']||'',api||'',text||'',
    text?text.length:0, tid||'', status||'', err||'', '','','']);
}

function getLogs_(page, per) {
  const sh = ss_().getSheetByName(SH_LOG);
  if (!sh) return {logs:[],total:0,page,perPage:per};
  const d = sh.getDataRange().getValues();
  if (d.length<=1) return {logs:[],total:0,page,perPage:per};
  const h=d[0], all=d.slice(1).reverse(), total=all.length;
  const start=(page-1)*per, rows=all.slice(start,start+per);
  const logs = rows.map(r => {
    const o={}; h.forEach((k,i)=>{o[k]=r[i]});
    if (o['投稿日時'] instanceof Date) o['投稿日時']=o['投稿日時'].toISOString();
    return o;
  });
  return {logs,total,page,perPage:per};
}

// ===== ABテスト分析 =====

function getAnalysis_() {
  const sh = ss_().getSheetByName(SH_LOG);
  if (!sh) return {claude:{},openai:{},products:[],daily:[],totalPosts:0,failedPosts:0};
  const d = sh.getDataRange().getValues();
  if (d.length<=1) return {claude:{},openai:{},products:[],daily:[],totalPosts:0,failedPosts:0};

  const rows = d.slice(1);
  const ok = rows.filter(r=>r[7]==='成功');
  const calc = f => {
    const c=f.length, wl=f.filter(r=>r[9]!==''&&r[9]!=null);
    const al=wl.length?wl.reduce((s,r)=>s+Number(r[9]||0),0)/wl.length:0;
    const ar=wl.length?wl.reduce((s,r)=>s+Number(r[10]||0),0)/wl.length:0;
    const ai=wl.length?wl.reduce((s,r)=>s+Number(r[11]||0),0)/wl.length:0;
    return {count:c,avgLikes:Math.round(al*10)/10,avgRT:Math.round(ar*10)/10,avgImpr:Math.round(ai*10)/10};
  };
  const cRows=ok.filter(r=>r[3]==='Claude'), oRows=ok.filter(r=>r[3]==='OpenAI');

  const names=[...new Set(ok.map(r=>r[1]).filter(Boolean))];
  const products=names.map(n=>({name:n, claude:calc(cRows.filter(r=>r[1]===n)), openai:calc(oRows.filter(r=>r[1]===n))}));

  const now=new Date(), daily=[];
  for(let i=13;i>=0;i--){
    const dt=new Date(now); dt.setDate(dt.getDate()-i);
    const ds=Utilities.formatDate(dt,'Asia/Tokyo','yyyy-MM-dd');
    const dr=ok.filter(r=>r[0] instanceof Date && Utilities.formatDate(r[0],'Asia/Tokyo','yyyy-MM-dd')===ds);
    daily.push({date:ds, claude:dr.filter(r=>r[3]==='Claude').length, openai:dr.filter(r=>r[3]==='OpenAI').length});
  }

  return {claude:calc(cRows),openai:calc(oRows),products,daily,totalPosts:ok.length,failedPosts:rows.filter(r=>r[7]==='失敗').length};
}

// ===== ステータス =====

function getStatus_() {
  const sh = ss_().getSheetByName(SH_STATUS);
  if (!sh) return {lastRun:null,lastStatus:'未実行'};
  return { lastRun:sh.getRange('B1').getValue(), lastStatus:sh.getRange('B2').getValue() };
}

function updateStatus_(msg) {
  try {
    const sh = ss_().getSheetByName(SH_STATUS);
    if (!sh) return;
    sh.getRange('B1').setValue(new Date());
    sh.getRange('B2').setValue(msg);
    sh.appendRow([new Date(), msg]);
  } catch(e){}
}

// ===== エンゲージメント更新 =====

function updateEngagement() {
  const sh = ss_().getSheetByName(SH_LOG);
  if (!sh) return;
  const d = sh.getDataRange().getValues();
  let n=0;
  for (let i=1;i<d.length;i++) {
    const tid=d[i][6], st=d[i][7];
    if (!tid||st!=='成功') continue;
    const h=(Date.now()-new Date(d[i][0]).getTime())/(36e5);
    if (h<24||h>168) continue;
    try {
      const m=getTweetMetrics_(tid);
      if (m) { const r=i+1; sh.getRange(r,10).setValue(m.like_count||0); sh.getRange(r,11).setValue(m.retweet_count||0); sh.getRange(r,12).setValue(m.impression_count||0); n++; }
    } catch(e){ Logger.log('Metrics err: '+e.message); }
    Utilities.sleep(1000);
  }
  updateStatus_('📊 エンゲージメント更新: '+n+'件');
}

// ===== 初期セットアップ =====

function setupSpreadsheet() {
  const s = ss_();
  const ui = SpreadsheetApp.getUi();
  const hStyle = (sh,cols) => sh.getRange(1,1,1,cols).setFontWeight('bold').setBackground('#1a1a2e').setFontColor('white');

  // 認証
  const auth = setupAuthSheet_();

  // 商品マスタ（既存データがなければ初期データ投入）
  let sh = s.getSheetByName(SH_PRODUCTS);
  if (!sh) {
    sh = s.insertSheet(SH_PRODUCTS);
    sh.getRange(1,1,1,7).setValues([['商品名','価格','カテゴリ','特徴','ターゲット','URL','画像URL']]);
    hStyle(sh,7);
    // 初期データはスクレイパーで取得するか、手動で入れる
    Logger.log('商品マスタ作成。scrapeAndSyncProducts() で商品を取得できます');
  }

  // 投稿ログ
  sh = s.getSheetByName(SH_LOG);
  if (!sh) sh = s.insertSheet(SH_LOG);
  if (sh.getLastRow() < 1) {
    sh.getRange(1,1,1,12).setValues([['投稿日時','商品名','カテゴリ','使用API','投稿文','文字数','ツイートID','ステータス','エラー内容','いいね数','RT数','インプレッション']]);
    hStyle(sh,12);
  }

  // プロンプト
  sh = s.getSheetByName(SH_PROMPTS);
  if (!sh) {
    sh = s.insertSheet(SH_PROMPTS);
    sh.getRange('A1:A2').setValues([['システムプロンプト'],['ユーザープロンプト']]);
    hStyle(sh,2);
    sh.getRange('B1').setValue(
      'あなたはTARA SISTERというウェルネス・ボディケアブランドのSNSマーケターです。\n'
      +'ブランドコンセプト: 日本古来の知恵（禊・お茶・天然素材）を現代の美容に昇華。\n'
      +'トーン: 上品で温かみがあり、押しつけがましくない。\n'
      +'投稿ルール:\n- 日本語130文字以内（URLは別ツイートで送るので含めない）\n'
      +'- ハッシュタグ2-3個（#TARASISTER必須）\n- 「気になる人はリプ欄へ👇」的な誘導を入れる\n'
      +'- 毎回違う切り口\n- 薬機法NG表現を避ける\n- 絵文字は2-4個程度'
    );
    sh.getRange('B2').setValue(
      '以下の商品のX投稿文を1つだけ生成。投稿文のみ出力。\n\n'
      +'商品名: {{商品名}}\n価格: {{価格}}\nカテゴリ: {{カテゴリ}}\n特徴: {{特徴}}\nターゲット: {{ターゲット}}'
    );
  }

  // ステータス
  sh = s.getSheetByName(SH_STATUS);
  if (!sh) {
    sh = s.insertSheet(SH_STATUS);
    sh.getRange('A1:B2').setValues([['最終実行日時','（未実行）'],['最終ステータス','セットアップ完了']]);
  }

  ui.alert('✅ セットアップ完了！\n\nログイン: '+auth.user+' / '+auth.pass
    +'\n\n次: スクリプトプロパティにAPIキー設定 → Webアプリデプロイ → setupTrigger');
}
