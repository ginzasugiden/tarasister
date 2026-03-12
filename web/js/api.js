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

    return new Promise((resolve, reject) => {
      const cbName = '_jsonp_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const timeout = setTimeout(() => {
        delete window[cbName];
        script.remove();
        reject(new Error('タイムアウト'));
      }, 30000);

      window[cbName] = (json) => {
        clearTimeout(timeout);
        delete window[cbName];
        script.remove();
        if (!json.ok) { reject(new Error(json.error || '不明なエラー')); return; }
        resolve(json.data);
      };

      const script = document.createElement('script');
      script.src = url + '&callback=' + cbName;
      script.onerror = () => {
        clearTimeout(timeout);
        delete window[cbName];
        reject(new Error('通信エラー'));
      };
      document.head.appendChild(script);
    });
  }

  return { setAuth, getAuth, request, BASE_URL };
})();
