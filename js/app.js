/**
 * メインアプリケーション
 */
const App = (() => {
  let currentTab = 'dashboard';

  function init() {
    // ログイン処理
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // ナビゲーション
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // ダッシュボードアクション
    document.getElementById('btn-test-generate').addEventListener('click', handleTestGenerate);
    document.getElementById('btn-post-now').addEventListener('click', handlePostNow);
    document.getElementById('btn-threads-connect').addEventListener('click', handleThreadsConnect);
    document.getElementById('post-target').addEventListener('change', handleTargetChange);

    // モジュール初期化
    Products.init();
    Prompts.init();

    // 認証復元チェック
    if (Auth.init()) {
      showApp();
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;
    const errEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    btn.disabled = true;
    btn.textContent = '認証中...';
    errEl.hidden = true;

    try {
      await Auth.login(user, pass);
      showApp();
    } catch (err) {
      errEl.textContent = err.message || 'ログインに失敗しました';
      errEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = 'ログイン';
    }
  }

  function handleLogout() {
    Auth.logout();
    document.getElementById('app-screen').classList.remove('active');
    document.getElementById('login-screen').classList.add('active');
  }

  function showApp() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app-screen').classList.add('active');
    loadDashboard();
  }

  function switchTab(tab) {
    currentTab = tab;

    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.nav-btn[data-tab="${tab}"]`).classList.add('active');

    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');

    // タブ切替時にデータ読み込み
    switch (tab) {
      case 'dashboard': loadDashboard(); break;
      case 'products':  Products.load(); break;
      case 'prompts':   Prompts.load(); break;
      case 'logs':      Logs.load(1); break;
      case 'analysis':  Analysis.load(); break;
    }
  }

  async function loadDashboard() {
    try {
      const status = await API.request('getStatus');
      document.getElementById('stat-last-run').textContent =
        status.lastRun ? new Date(status.lastRun).toLocaleString('ja-JP') : '未実行';
      document.getElementById('stat-status').textContent = status.lastStatus || '-';
    } catch (_) {}

    try {
      const th = await API.request('getThreadsStatus');
      const exp = th.expires ? new Date(th.expires).toLocaleDateString('ja-JP') : '-';
      document.getElementById('threads-status').textContent =
        th.connected ? '連携済み（期限 ' + exp + '）' : '未連携';
      document.getElementById('post-target').value = targetToValue(th.targets);
    } catch (_) {}

    try {
      const analysis = await API.request('getAnalysis');
      const total = (analysis.totalPosts || 0) + (analysis.failedPosts || 0);
      document.getElementById('stat-total').textContent = total;
      const rate = total > 0 ? Math.round((analysis.totalPosts / total) * 100) : 0;
      document.getElementById('stat-success-rate').textContent = rate + '%';
    } catch (_) {}
  }

  // GAS側の POST_TARGETS（threads / x / threads,x）→ セレクタ値
  function targetToValue(t) {
    const list = String(t || 'threads').split(',').map(s => s.trim());
    return list.length > 1 ? 'both' : (list[0] || 'threads');
  }

  function targetLabel(v) {
    return { threads: 'Threads', x: 'X', both: 'Threads と X' }[v] || v;
  }

  async function handleThreadsConnect() {
    try {
      const r = await API.request('getThreadsAuthUrl');
      location.href = r.url;
    } catch (e) {
      toast('Threads連携エラー: ' + e.message);
    }
  }

  async function handleTargetChange(e) {
    const sel = e.target;
    try {
      await API.request('setPostTargets', { targets: sel.value });
      toast('投稿先を ' + targetLabel(sel.value) + ' に変更しました');
    } catch (err) {
      toast('投稿先の変更エラー: ' + err.message);
      loadDashboard();
    }
  }

  async function handleTestGenerate() {
    const btn = document.getElementById('btn-test-generate');
    btn.disabled = true;
    btn.textContent = '生成中...';
    const card = document.getElementById('dashboard-result');

    try {
      const sel = document.getElementById('post-target').value;
      const target = sel === 'x' ? 'x' : 'threads';   // both は threads で生成
      const result = await API.request('testGenerate', null, { target });
      document.getElementById('result-title').textContent = '🧪 テスト生成結果';
      document.getElementById('result-body').innerHTML = `
        <p>${esc(result.tweetText)}</p>
        <p class="meta">商品: ${esc(result.product)} / API: ${result.apiUsed} / ${result.charCount}文字</p>
      `;
      card.hidden = false;
    } catch (e) {
      toast('テスト生成エラー: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '🧪 テスト生成';
    }
  }

  async function handlePostNow() {
    const targetName = targetLabel(document.getElementById('post-target').value);
    if (!confirm(targetName + 'に投稿します。よろしいですか？')) return;

    const btn = document.getElementById('btn-post-now');
    btn.disabled = true;
    btn.textContent = '投稿中...';
    const card = document.getElementById('dashboard-result');

    try {
      const result = await API.request('postNow');
      const results = result.results || [];
      const okN = results.filter(r => r.ok).length;
      document.getElementById('result-title').textContent = okN ? '📮 投稿結果' : '❌ 投稿失敗';
      document.getElementById('result-body').innerHTML =
        `<p class="meta">商品: ${esc(result.product)}</p>` +
        results.map(r => r.ok
          ? `<p><strong>${esc(r.target)}: OK</strong> (${esc(r.api)} / ID: ${esc(r.id)})<br>${esc(r.text)}</p>`
          : `<p><strong>${esc(r.target)}: NG</strong> ${esc(r.error)}</p>`
        ).join('');
      card.hidden = false;
      toast(okN === results.length ? '投稿しました！' : '一部の投稿に失敗しました');
      loadDashboard();
    } catch (e) {
      toast('投稿エラー: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '📮 今すぐ投稿';
    }
  }

  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.hidden = true; }, 3000);
  }

  return { init, toast };
})();

// 起動
document.addEventListener('DOMContentLoaded', App.init);
