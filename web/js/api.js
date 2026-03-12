/**
 * GAS API通信モジュール
 */
const API = (() => {
  // GASデプロイURL（初回デプロイ後にここを書き換える）
  const BASE_URL = 'https://script.google.com/macros/s/AKfycbwiGDHQsYLncsU5sCuczXGewfH211WfyfmCfVLotrcYhV-uEuDLVQEcG_zWXsgaoXg1/exec';

  let authToken = '';

  function setAuth(token) { authToken = token; }
  function getAuth() { return authToken; }

  async function request(action, data = null, extraParams = {}) {
    const params = new URLSearchParams({ action, auth: authToken, ...extraParams });
    if (data) {
      params.set('data', btoa(unescape(encodeURIComponent(JSON.stringify(data)))));
    }
    const url = BASE_URL + '?' + params.toString();
    const res = await fetch(url);
    if (!res.ok) throw new Error('通信エラー: ' + res.status);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || '不明なエラー');
    return json.data;
  }

  return { setAuth, getAuth, request, BASE_URL };
})();
