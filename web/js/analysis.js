/**
 * ABテスト分析画面
 */
const Analysis = (() => {

  async function load() {
    try {
      const data = await API.request('getAnalysis');
      renderWinner(data);
      renderSummary(data);
      renderChart(data.daily || []);
      renderProducts(data.products || []);
    } catch (e) {
      document.getElementById('analysis-winner').textContent = '読み込みエラー: ' + e.message;
    }
  }

  function renderWinner(data) {
    const el = document.getElementById('analysis-winner');
    const c = data.claude || {};
    const o = data.openai || {};

    if ((c.count || 0) < 10 || (o.count || 0) < 10) {
      el.textContent = `📈 データ収集中... 各API 10投稿以上で判定開始（Claude: ${c.count || 0}件 / OpenAI: ${o.count || 0}件）`;
      return;
    }

    if (c.avgLikes > o.avgLikes) {
      el.innerHTML = `🏆 <strong>Claude</strong> が平均いいねで勝っています（${c.avgLikes} vs ${o.avgLikes}）`;
    } else if (o.avgLikes > c.avgLikes) {
      el.innerHTML = `🏆 <strong>OpenAI</strong> が平均いいねで勝っています（${o.avgLikes} vs ${c.avgLikes}）`;
    } else {
      el.textContent = '⚖️ ほぼ同等の成績です';
    }
  }

  function renderSummary(data) {
    const c = data.claude || {};
    const o = data.openai || {};
    const el = document.getElementById('analysis-summary');

    el.innerHTML = `
      <div class="stat-card" style="border-left: 4px solid var(--claude-blue)">
        <div class="stat-label">Claude</div>
        <div class="stat-value">${c.count || 0}<span class="text-sm text-muted"> 投稿</span></div>
        <div class="text-sm text-muted">平均♥ ${c.avgLikes || 0} / RT ${c.avgRT || 0} / Imp ${c.avgImpr || 0}</div>
      </div>
      <div class="stat-card" style="border-left: 4px solid var(--openai-green)">
        <div class="stat-label">OpenAI</div>
        <div class="stat-value">${o.count || 0}<span class="text-sm text-muted"> 投稿</span></div>
        <div class="text-sm text-muted">平均♥ ${o.avgLikes || 0} / RT ${o.avgRT || 0} / Imp ${o.avgImpr || 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">総投稿数</div>
        <div class="stat-value">${data.totalPosts || 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">失敗</div>
        <div class="stat-value">${data.failedPosts || 0}</div>
      </div>
    `;
  }

  function renderChart(daily) {
    const el = document.getElementById('analysis-chart');
    if (daily.length === 0) {
      el.innerHTML = '<p class="text-sm text-muted" style="text-align:center">データなし</p>';
      return;
    }

    const maxVal = Math.max(...daily.map(d => d.claude + d.openai), 1);
    const maxHeight = 130;

    const bars = daily.map(d => {
      const cH = (d.claude / maxVal) * maxHeight;
      const oH = (d.openai / maxVal) * maxHeight;
      const label = d.date.slice(5); // MM-DD
      return `<div class="chart-day">
        <div class="chart-bar-group">
          <div class="chart-bar claude" style="height:${Math.max(cH, 2)}px" title="Claude: ${d.claude}"></div>
          <div class="chart-bar openai" style="height:${Math.max(oH, 2)}px" title="OpenAI: ${d.openai}"></div>
        </div>
        <div class="chart-label">${label}</div>
      </div>`;
    }).join('');

    el.innerHTML = bars + `
      <div class="chart-legend" style="position:absolute; bottom:-24px; width:100%; left:0;">
        <span><span class="legend-dot" style="background:var(--claude-blue)"></span>Claude</span>
        <span><span class="legend-dot" style="background:var(--openai-green)"></span>OpenAI</span>
      </div>`;
    el.style.position = 'relative';
    el.style.marginBottom = '2rem';
  }

  function renderProducts(products) {
    const el = document.getElementById('analysis-products');
    if (products.length === 0) {
      el.innerHTML = '<p class="text-sm text-muted">データなし</p>';
      return;
    }

    const html = `<table>
      <thead><tr>
        <th>商品名</th>
        <th>Claude 投稿数</th><th>Claude 平均♥</th>
        <th>OpenAI 投稿数</th><th>OpenAI 平均♥</th>
        <th>勝者</th>
      </tr></thead>
      <tbody>${products.map(p => {
        const cLikes = p.claude.avgLikes || 0;
        const oLikes = p.openai.avgLikes || 0;
        let winner = '-';
        if (p.claude.count >= 3 && p.openai.count >= 3) {
          winner = cLikes > oLikes ? '<span class="badge badge-claude">Claude</span>'
                 : oLikes > cLikes ? '<span class="badge badge-openai">OpenAI</span>'
                 : '引分';
        }
        return `<tr>
          <td>${esc(p.name)}</td>
          <td>${p.claude.count}</td><td>${cLikes}</td>
          <td>${p.openai.count}</td><td>${oLikes}</td>
          <td>${winner}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
    el.innerHTML = html;
  }

  return { load };
})();
