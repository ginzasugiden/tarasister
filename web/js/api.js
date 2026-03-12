/**
 * GAS API通信モジュール
 */
const API = (() => {
  // GASデプロイURL（初回デプロイ後にここを書き換える）
  const BASE_URL = 'https://script.google.com/macros/s/AKfycbxJifcUYgiLAu-Hl59YPBVKFBfh5CG3KCyNtPV-KqivzDC_pDpGLKVrAJGovv64Y5GBcw/exec';

  let authToken = '';

  function setAuth(token) { authToken = token; }
  function getAuth() { return authToken; }

  async function request(action, data = null, extraParams = {}) {
    const params = new URLSearchParams({ action, auth: authToken, ...extraParams });
    const url = `${BASE_URL}?${params.toString()}`;

    const options = { method: 'GET' };

    if (data) {
      options.method = 'POST';
      options.headers = { 'Content-Type': 'text/plain' };
      // GAS doPost receives postData in e.postData.contents
      options.body = JSON.stringify(data);
    }

    const res = await fetch(url, options);
    const json = await res.json();

    if (!json.ok) {
      throw new Error(json.error || '不明なエラー');
    }
    return json.data;
  }

  return { setAuth, getAuth, request, BASE_URL };
})();
