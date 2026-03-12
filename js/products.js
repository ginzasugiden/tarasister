/**
 * 商品マスタ画面（BASE商品取得ボタン付き）
 */
const Products = (() => {
  let products = [];

  async function load() {
    const container = document.getElementById('products-list');
    container.innerHTML = '<p class="loading">読み込み中...</p>';
    try {
      products = await API.request('getProducts');
      render();
    } catch (e) {
      container.innerHTML = `<p class="loading">エラー: ${e.message}</p>`;
    }
  }

  function render() {
    const container = document.getElementById('products-list');
    if (products.length === 0) {
      container.innerHTML = '<p class="loading">商品が登録されていません。「BASEから取得」で商品を読み込めます。</p>';
      return;
    }
    const html = `<table>
      <thead><tr><th>商品名</th><th>価格</th><th>カテゴリ</th><th>特徴</th><th>操作</th></tr></thead>
      <tbody>${products.map((p, i) => `<tr>
        <td><strong>${esc(p['商品名'])}</strong></td>
        <td>${esc(p['価格'])}</td>
        <td>${esc(p['カテゴリ'])}</td>
        <td class="tweet-preview">${esc(String(p['特徴']||'')).substring(0,60)}...</td>
        <td class="cell-actions">
          <button class="btn btn-ghost btn-sm" onclick="Products.edit(${i})">編集</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--error)" onclick="Products.remove(${i})">削除</button>
        </td>
      </tr>`).join('')}</tbody>
    </table>`;
    container.innerHTML = html;
  }

  function openModal(product) {
    const modal = document.getElementById('product-modal');
    document.getElementById('product-modal-title').textContent = product ? '商品編集' : '商品追加';
    document.getElementById('pf-rowIndex').value = product ? product._rowIndex||'' : '';
    document.getElementById('pf-name').value = product ? product['商品名']||'' : '';
    document.getElementById('pf-price').value = product ? product['価格']||'' : '';
    document.getElementById('pf-category').value = product ? product['カテゴリ']||'' : '';
    document.getElementById('pf-features').value = product ? product['特徴']||'' : '';
    document.getElementById('pf-target').value = product ? product['ターゲット']||'' : '';
    document.getElementById('pf-url').value = product ? product['URL']||'' : '';
    if (!product) document.getElementById('product-form').reset();
    modal.hidden = false;
  }

  function closeModal() { document.getElementById('product-modal').hidden = true; }
  function edit(i) { openModal(products[i]); }

  async function remove(i) {
    const p = products[i];
    if (!confirm(`「${p['商品名']}」を削除しますか？`)) return;
    try { await API.request('deleteProduct', {rowIndex:p._rowIndex}); App.toast('削除しました'); await load(); }
    catch (e) { App.toast('エラー: '+e.message); }
  }

  async function save(e) {
    e.preventDefault();
    const data = {
      '商品名': document.getElementById('pf-name').value,
      '価格': document.getElementById('pf-price').value,
      'カテゴリ': document.getElementById('pf-category').value,
      '特徴': document.getElementById('pf-features').value,
      'ターゲット': document.getElementById('pf-target').value,
      'URL': document.getElementById('pf-url').value,
    };
    const ri = document.getElementById('pf-rowIndex').value;
    if (ri) data._rowIndex = parseInt(ri);
    try { await API.request('saveProduct', data); closeModal(); App.toast(ri?'更新':'追加'); await load(); }
    catch (e) { App.toast('エラー: '+e.message); }
  }

  async function refreshFromBase() {
    const btn = document.getElementById('btn-refresh-base');
    btn.disabled = true; btn.textContent = '取得中...';
    try {
      const r = await API.request('refreshProducts');
      App.toast(`BASE取得完了: ${r.scraped}商品 / 新規${r.addedToMaster}件追加`);
      await load();
    } catch (e) { App.toast('エラー: '+e.message); }
    finally { btn.disabled = false; btn.textContent = '🔄 BASEから取得'; }
  }

  function init() {
    document.getElementById('btn-add-product').addEventListener('click', () => openModal(null));
    document.getElementById('btn-refresh-base').addEventListener('click', refreshFromBase);
    document.getElementById('product-modal-close').addEventListener('click', closeModal);
    document.getElementById('product-cancel').addEventListener('click', closeModal);
    document.getElementById('product-form').addEventListener('submit', save);
    document.querySelector('#product-modal .modal-overlay').addEventListener('click', closeModal);
  }

  return { init, load, edit, remove };
})();

function esc(s) { if(s==null) return ''; const d=document.createElement('div'); d.textContent=String(s); return d.innerHTML; }
