/**
 * 投稿ログ画面
 */
const Logs = (() => {
  let currentPage = 1;
  const perPage = 30;

  async function load(page = 1) {
    currentPage = page;
    const container = document.getElementById('logs-container');
    container.innerHTML = '<p class="loading">読み込み中...</p>';

    try {
      const data = await API.request('getLogs', null, { page, perPage });
      renderTable(data.logs);
      renderPager(data.total, data.page, data.perPage);
    } catch (e) {
      container.innerHTML = `<p class="loading">読み込みエラー: ${e.message}</p>`;
    }
  }

  function renderTable(logs) {
    const container = document.getElementById('logs-container');
    if (logs.length === 0) {
      container.innerHTML = '<p class="loading">投稿ログがありません</p>';
      return;
    }

    const html = `<table>
      <thead><tr>
        <th>日時</th><th>商品名</th><th>API</th><th>投稿文</th>
        <th>ステータス</th><th>♥</th><th>RT</th><th>Imp</th>
      </tr></thead>
      <tbody>${logs.map(l => {
        const dt = l['投稿日時'] ? new Date(l['投稿日時']) : null;
        const dtStr = dt ? dt.toLocaleString('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '-';
        const api = l['使用API'];
        const apiBadge = api === 'Claude'
          ? '<span class="badge badge-claude">Claude</span>'
          : api === 'OpenAI'
          ? '<span class="badge badge-openai">OpenAI</span>'
          : '-';
        const status = l['ステータス'] === '成功'
          ? '<span class="badge badge-success">成功</span>'
          : '<span class="badge badge-fail">失敗</span>';
        return `<tr>
          <td style="white-space:nowrap">${dtStr}</td>
          <td>${esc(l['商品名'])}</td>
          <td>${apiBadge}</td>
          <td class="tweet-preview">${esc(l['投稿文'])}</td>
          <td>${status}</td>
          <td>${l['いいね数'] || '-'}</td>
          <td>${l['RT数'] || '-'}</td>
          <td>${l['インプレッション'] || '-'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
    container.innerHTML = html;
  }

  function renderPager(total, page, perPage) {
    const pager = document.getElementById('logs-pager');
    const totalPages = Math.ceil(total / perPage);
    if (totalPages <= 1) { pager.hidden = true; return; }

    pager.hidden = false;
    let html = '';
    if (page > 1) html += `<button class="btn btn-ghost btn-sm" onclick="Logs.load(${page - 1})">← 前</button>`;
    html += `<span class="text-sm text-muted">${page} / ${totalPages}（全${total}件）</span>`;
    if (page < totalPages) html += `<button class="btn btn-ghost btn-sm" onclick="Logs.load(${page + 1})">次 →</button>`;
    pager.innerHTML = html;
  }

  return { load };
})();
